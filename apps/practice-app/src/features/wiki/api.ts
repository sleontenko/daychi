// Closed TestFlight beta: the private snapshot is generated locally and ignored by Git.
// No network or authentication is needed to browse it. Restore server auth before public rollout.
import catalog from './generated/catalog.json';
import { searchCatalog, type CatalogMaterial } from './catalog-model';
export type { Category, Material, Summary, Results } from './catalog-model';

export async function wikiRequest<T>(path: string): Promise<T> {
  const [route, query = ''] = path.split('?');
  if (route === '/categories') return catalog.categories as T;
  if (route === '/materials') return searchCatalog(catalog.materials as CatalogMaterial[], new URLSearchParams(query)) as T;
  if (route.startsWith('/materials/')) {
    const row = catalog.materials.find(item => item.id === decodeURIComponent(route.slice('/materials/'.length)));
    if (row) return row as T;
    throw new Error('Материал больше не доступен в этой версии.');
  }
  throw new Error('Не удалось открыть материал.');
}
