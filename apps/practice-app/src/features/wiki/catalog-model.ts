export type Summary = { id: string; title: string; date: string; category_name: string; subtopic: string };
export type Material = Summary & { description: string; links: { url: string; label: string; type: string }[]; zoom_password: string | null };
export type CatalogMaterial = Material & { category: string; subtopic_key: string; timestamp: number };
export type Category = { id: string; name: string; count: number; subtopics: { id: string; name: string; count: number }[] };
export type Results = { total: number; items: Summary[]; missing_ids: string[] };
const fold = (value: string) => value.toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').replace(/\s+/g, ' ').trim();

export function searchCatalog(materials: CatalogMaterial[], params: URLSearchParams): Results {
  const tokens = fold(params.get('q') ?? '').split(' ').filter(Boolean);
  const category = params.get('category');
  const subtopic = params.get('subtopic');
  const ids = params.get('ids');
  const wanted = ids ? new Set(ids.split(',')) : null;
  const offset = Math.max(0, Number(params.get('offset')) || 0);
  const limit = Math.min(100, Math.max(1, Number(params.get('limit')) || 40));
  const scored = materials.filter(row => (!category || row.category === category)
    && (!subtopic || row.subtopic_key === subtopic) && (!wanted || wanted.has(row.id)))
    .map(row => {
      const title = fold(row.title);
      const text = fold([row.title, row.description, row.category_name, row.subtopic].join(' '));
      const score = tokens.every(token => text.includes(token))
        ? tokens.reduce((sum, token) => sum + (title.includes(token) ? 3 : 1), 0) : -1;
      return { row, score };
    }).filter(item => item.score >= 0);
  const direction = params.get('sort') === 'old' ? 1 : -1;
  scored.sort((a, b) => b.score - a.score || direction * (a.row.timestamp - b.row.timestamp) || a.row.id.localeCompare(b.row.id));
  const available = new Set(materials.map(row => row.id));
  return { total: scored.length,
    missing_ids: wanted ? [...wanted].filter(id => id !== 'none' && !available.has(id)).sort() : [],
    items: scored.slice(offset, offset + limit).map(({ row }) => ({ id: row.id, title: row.title, date: row.date,
      category_name: row.category_name, subtopic: row.subtopic })) };
}
