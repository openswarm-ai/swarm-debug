import enum
import filecmp
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request
from importlib.metadata import version as pkg_version
from pathlib import Path
from typing import Optional

import click
import typer
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.traceback import install as install_rich_traceback

install_rich_traceback(show_locals=True)

app = typer.Typer(
    name="swarm-debug",
    help="A colorized, toggleable debug logger with a web GUI and CLI.",
    no_args_is_help=True,
)

_console = Console(color_system="truecolor")
_err_console = Console(stderr=True, color_system="truecolor")

DEFAULT_PORT = 6969

_SKILL_SRC = Path(__file__).resolve().parent / "data" / "SKILL.md"


class State(str, enum.Enum):
    on = "on"
    off = "off"


def _skill_dst_dir() -> Path:
    from swarm_debug.core.DEFAULTS import get_root_dir
    return Path(get_root_dir()) / ".cursor" / "skills" / "swarm-debug"


def _skill_dst() -> Path:
    return _skill_dst_dir() / "SKILL.md"


def _is_cursor_environment() -> bool:
    from swarm_debug.core.DEFAULTS import get_root_dir
    if (Path(get_root_dir()) / ".cursor").is_dir():
        return True
    for key in ("VSCODE_GIT_ASKPASS_NODE", "VSCODE_GIT_ASKPASS_MAIN", "GIT_ASKPASS"):
        if "cursor" in os.environ.get(key, "").lower():
            return True
    return False


def _check_skill_not_installed():
    if _is_cursor_environment() and not _skill_dst().exists():
        _err_console.print(Panel(
            "[bold]You're using Cursor but haven't installed the swarm-debug skill.[/bold]\n"
            "Run: [cyan]swarm-debug install-cursor-skill[/cyan]",
            title="Skill Not Installed",
            border_style="yellow",
        ))


def _check_skill_staleness():
    dst = _skill_dst()
    if dst.exists() and _SKILL_SRC.exists():
        if not filecmp.cmp(_SKILL_SRC, dst, shallow=False):
            _err_console.print(Panel(
                "[bold]Your Cursor skill is out of date.[/bold]\n"
                "Run: [cyan]swarm-debug install-cursor-skill[/cyan]",
                title="Skill Outdated",
                border_style="red",
            ))


def _check_package_staleness(current_version: str):
    from packaging.version import Version, InvalidVersion

    try:
        url = "https://pypi.org/pypi/swarm-debug/json"
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=2) as resp:
            data = json.loads(resp.read())
        latest = data["info"]["version"]
        if Version(latest) > Version(current_version):
            _err_console.print(Panel(
                f"[bold]A newer swarm-debug is available: [green]{latest}[/green][/bold]\n"
                f"You are running: [red]{current_version}[/red]\n"
                "Run: [cyan]swarm-debug --upgrade[/cyan]",
                title="Update Available",
                border_style="yellow",
            ))
    except (urllib.error.URLError, TimeoutError, KeyError,
            json.JSONDecodeError, InvalidVersion, OSError):
        pass


def _check_all_staleness(current_version: str):
    _check_skill_not_installed()
    _check_skill_staleness()
    _check_package_staleness(current_version)


def _get_version() -> str:
    try:
        return pkg_version("swarm-debug")
    except Exception:
        return "0.0.0-dev"


def _version_callback(value: bool):
    if value:
        ver = _get_version()
        _check_all_staleness(ver)
        _console.print(f"swarm-debug {ver}")
        raise typer.Exit()


def _fetch_latest_version() -> str:
    """Fetch the latest version string from PyPI's JSON API."""
    url = "https://pypi.org/pypi/swarm-debug/json"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read())
    return data["info"]["version"]


