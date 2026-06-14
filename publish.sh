#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Parse args ────────────────────────────────────────────────
TARGET=""
for arg in "$@"; do
    case "$arg" in
        --test) TARGET="test" ;;
        --real) TARGET="real" ;;
        *)
            echo "Unknown argument: $arg"
            echo "Usage: ./publish.sh --test | --real"
            exit 1
            ;;
    esac
done

if [ -z "$TARGET" ]; then
    echo "ERROR: You must specify --test or --real"
    echo ""
    echo "  ./publish.sh --test   # upload to test.pypi.org"
    echo "  ./publish.sh --real   # upload to pypi.org"
    exit 1
fi

# ── Check prerequisites ──────────────────────────────────────
for cmd in python3 npm; do
    if ! command -v "$cmd" &>/dev/null; then
        echo "ERROR: $cmd is not installed."
        exit 1
    fi
done

if ! python3 -m build --version &>/dev/null; then
    echo "ERROR: 'build' package not found. Install it with:"
    echo "  pip install build"
    exit 1
fi

if ! python3 -m twine --version &>/dev/null 2>&1; then
    echo "ERROR: 'twine' package not found. Install it with:"
    echo "  pip install twine"
    exit 1
fi

# ── Version gate ──────────────────────────────────────────────
LOCAL_VERSION=$(python3 -c "
import re, pathlib
text = pathlib.Path('$ROOT_DIR/pyproject.toml').read_text()
m = re.search(r'^version\s*=\s*\"([^\"]+)\"', text, re.MULTILINE)
print(m.group(1))
")

if [ "$TARGET" = "test" ]; then
    PYPI_URL="https://test.pypi.org/pypi/swarm-debug/json"
else
    PYPI_URL="https://pypi.org/pypi/swarm-debug/json"
fi

PYPI_VERSION=$(python3 -c "
import json, urllib.request
data = json.loads(urllib.request.urlopen('$PYPI_URL').read())
print(data['info']['version'])
" 2>/dev/null || echo "")

if [ -z "$PYPI_VERSION" ]; then
    echo "⚠  Could not fetch PyPI version. Continuing with local version $LOCAL_VERSION."
else
    echo "Local version:  $LOCAL_VERSION"
    echo "PyPI version:   $PYPI_VERSION"

    if [ "$LOCAL_VERSION" = "$PYPI_VERSION" ]; then
        NEXT_VERSION=$(python3 -c "
parts = '$LOCAL_VERSION'.split('.')
parts[-1] = str(int(parts[-1]) + 1)
print('.'.join(parts))
")
        echo ""
        echo "Version $LOCAL_VERSION is already published."
        echo "Suggested bump: $LOCAL_VERSION -> $NEXT_VERSION"
        echo ""
        read -rp "Approve version bump to $NEXT_VERSION? [Y/n] " answer
        case "$answer" in
            [nN]|[nN][oO])
                echo "Aborted."
                exit 0
                ;;
            *)
                python3 -c "
import pathlib, re
p = pathlib.Path('$ROOT_DIR/pyproject.toml')
text = p.read_text()
text = re.sub(
    r'^(version\s*=\s*\")([^\"]+)(\")',
    r'\g<1>${NEXT_VERSION}\3',
    text,
    count=1,
    flags=re.MULTILINE,
)
p.write_text(text)
"
                LOCAL_VERSION="$NEXT_VERSION"
                echo "Updated pyproject.toml to $LOCAL_VERSION."
                ;;
        esac
    else
        echo "Version $LOCAL_VERSION differs from published ($PYPI_VERSION). Proceeding."
    fi
fi

# ── Clean previous artifacts ─────────────────────────────────
echo "Cleaning previous build artifacts..."
rm -rf "$ROOT_DIR/dist" \
       "$ROOT_DIR/build" \
       "$ROOT_DIR"/*.egg-info \
       "$ROOT_DIR/swarm_debug/debugger_gui_build"

# ── Build frontend ───────────────────────────────────────────
echo "Building frontend..."
cd "$ROOT_DIR/frontend"
npm ci
npm run build

# ── Copy frontend build into the Python package ──────────────
echo "Copying frontend build to swarm_debug/debugger_gui_build/..."
cp -r "$ROOT_DIR/frontend/dist" "$ROOT_DIR/swarm_debug/debugger_gui_build"

# ── Build Python sdist + wheel ───────────────────────────────
echo "Building Python package..."
cd "$ROOT_DIR"
python3 -m build

# ── Upload ───────────────────────────────────────────────────
if [ "$TARGET" = "test" ]; then
    echo ""
    echo "Uploading to TEST PyPI (test.pypi.org)..."
    python3 -m twine upload --repository testpypi dist/*
    echo ""
    echo "Done! Install with:"
    echo "  pip install -i https://test.pypi.org/simple/ swarm-debug"
else
    echo ""
    echo "Uploading to PyPI (pypi.org)..."
    python3 -m twine upload dist/*
    echo ""
    echo "Done! Install with:"
    echo "  pip install swarm-debug"
fi
