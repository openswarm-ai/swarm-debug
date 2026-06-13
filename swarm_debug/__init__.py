import dataclasses
import difflib
import inspect
import io
import os
import pprint
import time as _time
from contextlib import contextmanager
from typing import Optional

from rich.console import Console
from rich.pretty import Pretty
from rich.rule import Rule
from rich.syntax import Syntax
from rich.table import Table
from rich.text import Text

from swarm_debug.core.log.log_config import log_config
from swarm_debug.core.Debugleton import Debugleton
from swarm_debug.core.utils.debug_arg_parser import (
    is_text, is_error, extract_debug_args, filter_kwargs, has_percent_format,
)

_SENTINEL = object()
_PRIMITIVES = (int, float, bool, type(None), str, bytes)

_string_buf = io.StringIO()
_rich_console = Console(file=_string_buf, highlight=False, color_system="truecolor")


def _render_rich(markup: str) -> str:
    """Render a Rich markup string to an ANSI-escaped string for the logger."""
    _string_buf.truncate(0)
    _string_buf.seek(0)
    _rich_console.print(markup, end="")
    _string_buf.seek(0)
    return _string_buf.read()


def _render_renderable(renderable) -> str:
    """Capture any Rich renderable object to an ANSI string."""
    _string_buf.truncate(0)
    _string_buf.seek(0)
    _rich_console.print(renderable, end="")
    _string_buf.seek(0)
    return _string_buf.read()


def _is_complex(value) -> bool:
    """True if the value should be pretty-printed (non-primitive structured data)."""
    if isinstance(value, _PRIMITIVES):
        return False
    if isinstance(value, (dict, list, set, tuple, frozenset)):
        return True
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return True
    if hasattr(value, '__dict__'):
        return True
    return False



