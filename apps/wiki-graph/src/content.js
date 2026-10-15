// All content remains source text from content v1; future article sections are separate.
export const renderSummary = (a, esc) => `<p class="source-description reader-lead">${esc(a.summary)}</p>`;
export function renderFragments(a, esc) {
  const time = seconds => {
    const n = Math.floor(seconds);
    return `${Math.floor(n / 3600) ? Math.floor(n / 3600) + ':' : ''}${String(Math.floor(n / 60) % 60).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  };
  const recording = typeof a.resource_id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(a.resource_id);
  return `${a.points.length ? `<details class="reader-fragments"><summary>Фрагменты записи · ${a.points.length}</summary>${a.points.map(p => `<blockquote><p>«${esc(p.text)}»</p>${recording ? `<a href="https://www.youtube.com/watch?v=${encodeURIComponent(a.resource_id)}&amp;t=${Math.floor(p.start_seconds)}s" target="_blank" rel="noopener noreferrer" aria-label="Открыть запись с ${time(p.start_seconds)}">${time(p.start_seconds)} ↗</a>` : `<span class="muted small">${time(p.start_seconds)} · Запись доступна после проверки доступа</span>`}</blockquote>`).join('')}</details>` : ''}`;
}

export function renderAnnotation(a,esc) { return `<p class="muted small">Конспект по расшифровке · черновик</p>${renderSummary(a,esc)}${renderFragments(a,esc)}`; }
