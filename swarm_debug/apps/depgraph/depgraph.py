import logging
from contextlib import asynccontextmanager

from fastapi.responses import JSONResponse
from typeguard import typechecked

from swarm_debug.config.Apps import SubApp
from swarm_debug.core.DEFAULTS import get_root_dir
from swarm_debug.core.depgraph.scanner import scan_root

log = logging.getLogger(__name__)


@asynccontextmanager
async def depgraph_lifespan():
    log.debug("depgraph_lifespan START")
    yield
    log.debug("depgraph_lifespan END")


depgraph = SubApp("depgraph", depgraph_lifespan)


@depgraph.router.get("/scan")
@typechecked
def scan() -> JSONResponse:
    """Scan the current project root and return its dependency graph."""
    log.info("GET /api/depgraph/scan")
    payload = scan_root(get_root_dir())
    return JSONResponse(content=payload)