def _upgrade_callback(value: bool):
    if not value:
        return

    old_ver = _get_version()
    _console.print(f"[bold]Upgrading swarm-debug[/bold] (current: {old_ver})…")

    try:
        latest = _fetch_latest_version()
    except (urllib.error.URLError, TimeoutError, KeyError,
            json.JSONDecodeError, OSError) as exc:
        _err_console.print(Panel(
            f"[bold red]Could not reach PyPI[/bold red]\n{exc}",
            border_style="red",
        ))
        raise typer.Exit(code=1)

    if latest == old_ver:
        _console.print(Panel(
            f"[bold]Already up to date:[/bold] swarm-debug {old_ver}",
            border_style="green",
        ))
        raise typer.Exit()

    pip_cmd = [sys.executable, "-m", "pip", "install", "--no-cache-dir", f"swarm-debug=={latest}"]
    max_attempts = 4
    delays = [5, 10, 20]

    with _console.status(
        f"Installing swarm-debug==[bold]{latest}[/bold] …", spinner="dots",
    ) as status:
        for attempt in range(1, max_attempts + 1):
            result = subprocess.run(pip_cmd, capture_output=True, text=True)

            if result.returncode == 0:
                break

            if attempt < max_attempts and "No matching distribution" in result.stderr:
                wait = delays[attempt - 1]
                status.update(
                    f"[yellow]Version {latest} not yet available on the CDN. "
                    f"Retrying in {wait}s ({attempt}/{max_attempts})…[/yellow]"
                )
                time.sleep(wait)
                status.update(f"Installing swarm-debug==[bold]{latest}[/bold] …")
            else:
                status.stop()
                _err_console.print(Panel(
                    f"[bold red]Upgrade failed[/bold red]\n{result.stderr.strip()}",
                    border_style="red",
                ))
                raise typer.Exit(code=1)

    _console.print(Panel(
        f"[bold green]Upgraded![/bold green] {old_ver} → {latest}",
        border_style="green",
    ))

    raise typer.Exit()


def _help_all_callback(ctx: typer.Context, value: bool):
    if not value:
        return

    click_group = ctx.command
    ver = _get_version()

    _console.print()
    _console.print(Panel(
        f"[bold cyan]swarm-debug[/bold cyan] [dim]{ver}[/dim] — Full Command Reference",
        border_style="bright_cyan",
    ))

    for cmd_name in click_group.list_commands(ctx):
        cmd = click_group.get_command(ctx, cmd_name)
        desc = cmd.help or ""

        header = Text()
        header.append(f"  {cmd_name}", style="bold cyan")
        header.append(f"  {desc}", style="dim")
        _console.print(header)

        args = [p for p in cmd.params if isinstance(p, click.Argument)]
        opts = [p for p in cmd.params if isinstance(p, click.Option) and p.name != "help"]

        if args:
            for a in args:
                type_name = a.type.name.upper() if hasattr(a.type, "name") else "VALUE"
                required = " [dim](required)[/dim]" if a.required else " [dim](optional)[/dim]"
                help_text = getattr(a, "help", None) or ""
                _console.print(
                    f"        [green]{a.name.upper():<16}[/green]"
                    f"[yellow]{type_name:<10}[/yellow]"
                    f"{help_text}{required}"
                )

        if opts:
            for o in opts:
                flag_str = " / ".join(o.opts)
                default = f" [dim]\\[default: {o.default}][/dim]" if o.default is not None and o.default is not False else ""
                help_text = o.help or ""
                _console.print(
                    f"        [green]{flag_str:<16}[/green]"
                    f"{help_text}{default}"
                )

        if not args and not opts:
            _console.print("        [dim](no arguments or options)[/dim]")

        _console.print()

    api_table = Table(
        title="API-Only Endpoints (no CLI equivalent)",
        show_header=True,
        border_style="bright_cyan",
        title_style="bold",
    )
    api_table.add_column("Method", style="bold yellow", width=8)
    api_table.add_column("Endpoint", style="cyan")
    api_table.add_column("Description")
    api_table.add_row("POST", "/api/debugger/reset_color", "Reset all colors to defaults (individually, without resetting emojis)")
    api_table.add_row("POST", "/api/debugger/reset_emoji", "Reset all emojis to defaults (individually, without resetting colors)")
    api_table.add_row("GET", "/api/debugger/pull_structure", "Fetch the full debug tree as JSON")
    api_table.add_row("POST", "/api/debugger/push_structure", "Push a modified debug tree")
    api_table.add_row("GET", "/api/debugger/events", "SSE stream — emits events when toggles change on disk")
    _console.print(api_table)

    _console.print()
    _console.print("[dim]Access these via the GUI ([cyan]swarm-debug gui[/cyan]) or directly at [cyan]http://localhost:6969/docs[/cyan][/dim]")
    _console.print()

    raise typer.Exit()


