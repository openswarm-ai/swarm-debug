import re

DEBUG_KWARGS = {'mode', 'override_max_chars', 'sep', 'end', 'pretty', 'lang', 'table', 'error'}

_PERCENT_FORMAT_RE = re.compile(r'%[-+0#]*(\*|\d+)(\.\*|\.\d+)?[diouxXeEfFgGcrsab]|%[-+0#]*(\.\*|\.\d+)[diouxXeEfFgGcrsab]|%[diouxXeEfFgGcrsab]|%%')


def extract_debug_args(lines, line_no):
    """Extract argument source-text from a debug() call, handling multi-line
    calls, nested parens/brackets/braces, and quoted strings."""
    start = line_no - 1
    line = lines[start]
    idx = line.find('debug(')
    if idx == -1:
        return []

    # Collect characters from the opening '(' to the balanced closing ')'
    pos = idx + len('debug(')
    depth = 1
    chars = []
    current_line = start
    col = pos

    while depth > 0:
        if current_line >= len(lines):
            break
        text = lines[current_line]
        while col < len(text) and depth > 0:
            ch = text[col]

            if ch in ('"', "'"):
                quote = ch
                # Check for triple-quote
                if text[col:col+3] in ('"""', "'''"):
                    triple = text[col:col+3]
                    chars.append(triple)
                    col += 3
                    while True:
                        if current_line >= len(lines):
                            break
                        while col < len(lines[current_line]):
                            if lines[current_line][col:col+3] == triple:
                                chars.append(triple)
                                col += 3
                                break
                            chars.append(lines[current_line][col])
                            col += 1
                        else:
                            chars.append('\n')
                            current_line += 1
                            col = 0
                            continue
                        break
                    continue

                chars.append(quote)
                col += 1
                while col < len(text):
                    c = text[col]
                    chars.append(c)
                    if c == '\\':
                        col += 1
                        if col < len(text):
                            chars.append(text[col])
                    elif c == quote:
                        col += 1
                        break
                    col += 1
                continue

            if ch == '#':
                break

            if ch in ('(', '[', '{'):
                depth += 1
            elif ch in (')', ']', '}'):
                depth -= 1
                if depth == 0:
                    break

            chars.append(ch)
            col += 1

        current_line += 1
        col = 0

    content = ''.join(chars)
    return _split_args(content)


def _split_args(content):
    """Split a comma-separated argument string respecting nesting and quotes."""
    args = []
    current = []
    depth = 0
    i = 0

    while i < len(content):
        ch = content[i]

        if ch in ('"', "'"):
            quote = ch
            if content[i:i+3] in ('"""', "'''"):
                triple = content[i:i+3]
                current.append(triple)
                i += 3
                while i < len(content):
                    if content[i:i+3] == triple:
                        current.append(triple)
                        i += 3
                        break
                    current.append(content[i])
                    i += 1
                continue

            current.append(quote)
            i += 1
            while i < len(content):
                c = content[i]
                current.append(c)
                if c == '\\':
                    i += 1
                    if i < len(content):
                        current.append(content[i])
                elif c == quote:
                    i += 1
                    break
                i += 1
            continue

        if ch in ('(', '[', '{'):
            depth += 1
        elif ch in (')', ']', '}'):
            depth -= 1

        if ch == ',' and depth == 0:
            args.append(''.join(current).strip())
            current = []
        else:
            current.append(ch)

        i += 1

    tail = ''.join(current).strip()
    if tail:
        args.append(tail)

    return args


def filter_kwargs(arg_names):
    """Remove debug()'s own keyword arguments from parsed source arg names.
    Returns the filtered list."""
    return [a for a in arg_names if not any(
        a.strip().startswith(kw + '=') for kw in DEBUG_KWARGS
    )]


def has_percent_format(s):
    """Return True if the string contains %-style format specifiers."""
    return bool(_PERCENT_FORMAT_RE.search(s))


def is_fstring(arg_name):
    if not isinstance(arg_name, str):
        return False
    return arg_name.startswith("f'") or arg_name.startswith('f"')


def _strip_quotes(s):
    """Strip outer quotes (single, double, or triple) from a source string."""
    for triple in ('"""', "'''"):
        if s.startswith(triple) and s.endswith(triple) and len(s) >= 6:
            return s[3:-3]
    for q in ('"', "'"):
        if s.startswith(q) and s.endswith(q) and len(s) >= 2:
            return s[1:-1]
    return None


def is_text(arg_value, arg_name):
    if not isinstance(arg_value, str):
        return False

    # f-string
    if is_fstring(arg_name):
        return True

    # Plain string literal (single, double, or triple quoted)
    inner = _strip_quotes(arg_name)
    if inner is not None and inner == arg_value:
        return True

    # String concatenation with + (e.g. "hello " + name)
    if '+' in arg_name:
        parts = arg_name.split('+')
        if all(_strip_quotes(p.strip()) is not None or p.strip().startswith('f"') or p.strip().startswith("f'") for p in parts):
            return True

    return False


def is_error(arg_value):
    return isinstance(arg_value, BaseException)

