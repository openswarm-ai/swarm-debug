import asyncio
import logging
import json
import os
from swarm_debug.config.Apps import SubApp
from swarm_debug.core.models.project_scanner import update_debug_toggles, dir_to_output_format
from swarm_debug.core.data_dir import get_data_file
from swarm_debug.core.DEFAULTS import get_root_dir, set_root_dir
from contextlib import asynccontextmanager
from fastapi.responses import JSONResponse
from starlette.responses import StreamingResponse
from typeguard import typechecked

log = logging.getLogger(__name__)


@asynccontextmanager
async def debugger_lifespan():
    log.debug("debugger_lifespan START")
    yield
    log.debug("debugger_lifespan END")


debugger = SubApp("debugger", debugger_lifespan)


@debugger.router.get("/pull_structure")
@typechecked
def pull_structure() -> JSONResponse:
    log.info("GET /api/debugger/pull_structure")
    scanned_dir = update_debug_toggles(save_to_file=False)
    output = dir_to_output_format(scanned_dir)
    return JSONResponse(content=output)


@debugger.router.post("/push_structure")
@typechecked
async def push_structure(data: dict) -> JSONResponse:
    log.info("POST /api/debugger/push_structure")
    root = get_root_dir()
    toggle_file = get_data_file("debug_toggles.json", root)
    needs_resync_file = get_data_file("needs_resync.txt", root)
    project_structure = data['projectStructure']
    with open(toggle_file, 'w', encoding='utf-8') as file:
        json.dump(project_structure, file, indent=4)
    with open(needs_resync_file, 'w') as f:
        f.write('1')
    return JSONResponse(content={"status": "success"})


@debugger.router.post("/reset_color")
@typechecked
def reset_color() -> JSONResponse:
    log.info("POST /api/debugger/reset_color")
    scanned_dir = update_debug_toggles(save_to_file=False)
    scanned_dir.reset_colors()
    output = dir_to_output_format(scanned_dir)
    return JSONResponse(content=output)


@debugger.router.post("/reset_emoji")
@typechecked
def reset_emoji() -> JSONResponse:
    log.info("POST /api/debugger/reset_emoji")
    scanned_dir = update_debug_toggles(save_to_file=False)
    scanned_dir.reset_emojis()
    output = dir_to_output_format(scanned_dir)
    return JSONResponse(content=output)


@debugger.router.get("/events")
async def events():
    toggle_file = get_data_file("debug_toggles.json", get_root_dir())

    async def event_stream():
        last_mtime = os.path.getmtime(toggle_file)
        while True:
            await asyncio.sleep(1)
            try:
                current_mtime = os.path.getmtime(toggle_file)
            except OSError:
                continue
            if current_mtime > last_mtime:
                last_mtime = current_mtime
                yield 'data: {"type": "resync"}\n\n'

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@debugger.router.get("/root_dir")
@typechecked
async def get_root() -> JSONResponse:
    log.info("GET /api/debugger/root_dir")
    return JSONResponse(content={"root_dir": get_root_dir()})


@debugger.router.post("/root_dir")
@typechecked
async def set_root(data: dict) -> JSONResponse:
    log.info("POST /api/debugger/root_dir")
    path = data.get("root_dir", "")
    if not path or not os.path.isdir(path):
        return JSONResponse(content={"error": "Invalid directory path"}, status_code=400)
    set_root_dir(path)
    needs_resync_file = get_data_file("needs_resync.txt", path)
    with open(needs_resync_file, 'w') as f:
        f.write('1')
    return JSONResponse(content={"root_dir": get_root_dir()})
