import test from 'node:test';
import assert from 'node:assert/strict';
import { searchCatalog } from '../src/features/wiki/catalog-model.ts';
const records = Array.from({ length: 315 }, (_, n) => ({ id: String(n), title: `Трёхмерность ${n}`,
  date: '18 сен 2026', category_name: 'Нэйгун', category: n % 2 ? 'a' : 'b',
  subtopic: 'Младшая группа', subtopic_key: 'junior', timestamp: n, description: 'Практика',
  links: [{ url: 'https://example.com/private', label: 'Источник', type: 'video' }], zoom_password: 'private-code' }));
test('offline search normalizes ё/е, paginates and preserves bookmarks without detail-only fields', () => {
  const ids = [];
  for (let offset = 0; offset < 315; offset += 100) {
    const page = searchCatalog(records, new URLSearchParams({ q: 'ТРЕХМЕРНОСТЬ', offset: String(offset), limit: '100' }));
    assert.equal(page.total, 315); ids.push(...page.items.map(r => r.id));
    assert.ok(!JSON.stringify(page).includes('private'));
  }
  assert.equal(new Set(ids).size, 315); assert.equal(ids[0], '314');
  assert.deepEqual(searchCatalog(records, new URLSearchParams({ ids: '1,missing' })).missing_ids, ['missing']);
  assert.equal(searchCatalog(records, new URLSearchParams({ ids: '1' })).items[0].id, '1');
  assert.equal(searchCatalog(records, new URLSearchParams({ ids: 'none' })).total, 0);
});
test('offline filters, oldest-first, multi-token search and empty results', () => {
  assert.equal(searchCatalog(records, new URLSearchParams({ category: 'a', subtopic: 'junior' })).total, 157);
  assert.equal(searchCatalog(records, new URLSearchParams({ sort: 'old' })).items[0].id, '0');
  assert.equal(searchCatalog(records, new URLSearchParams({ q: 'трехмерность практика' })).total, 315);
  assert.equal(searchCatalog(records, new URLSearchParams({ subtopic: 'missing' })).total, 0);
  assert.equal(searchCatalog(records, new URLSearchParams({ q: 'private-code' })).total, 0);
});
