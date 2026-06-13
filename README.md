# swarm-debug

A drop-in replacement for `print()` debugging. Colorized, per-file toggleable output with a visual web GUI to control it all.

```bash
pip install swarm-debug
```

## What it does

`debug()` works like `print()`, but every call is:

- **Colorized** -- each file gets its own color so you can visually separate output
- **Toggleable** -- turn debug output on/off per file or entire directories without touching code
- **Context-aware** -- automatically shows the calling function, class, variable name, and indentation level
- **Emoji-tagged** -- assign emojis to files for instant visual scanning
- **Error-aware** -- exceptions are auto-highlighted in red with a dedicated emoji

All configuration is managed through a web GUI or the CLI. No config files to write, no decorators to add.

## Usage

### 1. Add `debug()` calls to your code

```python
from swarm_debug import debug

x = 42
debug(x)
# ⚫ [my_script.py] : x: int = 42

debug("loading config")
# ⚫ [my_script.py] : loading config

def process(data):
    debug(data, len(data))
    # ⚫ [MyClass.process] : (table with Name | Type | Value columns)
```

Strings are rendered as italic labels. Everything else shows `name: type = value`. Multiple non-text args are auto-rendered as a Rich table. Exceptions (any `BaseException`) are auto-detected and forced on in red regardless of toggle state; pass `error=True`/`error=False` to override.

#### Full signature

```python
debug(*args, mode='debug', override_max_chars=False, sep=<auto>, end='\n',
      pretty=True, lang=None, table=<auto>, error=None)
```

| Kwarg | Type | Default | Description |
|---|---|---|---|
| `mode` | `str` | `"debug"` | Log level. `"all"` (always), `"debug"` (default), `"test"` (high priority) |
| `override_max_chars` | `bool` | `False` | Bypass the 3000-char truncation limit |
| `sep` | `str` | auto | Join all args with this separator (like `print(sep=...)`) |
| `pretty` | `bool` | `True` | Pretty-print dicts, lists, sets, tuples, dataclasses with Rich |
| `lang` | `str\|None` | `None` | Syntax-highlight all args as this language (e.g. `"sql"`, `"json"`) |
| `table` | `bool` | auto | Force table layout on/off. Auto-on when >1 non-text data args |
| `error` | `bool\|None` | `None` | Force error styling (red/❌, force-visible). `True` on, `False` off, `None` auto-detects via `isinstance(arg, BaseException)` |

#### Error styling (explicit `error=`)

```python
debug(ValueError("boom"))             # exception -> auto red/❌, prints even if toggled OFF
debug("loading config", error=True)   # force error styling on any value
debug(exc, error=False)               # opt out, respects toggle state
```

Detection is type-based: only real `BaseException` instances auto-highlight. Ordinary strings/paths that merely contain the word "error" are **not** styled red unless you pass `error=True`.

#### Pretty-printed data structures (on by default)

```python
debug(my_dict)                 # dicts, lists, sets, dataclasses are pretty-printed with Rich
debug(my_dict, pretty=False)   # opt out for flat single-line output
```

#### Syntax-highlighted strings (explicit `lang=`)

```python
debug(sql_query, lang="sql")       # SQL keyword highlighting
debug(json_string, lang="json")    # JSON syntax coloring
debug(html_body, lang="html")      # HTML highlighting
```

#### Table layout (auto when >1 non-text data args)

```python
debug(x, y, z)               # 3 data args -> table with Name | Type | Value columns
debug(x)                     # single arg -> inline output
debug(x, y, z, table=False)  # force per-line output
debug(x, table=True)         # force table even for a single arg
```

#### Diff output

```python
debug.diff(old_state, new_state)                # unified diff, default label "diff"
debug.diff(old_state, new_state, label="state") # custom label
```

#### Timing

```python
with debug.time("database query"):
    result = db.execute(query)
# prints: [func] : ⏱ database query took 0.123s  (green/yellow/red based on duration)
```

#### Other features

- **Clickable links** -- function names in the output are OSC 8 hyperlinks (`file://path#line`) in supported terminals (iTerm2, Windows Terminal)
- **Truncation** -- values over 3000 chars are truncated (first 1500 + `...` + last 1500). Pass `override_max_chars=True` to disable.
- **Indent bars** -- `debug()` reads source indentation and renders nested output with visual indent bars

### 2. Launch the GUI