_SKIP_STALENESS_COMMANDS = {"install-cursor-skill", "uninstall-cursor-skill"}


@app.callback(invoke_without_command=True)
def _callback(
    ctx: typer.Context,
    version: bool = typer.Option(
        False, "--version", "-V", callback=_version_callback, is_eager=True,
        help="Show version and exit.",
    ),
    upgrade: bool = typer.Option(
        False, "--upgrade", callback=_upgrade_callback, is_eager=True,
        help="Upgrade swarm-debug to the latest version.",
    ),
    help_all: bool = typer.Option(
        False, "--help-all", "-H", callback=_help_all_callback, is_eager=True,
        help="Show detailed help for all commands.",
    ),
):
    if ctx.invoked_subcommand not in _SKIP_STALENESS_COMMANDS:
        _check_all_staleness(_get_version())


@app.command()
def gui(
    port: int = typer.Option(DEFAULT_PORT, "--port", "-p",
                             help=f"Port for the GUI server (default: {DEFAULT_PORT})"),
    verbose: bool = typer.Option(False, "--verbose", "-v",
                                 help="Show all server logs in the terminal."),
):
    """Launch the debug configuration GUI."""
    import os
    os.environ["SWARM_DEBUG_VERBOSE"] = "1" if verbose else "0"
    from swarm_debug.server import start_server
    start_server(port=port, open_browser=True, verbose=verbose)


@app.command()
def status(
    json_output: bool = typer.Option(False, "--json", help="Output as JSON"),
):
    """Show the debug toggle tree."""
    from swarm_debug.core.toggle_ops import load_tree, print_status
    tree = load_tree(quiet=json_output)
    print_status(tree, json_mode=json_output)


@app.command()
def toggle(
    state: State = typer.Argument(..., help="Desired state"),
    path: Optional[str] = typer.Argument(None, help="Relative path (e.g. src/utils/helpers.py)"),
    all_files: bool = typer.Option(False, "--all", help="Toggle all files"),
):
    """Toggle debug output for a file or directory."""
    from swarm_debug.core.toggle_ops import load_tree, save_tree, toggle_all, toggle_node

    tree = load_tree()

    if all_files:
        toggle_all(tree, state == State.on)
        save_tree(tree)
        label = "[green]ON[/green]" if state == State.on else "[red]OFF[/red]"
        _console.print(f"Toggled all files {label}")
        return

    if not path:
        _err_console.print("[red]Error:[/red] a path is required (or use --all)")
        raise typer.Exit(code=1)

    on = state == State.on
    if toggle_node(tree, path, on):
        save_tree(tree)
        label = "[green]ON[/green]" if on else "[red]OFF[/red]"
        _console.print(f"Toggled [bold]'{path}'[/bold] {label}")
    else:
        _err_console.print(f"[red]Error:[/red] path '{path}' not found in the debug tree")
        raise typer.Exit(code=1)


@app.command("set-root")
def set_root(
    path: str = typer.Argument(..., help="Absolute or relative path to the project root"),
):
    """Set the project root directory."""
    from swarm_debug.core.DEFAULTS import set_root_dir
    from swarm_debug.core.data_dir import get_data_file

    abs_path = os.path.abspath(path)
    if not os.path.isdir(abs_path):
        _err_console.print(f"[red]Error:[/red] '{abs_path}' is not a valid directory")
        raise typer.Exit(code=1)

    set_root_dir(abs_path)
    needs_resync_file = get_data_file("needs_resync.txt", abs_path)
    with open(needs_resync_file, "w") as f:
        f.write("1")
    _console.print(f"Project root set to: [bold]{abs_path}[/bold]")


