/**
 * Tiny glob matcher for the dependency-graph path filters. No dependency on a
 * full glob library; the path set is small and we only need a VSCode-search-like
 * subset: `*`, `**`, `?`, `{a,b}`, and comma-separated pattern lists.
 *
 * Convenience rule (mirrors VSCode's "files to include/exclude"): a pattern with
 * no `/` matches anywhere in the tree, so `scanner` or `*.py` "just work".
 */

function globToRegExp(glob: string): RegExp {
  const anywhere = !glob.includes('/');
  let re = '';
  for (let i = 0; i < glob.length; i += 1) {
    const ch = glob[i];
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        // `**` — any number of path segments (and the following slash, if any).
        re += '.*';
        i += 1;
        if (glob[i + 1] === '/') i += 1;
      } else {
        // `*` — anything except a path separator.
        re += '[^/]*';
      }
    } else if (ch === '?') {
      re += '[^/]';
    } else if (ch === '{') {
      const end = glob.indexOf('}', i);
      if (end === -1) {
        re += '\\{';
      } else {
        const opts = glob.slice(i + 1, end).split(',').map((o) => o.replace(/[.+^${}()|[\]\\]/g, '\\$&'));
        re += `(?:${opts.join('|')})`;
        i = end;
      }
    } else {
      re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  // Bare patterns (no slash) match the basename or any segment anywhere.
  const body = anywhere ? `(?:.*/)?${re}` : re;
  return new RegExp(`^${body}$`);
}

function compile(patterns: string[]): RegExp[] {
  return patterns
    .flatMap((p) => p.split(','))
    .map((p) => p.trim())
    .filter(Boolean)
    .map(globToRegExp);
}

/**
 * Build a predicate over root-relative POSIX paths. Empty `include` matches
 * everything; `exclude` always wins.
 */
export function makePathMatcher(include: string[], exclude: string[]): (path: string) => boolean {
  const inc = compile(include);
  const exc = compile(exclude);
  return (path: string) => {
    if (exc.some((r) => r.test(path))) return false;
    if (inc.length === 0) return true;
    return inc.some((r) => r.test(path));
  };
}

/** True when no include/exclude patterns are active (filter is a no-op). */
export function isPathFilterEmpty(include: string[], exclude: string[]): boolean {
  return compile(include).length === 0 && compile(exclude).length === 0;
}