```bash
swarm-debug gui
swarm-debug gui --port 8080     # custom port
swarm-debug gui --verbose       # show all server logs
```

Your browser opens automatically to [http://localhost:6969](http://localhost:6969). You'll see a file tree of your project showing every file that calls `debug()`. From there you can:

- Toggle files/directories on and off
- Assign custom colors per file or directory (children inherit from parents)
- Assign emojis for visual tagging
- Push/pull configuration changes
- Reset colors or emojis to defaults

The server scans whichever directory you launched it from. To point it at a different project:

```bash
# Option A: cd into the project first
cd /path/to/my/project && swarm-debug gui

# Option B: set an env var
SWARM_DEBUG_ROOT=/path/to/my/project swarm-debug gui

# Option C: use the CLI
swarm-debug set-root /path/to/my/project

# Option D: use the API
curl -X POST http://localhost:6969/api/debugger/root_dir \
  -H "Content-Type: application/json" \
  -d '{"root_dir": "/path/to/my/project"}'
```

The root dir persists across restarts (saved per-project to `~/.swarm-debug/projects/<hash>/root_dir.txt`).

### 3. CLI reference

All commands work standalone (no server required). Paths are relative to project root.

```bash
# View current state
swarm-debug status              # human-readable tree with [ON]/[OFF] tags
swarm-debug status --json       # machine-readable JSON (pipe to jq, python, etc.)
swarm-debug stats               # flat table of all files with path/status/color/emoji
swarm-debug cheatsheet          # print common debug() recipes and options

# Toggle visibility
swarm-debug toggle on  src/agents/planner.py    # single file
swarm-debug toggle off src/agents/              # whole directory (recursive)
swarm-debug toggle on  --all                    # everything

# Configuration
swarm-debug set-root /path/to/project
swarm-debug set-color src/agents/planner.py "#ff0000"  # single file
swarm-debug set-color src/agents/ "#ff0000"            # directory (children get lightened variant)
swarm-debug set-emoji src/agents/planner.py "🔴"       # single file
swarm-debug set-emoji src/agents/ "🔴"                 # directory (propagates to children)
swarm-debug reset                                      # reset all colors/emojis (with confirmation)

# Cursor AI skill
swarm-debug install-cursor-skill    # copy SKILL.md to .cursor/skills/swarm-debug/
swarm-debug uninstall-cursor-skill  # remove the skill directory

# Package management
swarm-debug --version           # show version + check for updates
swarm-debug --upgrade           # upgrade to latest version from PyPI
swarm-debug --help-all          # detailed help for all commands + API-only endpoints
```

### Configuration storage

All runtime state lives in `~/.swarm-debug/projects/<hash>/` (where `<hash>` is the first 16 chars of the SHA-256 of the project root path):

| File | Purpose |
|------|---------|
| `debug_toggles.json` | Per-file toggle, color, and emoji state |
| `root_dir.txt` | Persisted project root directory |
| `log_mode.txt` | Log output mode (`all`, `debug`, `test`) |
| `needs_resync.txt` | Internal flag for syncing state |

### API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health/check` | Health check |
| GET | `/api/debugger/pull_structure` | Get file tree with toggle states |
| POST | `/api/debugger/push_structure` | Save toggle/color/emoji config |
| POST | `/api/debugger/reset_color` | Reset all colors to defaults |
| POST | `/api/debugger/reset_emoji` | Reset all emojis to defaults |
| GET | `/api/debugger/events` | SSE stream — emits events when toggles change on disk |
| GET | `/api/debugger/root_dir` | Get current project root |
| POST | `/api/debugger/root_dir` | Set project root (triggers resync) |

Full interactive docs at [http://localhost:6969/docs](http://localhost:6969/docs).

---

## Development (source)

### Prerequisites

- Python 3.9+
- Node.js 18+

### Running locally

Both services (backend on `:6970`, frontend dev server on `:6969`):

```bash
bash run.sh
```

Individually:

```bash
bash backend/run.sh    # Creates venv, installs package in editable mode, runs uvicorn on :6970
bash frontend/run.sh   # npm install + webpack dev server on :6969
```

### Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, TypeScript, Webpack 5, MUI v7, Redux Toolkit, Framer Motion |
| Backend | FastAPI, Uvicorn, Python 3.9+ |
| Runtime types | typeguard (`@typechecked` on endpoints) |
| CLI | Typer (built on Click) |
| Terminal rendering | Rich (Pretty, Syntax, Table, Panel, Console) |

### Architecture

**Server** (`swarm_debug/server.py`) uses a SubApp pattern -- each feature is a self-contained module with its own APIRouter and async lifespan, auto-mounted at `/api/{name}/`. SubApps are registered in `swarm_debug/config/Apps.py` and composed into the FastAPI app in `swarm_debug/server.py`.

**Frontend** uses a custom design token system layered on MUI, accessed via `useClaudeTokens()`. See `frontend/DESIGN.md` for the full spec.

**Debugleton** is a thread-safe singleton that holds the scanned project tree in memory and resyncs when the `needs_resync` flag is set (after any push from the GUI or CLI).

### Project structure

```
debugger/
├── swarm_debug/                     # The pip-installable Python package
│   ├── __init__.py                  # The debug() function + debug.diff + debug.time
│   ├── cli.py                       # Typer CLI app (swarm-debug command)
│   ├── server.py                    # FastAPI + Uvicorn entrypoint
│   ├── config/
│   │   └── Apps.py                  # SubApp / MainApp framework
│   ├── apps/
│   │   ├── health/health.py         # GET /api/health/check
│   │   └── debugger/debugger.py     # All debugger API endpoints
│   ├── core/
│   │   ├── data_dir.py              # ~/.swarm-debug/ path management
│   │   ├── DEFAULTS.py              # Default values, get/set_root_dir
│   │   ├── Debugleton.py            # Thread-safe singleton for project state
│   │   ├── toggle_ops.py            # CLI tree operations: toggle, color, emoji, reset
│   │   ├── models/
│   │   │   ├── File.py              # Base file class
│   │   │   ├── DebugFile.py         # File with color/toggle/emoji
│   │   │   ├── Directory.py         # Recursive directory tree
│   │   │   └── project_scanner.py   # Scan project, merge with saved state
│   │   ├── log/
│   │   │   ├── log_config.py        # Custom logger with modes
│   │   │   └── log_mode.py          # Read/write log mode
│   │   └── utils/
│   │       ├── debug_arg_parser.py  # Extract arg names from source code
│   │       └── path_mngr.py         # Absolute/relative path helpers
│   ├── data/
│   │   └── SKILL.md                 # Cursor AI skill (bundled in package)
│   └── debugger_gui_build/          # Pre-built React frontend (ships with pip package)
├── backend/
│   ├── run.sh                       # Dev script: venv + editable install + uvicorn
│   ├── data/                        # Seed defaults for local dev
│   └── debugger_gui_build/          # Copy of built frontend for local dev
├── frontend/
│   ├── package.json
│   ├── webpack.config.js
│   ├── DESIGN.md                    # Design system specification
│   ├── run.sh                       # npm install + webpack dev server
│   └── src/
│       ├── index.tsx
│       ├── app/
│       │   ├── Main.tsx
│       │   ├── pages/Debugger/      # Debugger, DebuggerHeader
│       │   └── components/          # Tree, SyncSection, EmojiPicker, SettingsModal
│       └── shared/
│           ├── state/               # Redux store, slice, thunks
│           ├── styles/              # Theme tokens
│           └── constants/           # Emoji list
├── pyproject.toml                   # PyPI package config (swarm-debug)
├── publish.sh                       # Build + publish to PyPI
├── run.sh                           # Dev orchestrator: backend -> frontend
└── ports.conf                       # Port configuration (backend=6970, frontend=6969)
```

---

## Publishing to PyPI

Everything is handled by a single script:

```bash
# Publish to test.pypi.org (for testing)
./publish.sh --test

# Publish to pypi.org (for real)
./publish.sh --real
```

The script will:
1. Clean previous build artifacts
2. Build the React frontend (`npm ci && npm run build`)
3. Bundle the build into `swarm_debug/debugger_gui_build/`
4. Build the Python sdist + wheel
5. Upload via twine

### Prerequisites for publishing

```bash
pip install build twine
```

You'll need a PyPI account and API token. Configure `~/.pypirc` or pass credentials when prompted by twine.

### How the pip package works

When installed from PyPI, the pre-built React frontend is bundled inside the wheel at `swarm_debug/debugger_gui_build/`. The FastAPI server serves these static files alongside the API, so end users get both the GUI and the API on a single port (default 6969) with zero Node.js dependency.

Users import the `debug` function from the `swarm_debug` package: `from swarm_debug import debug`. The CLI (`swarm-debug gui`) launches the server.

## License

MIT