@app.command("set-color")
def set_color(
    path: str = typer.Argument(..., help="Relative path to the file or directory"),
    color: str = typer.Argument(..., help="Hex color (e.g. #ff0000)"),
):
    """Set a node's debug output color."""
    from swarm_debug.core.toggle_ops import load_tree, save_tree, set_node_color

    tree = load_tree()
    if set_node_color(tree, path, color):
        save_tree(tree)
        _console.print(f"Set color of [bold]'{path}'[/bold] to [{color}]{color}[/]")
    else:
        if not color.startswith("#") or len(color) != 7:
            pass
        else:
            _err_console.print(f"[red]Error:[/red] path '{path}' not found in the debug tree")
        raise typer.Exit(code=1)


@app.command("set-emoji")
def set_emoji(
    path: str = typer.Argument(..., help="Relative path to the file or directory"),
    emoji: str = typer.Argument(..., help="Emoji character"),
):
    """Set a node's debug output emoji."""
    from swarm_debug.core.toggle_ops import load_tree, save_tree, set_node_emoji

    tree = load_tree()
    if set_node_emoji(tree, path, emoji):
        save_tree(tree)
        _console.print(f"Set emoji of [bold]'{path}'[/bold] to {emoji}")
    else:
        _err_console.print(f"[red]Error:[/red] path '{path}' not found in the debug tree")
        raise typer.Exit(code=1)


@app.command()
def reset():
    """Reset all colors and emojis to defaults."""
    typer.confirm("This will reset all colors and emojis to defaults. Continue?", abort=True)

    from swarm_debug.core.toggle_ops import load_tree, reset_all, save_tree

    tree = load_tree()
    reset_all(tree)
    save_tree(tree)
    _console.print("[green]Reset all colors and emojis to defaults[/green]")


@app.command("install-cursor-skill")
def install_cursor_skill():
    """Install the swarm-debug Cursor AI skill to .cursor/skills/ in the project root."""
    if not _SKILL_SRC.exists():
        _err_console.print("[red]Error:[/red] bundled SKILL.md not found in package data")
        raise typer.Exit(code=1)

    dst_dir = _skill_dst_dir()
    dst = _skill_dst()

    if dst.exists():
        if filecmp.cmp(_SKILL_SRC, dst, shallow=False):
            _console.print(Panel(f"[bold yellow]Cursor skill is already up to date:[/bold yellow] [dim]{dst}[/dim]"))
            return
        shutil.copy2(_SKILL_SRC, dst)
        action = "updated"
    else:
        dst_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(_SKILL_SRC, dst)
        action = "installed"

    _console.print(Panel(
        f"[green]Cursor skill {action}[/green]: {dst}\n"
        "[yellow]Tip: this will be kept in sync automatically whenever you use any swarm-debug command.[/yellow]",
        border_style="green",
    ))


@app.command("uninstall-cursor-skill")
def uninstall_cursor_skill():
    """Remove the swarm-debug Cursor AI skill from .cursor/skills/ in the project root."""
    dst_dir = _skill_dst_dir()

    if not dst_dir.exists():
        _console.print(Panel("[red]Cursor skill is not installed, nothing to remove.[/red]"))
        return

    typer.confirm("Remove the Cursor skill?", default=True, abort=True)
    shutil.rmtree(dst_dir)
    for parent in (dst_dir.parent, dst_dir.parent.parent):
        try:
            parent.rmdir()
        except OSError:
            break
    _console.print(Panel(f"[red]Cursor skill removed[/red]: {dst_dir}"))


