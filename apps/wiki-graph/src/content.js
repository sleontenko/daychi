// Content is text, never HTML from the editorial pipeline.
export function renderAnnotation(a, esc) {
  const time = seconds => {
    const n = Math.floor(seconds);
    return `${Math.floor(n / 3600) ? Math.floor(n / 3600) + ':' : ''}${String(Math.floor(n / 60) % 60).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  };
  return `<p class="muted small">Конспект по расшифровке · черновик</p><p class="source-description">${esc(a.summary)}</p>
    <h3>Фрагменты расшифровки</h3><ul class="source-links">${a.points.map(p => `<li><a href="https://www.youtube.com/watch?v=${encodeURIComponent(a.resource_id)}&amp;t=${Math.floor(p.start_seconds)}s" target="_blank" rel="noopener noreferrer">${time(p.start_seconds)} ↗</a> — «${esc(p.text)}»</li>`).join('')}</ul>`;
}