def debug(*args, mode: str = 'debug', override_max_chars: bool = False,
          sep: str = _SENTINEL, end: str = '\n',
          pretty: bool = True, lang: Optional[str] = None,
          table: bool = _SENTINEL, error: Optional[bool] = None):
    """Drop-in replacement for print() with per-file colorized, toggleable output.

    Pass variables directly -- debug() inspects the call stack to recover the
    caller's file, function/class, variable names, and indentation. No format
    strings or manual labels needed.

        debug(user_id)            # [func] : user_id: int = 42
        debug("checkpoint")       # [func] : checkpoint   (italic text)
        debug(exc)                # exceptions auto-highlight red with a cross
        debug("x=%s y=%s", x, y)  # %-style formatting

    Visibility is controlled per-file/per-directory via the CLI (`swarm-debug
    toggle ...`) or the web GUI (`swarm-debug gui`) -- not in code. Only files
    toggled ON produce output.

    Args:
        *args: Values and/or messages to print. Strings render as messages;
            other objects render with their name, type, and value.
        mode: Log level. "all" (always shown), "debug" (default), "test"
            (high priority).
        override_max_chars: If True, bypass the 3000-char truncation limit.
        sep: If given, join all args into one line with this separator
            (like print(sep=...)).
        end: Line terminator (reserved; output is line-based).
        pretty: Pretty-print dicts/lists/sets/tuples/dataclasses with Rich.
            Set False for flat single-line output.
        lang: Syntax-highlight string args as this language, e.g. "sql",
            "json", "html".
        table: Force table layout on/off. Default (auto): on when more than one
            non-text data arg is passed, off otherwise.
        error: Override error styling (red + cross emoji, force-visible).
            True forces it on; False forces it off even for exceptions;
            None (default) auto-detects via isinstance(arg, BaseException).

    Examples:
        debug(my_dict)                       # pretty-printed structure
        debug(my_dict, pretty=False)         # flat
        debug(sql, lang="sql")               # SQL highlighting
        debug(x, y, z)                       # auto table (Name|Type|Value)
        debug(x, table=False)                # force per-line
        debug("loading config", error=True)  # force error styling

    See also:
        debug.diff(old, new, label="diff")   # unified diff of two values
        debug.time(label)                    # context manager that times a block
    """
    frame = inspect.currentframe().f_back
    code = frame.f_code
    line_no = frame.f_lineno
    calling_function_name = frame.f_code.co_name
    calling_file_name = os.path.basename(code.co_filename)
    if calling_function_name == "<module>":
        calling_function_name = calling_file_name
    file_path = os.path.abspath(code.co_filename)
    t_color, t_is_on, t_emoji = Debugleton().find_file_info(file_path)
    max_chars = 3000

    with open(code.co_filename, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    line = lines[line_no - 1]
    leading_spaces = len(line) - len(line.lstrip(' '))
    indent = leading_spaces // 4
    indent_str = ' |\t' * indent
    if indent > 0:
        indent_str = indent_str[:-3] + ' |-- '

    function_print_str = (calling_function_name if 'self' not in frame.f_locals
                          else f'{frame.f_locals["self"].__class__.__name__}.{calling_function_name}')

    arg_names = filter_kwargs(extract_debug_args(lines, line_no))

    if table is _SENTINEL:
        data_arg_count = sum(
            1 for name, val in zip(arg_names, args)
            if not is_text(val, name)
        )
        table = data_arg_count > 1

    link_uri = f"file://{file_path}#{line_no}"

    def _truncate(value):
        v_len = len(str(value))
        if v_len > max_chars and not override_max_chars:
            s = str(value)
            return s[:int(max_chars/2)] + "...\n..." + s[v_len-int(max_chars/2):]
        return value

    def _err(*values):
        """Resolve error state: explicit `error` kwarg wins; else BaseException type check."""
        if error is not None:
            return error
        return any(is_error(v) for v in values)

    def _prefix(is_error_line=False):
        """Build the colored prefix with clickable link. Returns (markup_str, effective_color, effective_is_on)."""
        nonlocal t_color, t_emoji, t_is_on
        color = t_color
        emoji = t_emoji
        is_on = t_is_on
        if is_error_line:
            color = "#FE3F3F"
            emoji = "❌"
            is_on = True
            t_color = color
            t_emoji = emoji
            t_is_on = is_on
        return f"{emoji}[{color}]{indent_str}[/][{color} link={link_uri}]\\[{function_print_str}][/][{color}] : [/]", color, is_on

    def _emit(text, is_error_line=False, bold_italic=False):
        pfx, color, is_on = _prefix(is_error_line)
        escaped_text = str(text).replace("[", "\\[")
        if bold_italic:
            content = f"[bold italic {color}]{escaped_text}[/]"
        else:
            content = f"[{color}]{escaped_text}[/]"
        if is_on:
            log_config.debug_custom(_render_rich(f"{pfx}{content}"), mode)

    def _emit_with_renderable(name, renderable, is_error_line=False, type_name=None):
        """Emit a prefix line followed by a Rich renderable (Pretty, Syntax, Table)."""
        pfx, color, is_on = _prefix(is_error_line)
        if not is_on:
            return
        if type_name:
            header = f"{pfx}[{color}]{_esc(name)}[/][dim]: {_esc(type_name)}[/][{color}] =[/]"
        else:
            header = f"{pfx}[{color}]{_esc(name)} =[/]"
        log_config.debug_custom(_render_rich(header), mode)
        log_config.debug_custom(_render_renderable(renderable), mode)

    # --- table mode: render all args in a table ---
    if table:
        pfx, color, is_on = _prefix(_err(*args))
        if is_on:
            t = Table(title=None, show_header=True, border_style=color)
            t.add_column("Name", style="bold")
            t.add_column("Type", style="dim")
            t.add_column("Value")
            for a_name, a_value in zip(arg_names, args):
                a_value = _truncate(a_value)
                t.add_row(a_name, type(a_value).__name__, Pretty(a_value))
            log_config.debug_custom(_render_rich(pfx), mode)
            log_config.debug_custom(_render_renderable(t), mode)
        return

    # --- syntax-highlighted lang mode ---
    if lang is not None:
        for a_name, a_value in zip(arg_names, args):
            err = _err(a_value)
            pfx, color, is_on = _prefix(err)
            if not is_on:
                continue
            header = f"{pfx}[{color}]{_esc(a_name)}[/][dim]: {_esc(type(a_value).__name__)}[/][{color}] =[/]"
            log_config.debug_custom(_render_rich(header), mode)
            syntax = Syntax(str(a_value), lang, theme="monokai", word_wrap=True)
            log_config.debug_custom(_render_renderable(syntax), mode)
        return

    # --- %-style formatting ---
    if (len(args) >= 2
            and isinstance(args[0], str)
            and has_percent_format(args[0])):
        try:
            formatted = args[0] % tuple(args[1:])
        except (TypeError, ValueError):
            formatted = args[0]
        formatted = _truncate(formatted)
        err = _err(*args[1:])
        _emit(formatted, is_error_line=err, bold_italic=True)
        return

    # --- sep= explicit join ---
    if sep is not _SENTINEL:
        joined = sep.join(str(a) for a in args)
        joined = _truncate(joined)
        err = _err(*args)
        _emit(joined, is_error_line=err, bold_italic=True)
        return

    # --- default per-argument output ---
    for arg_name, arg_value in zip(arg_names, args):
        arg_is_error = _err(arg_value)
        arg_is_text = is_text(arg_value, arg_name)

        arg_value = _truncate(arg_value)

        if arg_is_text:
            _emit(arg_value, is_error_line=arg_is_error, bold_italic=True)
        elif pretty and _is_complex(arg_value):
            type_name = type(arg_value).__name__
            _emit_with_renderable(arg_name, Pretty(arg_value), is_error_line=arg_is_error, type_name=type_name)
        else:
            type_name = type(arg_value).__name__
            pfx, color, is_on = _prefix(arg_is_error)
            if is_on:
                escaped_val = _esc(str(arg_value))
                line_markup = f"{pfx}[{color}]{_esc(arg_name)}[/][dim]: {_esc(type_name)}[/][{color}] = {escaped_val}[/]"
                log_config.debug_custom(_render_rich(line_markup), mode)


def _esc(text: str) -> str:
    """Escape Rich markup brackets in user text."""
    return str(text).replace("[", "\\[")


# ---------------------------------------------------------------------------
# debug.diff(old, new)
# ---------------------------------------------------------------------------

def _debug_diff(old, new, label: str = "diff", mode: str = "debug"):
    """Print a unified diff between two values, syntax-highlighted.

    Values are pretty-formatted (pprint) before diffing, so it works on dicts,
    lists, dataclasses, and other structures -- not just strings. Respects the
    caller file's toggle state.

        debug.diff(old_state, new_state)                 # label "diff"
        debug.diff(old_state, new_state, label="state")  # custom label

    Args:
        old: The "before" value.
        new: The "after" value.
        label: Heading shown next to the diff.
        mode: Log level, same semantics as debug(mode=...).
    """
    frame = inspect.currentframe().f_back
    code = frame.f_code
    line_no = frame.f_lineno
    calling_function_name = code.co_name
    calling_file_name = os.path.basename(code.co_filename)
    if calling_function_name == "<module>":
        calling_function_name = calling_file_name
    file_path = os.path.abspath(code.co_filename)
    t_color, t_is_on, t_emoji = Debugleton().find_file_info(file_path)

    if not t_is_on:
        return

    function_print_str = (calling_function_name if 'self' not in frame.f_locals
                          else f'{frame.f_locals["self"].__class__.__name__}.{calling_function_name}')
    link_uri = f"file://{file_path}#{line_no}"

    old_lines = pprint.pformat(old).splitlines(keepends=True)
    new_lines = pprint.pformat(new).splitlines(keepends=True)
    diff_lines = list(difflib.unified_diff(old_lines, new_lines, fromfile="old", tofile="new", lineterm=""))

    pfx = f"{t_emoji}[{t_color}][/][{t_color} link={link_uri}]\\[{function_print_str}][/][{t_color}] : [/][bold {t_color}]{_esc(label)}[/]"
    log_config.debug_custom(_render_rich(pfx), mode)

    if diff_lines:
        diff_text = "\n".join(diff_lines)
        syntax = Syntax(diff_text, "diff", theme="monokai", word_wrap=True)
        log_config.debug_custom(_render_renderable(syntax), mode)
    else:
        log_config.debug_custom(_render_rich(f"[dim]  (no differences)[/dim]"), mode)


debug.diff = _debug_diff


# ---------------------------------------------------------------------------
# debug.time(label) context manager
# ---------------------------------------------------------------------------

@contextmanager
def _debug_time(label: str = "block", mode: str = "debug"):
    """Time a block of code and print the elapsed duration.

    Color-coded by duration: green < 0.1s, yellow < 1.0s, red otherwise.
    Respects the caller file's toggle state.

        with debug.time("database query"):
            result = db.execute(query)
        # [func] : ⏱ database query took 0.123s

    Args:
        label: Name shown for the timed block.
        mode: Log level, same semantics as debug(mode=...).
    """
    frame = inspect.currentframe().f_back.f_back
    code = frame.f_code
    line_no = frame.f_lineno
    calling_function_name = code.co_name
    calling_file_name = os.path.basename(code.co_filename)
    if calling_function_name == "<module>":
        calling_function_name = calling_file_name
    file_path = os.path.abspath(code.co_filename)
    t_color, t_is_on, t_emoji = Debugleton().find_file_info(file_path)

    function_print_str = (calling_function_name if 'self' not in frame.f_locals
                          else f'{frame.f_locals["self"].__class__.__name__}.{calling_function_name}')
    link_uri = f"file://{file_path}#{line_no}"

    start = _time.perf_counter()
    try:
        yield
    finally:
        elapsed = _time.perf_counter() - start

        if not t_is_on:
            return

        if elapsed < 0.1:
            time_color = "green"
        elif elapsed < 1.0:
            time_color = "yellow"
        else:
            time_color = "red"

        pfx = f"{t_emoji}[{t_color}][/][{t_color} link={link_uri}]\\[{function_print_str}][/][{t_color}] : [/]"
        timing = f"[{time_color}]⏱ {_esc(label)} took {elapsed:.3f}s[/]"
        log_config.debug_custom(_render_rich(f"{pfx}{timing}"), mode)


debug.time = _debug_time