@app.command()
def cheatsheet():
    """Print common debug() recipes and options."""
    from rich.syntax import Syntax

    _console.print()
    _console.print(Panel(
        "[bold cyan]swarm-debug[/bold cyan] — [bold]debug()[/bold] library cheatsheet",
        border_style="bright_cyan",
    ))

    basics = (
        "from swarm_debug import debug\n\n"
        'debug(value)                  # name + type + value\n'
        'debug("a message")            # plain message (italic)\n'
        'debug("x=%s", x)              # %-style formatting\n'
        'debug(exc)                    # exceptions auto-highlight in red'
    )
    _console.print("[bold]Basics[/bold]")
    _console.print(Syntax(basics, "python", theme="monokai", background_color="default"))

    opts = Table(title="Options", show_header=True, border_style="bright_cyan", title_style="bold")
    opts.add_column("Kwarg", style="bold cyan")
    opts.add_column("Default", style="yellow")
    opts.add_column("What it does")
    opts.add_row("mode", '"debug"', 'Log level: "all", "debug", "test"')
    opts.add_row("pretty", "True", "Pretty-print dicts/lists/dataclasses (False = flat)")
    opts.add_row("lang", "None", 'Syntax-highlight strings, e.g. "sql", "json", "html"')
    opts.add_row("table", "auto", "Table layout; auto-on for >1 data arg")
    opts.add_row("sep", "—", "Join all args into one line with this separator")
    opts.add_row("override_max_chars", "False", "Bypass the 3000-char truncation limit")
    opts.add_row("error", "None", "Force error styling on/off (None = auto via BaseException)")
    _console.print(opts)

    recipes = (
        "debug(my_dict)                 # Rich pretty-print\n"
        "debug(my_dict, pretty=False)   # flat single line\n"
        'debug(sql_query, lang="sql")   # SQL keyword highlighting\n'
        "debug(x, y, z)                 # auto table: Name | Type | Value\n"
        "debug(x, table=False)          # force one line per arg\n"
        'debug("loading config", error=True)  # force error styling\n\n'
        "debug.diff(old_state, new_state)          # unified, syntax-highlighted diff\n"
        'debug.diff(old, new, label="state")       # custom label\n\n'
        'with debug.time("database query"):        # green/yellow/red by duration\n'
        "    result = db.execute(query)"
    )
    _console.print("[bold]Pretty-printing, diffs & timing[/bold]")
    _console.print(Syntax(recipes, "python", theme="monokai", background_color="default"))

    visibility = (
        "swarm-debug toggle on  src/core/engine.py   # one file\n"
        "swarm-debug toggle off src/agents/          # a whole directory\n"
        "swarm-debug toggle on  --all                # everything\n"
        'swarm-debug set-color  src/core/ "#ff0000"  # color a file/dir\n'
        'swarm-debug set-emoji  src/core/ "🔥"        # emoji a file/dir\n'
        "swarm-debug gui                             # web UI at localhost:6969"
    )
    _console.print("[bold]Controlling visibility (no code changes)[/bold]")
    _console.print(Syntax(visibility, "bash", theme="monokai", background_color="default"))
    _console.print()


@app.command()
def stats():
    """Show a flat table of all debug files with their status, color, and emoji."""
    from swarm_debug.core.DEFAULTS import get_root_dir
    from swarm_debug.core.models.DebugFile import DebugFile
    from swarm_debug.core.models.Directory import Directory
    from swarm_debug.core.toggle_ops import load_tree

    tree = load_tree(quiet=True)

    table = Table(title=f"Debug Files — {get_root_dir()}")
    table.add_column("Path", style="bold")
    table.add_column("Status", justify="center")
    table.add_column("Color", justify="center")
    table.add_column("Emoji", justify="center")

    def _walk(node, depth=0):
        if isinstance(node, DebugFile):
            status_str = "[green]ON[/green]" if node.is_toggled else "[red]OFF[/red]"
            color_block = f"[{node.color}]██[/]"
            table.add_row(node.path, status_str, color_block, node.emoji)
        elif isinstance(node, Directory):
            for child in node.children:
                _walk(child, depth + 1)

    _walk(tree)
    _console.print(table)


def main():
    app()
