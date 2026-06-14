import logging
import os
import uvicorn

_verbose = os.environ.get("SWARM_DEBUG_VERBOSE", "1") == "1"

logging.basicConfig(
    level=logging.DEBUG if _verbose else logging.CRITICAL,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

from swarm_debug.config.Apps import MainApp
from swarm_debug.apps.health.health import health
from swarm_debug.apps.debugger.debugger import debugger
from fastapi.middleware.cors import CORSMiddleware

main_app = MainApp([health, debugger])
app = main_app.app

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from rich.console import Console as _Console

_req_console = _Console(stderr=True, color_system="truecolor")


@app.middleware("http")
async def _log_requests(request, call_next):
    """When verbose, print each request's start/end so hangs are visible.

    A request that logs a START line but never a matching END line is stuck
    inside the handler (e.g. a blocking scan) — exactly what we need to see.
    """
    if os.environ.get("SWARM_DEBUG_VERBOSE") != "1":
        return await call_next(request)

    import time as _time

    method = request.method
    path = request.url.path
    _req_console.print(f"[dim]→[/dim] [bold cyan]{method}[/bold cyan] {path} [dim]…[/dim]")
    start = _time.monotonic()
    try:
        response = await call_next(request)
    except Exception as exc:  # noqa: BLE001 - surface any handler error to the terminal
        dur = (_time.monotonic() - start) * 1000
        _req_console.print(
            f"[bold red]✘[/bold red] [bold cyan]{method}[/bold cyan] {path} "
            f"[red]raised {type(exc).__name__}: {exc}[/red] [dim]({dur:.0f}ms)[/dim]"
        )
        raise
    dur = (_time.monotonic() - start) * 1000
    color = "green" if response.status_code < 400 else "red"
    _req_console.print(
        f"[dim]←[/dim] [bold cyan]{method}[/bold cyan] {path} "
        f"[{color}]{response.status_code}[/{color}] [dim]({dur:.0f}ms)[/dim]"
    )
    return response


from fastapi.staticfiles import StaticFiles

BUILD_DIR = os.path.join(os.path.dirname(__file__), "debugger_gui_build")

if os.path.isdir(BUILD_DIR):
    app.mount("/", StaticFiles(directory=BUILD_DIR, html=True), name="gui")


def _wait_for_server(port: int, timeout: float = 10.0, show_progress: bool = True) -> bool:
    """Poll the health endpoint until the server is ready."""
    import time
    import urllib.request

    url = f"http://127.0.0.1:{port}/api/health/check"
    start = time.monotonic()

    if not show_progress:
        while time.monotonic() - start < timeout:
            try:
                with urllib.request.urlopen(url, timeout=1):
                    return True
            except (urllib.error.URLError, OSError, ConnectionError):
                time.sleep(0.2)
        return False

    from rich.console import Console
    from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeElapsedColumn

    console = Console(color_system="truecolor")
    with Progress(
        SpinnerColumn(),
        TextColumn("[bold]Starting server…"),
        BarColumn(),
        TimeElapsedColumn(),
        console=console,
        transient=True,
    ) as progress:
        task = progress.add_task("startup", total=100)
        while time.monotonic() - start < timeout:
            try:
                with urllib.request.urlopen(url, timeout=1):
                    progress.update(task, completed=100)
                    return True
            except (urllib.error.URLError, OSError, ConnectionError):
                elapsed_pct = min(90, ((time.monotonic() - start) / timeout) * 90)
                progress.update(task, completed=elapsed_pct)
                time.sleep(0.2)
    return False


def _print_starting_panel(console, port: int):
    from rich.panel import Panel
    console.print(Panel(
        f"[dim]Starting on port[/dim] [bold]{port}[/bold][dim]…[/dim]",
        title="[bold]swarm-debug[/bold]",
        border_style="bright_cyan",
    ))


def _print_ready_panel(console, port: int):
    from rich.panel import Panel
    from rich.text import Text

    panel_content = Text.from_markup(
        f"[bold cyan]swarm-debug[/bold cyan] GUI server\n"
        f"[dim]Port:[/dim] {port}  "
        f"[dim]Docs:[/dim] http://127.0.0.1:{port}/docs\n"
        f"[dim]Press Ctrl+C to quit[/dim]"
    )
    console.print(Panel(panel_content, title="[bold]swarm-debug[/bold]", border_style="bright_cyan"))


def start_server(port: int = 6969, open_browser: bool = False, verbose: bool = False):
    import asyncio
    import threading
    import webbrowser
    from rich.console import Console

    console = Console(color_system="truecolor")

    if verbose:
        os.environ["SWARM_DEBUG_VERBOSE"] = "1"
        _print_starting_panel(console, port)

        config = uvicorn.Config(
            "swarm_debug.server:app", host="0.0.0.0", port=port, reload=False,
        )
        server = uvicorn.Server(config)

        server_thread = threading.Thread(
            target=lambda: asyncio.run(server.serve()), daemon=True,
        )
        server_thread.start()

        if _wait_for_server(port, show_progress=False):
            _print_ready_panel(console, port)
            if open_browser:
                webbrowser.open(f"http://localhost:{port}")
        else:
            console.print("[red bold]✘[/red bold] Server failed to start within timeout")
            return

        try:
            server_thread.join()
        except KeyboardInterrupt:
            console.print("\n[dim]Shutting down…[/dim]")
            server.should_exit = True
            server_thread.join(timeout=5)
        return

    os.environ["SWARM_DEBUG_VERBOSE"] = "0"

    root = logging.getLogger()
    root.setLevel(logging.CRITICAL)
    for h in root.handlers:
        h.setLevel(logging.CRITICAL)

    _print_starting_panel(console, port)

    config = uvicorn.Config(
        "swarm_debug.server:app",
        host="0.0.0.0",
        port=port,
        log_level="critical",
        access_log=False,
    )
    server = uvicorn.Server(config)

    server_thread = threading.Thread(
        target=lambda: asyncio.run(server.serve()), daemon=True,
    )
    server_thread.start()

    if _wait_for_server(port):
        _print_ready_panel(console, port)
        if open_browser:
            webbrowser.open(f"http://localhost:{port}")
            console.print("[green bold]✔[/green bold] Browser opened")
    else:
        console.print("[red bold]✘[/red bold] Server failed to start within timeout")
        return

    try:
        server_thread.join()
    except KeyboardInterrupt:
        console.print("\n[dim]Shutting down…[/dim]")
        server.should_exit = True
        server_thread.join(timeout=5)


def main():
    port = int(os.environ.get("BACKEND_PORT", 6969))
    start_server(port=port)


if __name__ == "__main__":
    main()
