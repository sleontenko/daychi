// WKWebView loadHTMLString history state can be unavailable after a native layout change.
// Keep embedded navigation explicitly; ordinary web navigation still uses browser history.
export function nativeHistory(initial = '#view=home', restored = null) {
  const entries = Array.isArray(restored) && restored.length ? [...restored] : [initial];
  if (entries.at(-1) !== initial) entries.push(initial);
  return {
    snapshot: () => [...entries],
    get canBack() { return entries.length > 1; },
    record(hash, replace) {
      const next = hash || '#view=home';
      if (replace) entries[entries.length - 1] = next;
      else if (entries.at(-1) !== next) entries.push(next);
    },
    previous() { if (entries.length > 1) entries.pop(); return entries.at(-1); },
  };
}
