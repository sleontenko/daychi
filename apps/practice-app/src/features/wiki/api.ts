import { protectedSource } from './bridge';
import type { Material } from './catalog-model';
export type { Category, Material, Summary, Results } from './catalog-model';
const endpoint = process.env.EXPO_PUBLIC_DAYCHEE_API_URL ?? '';
export async function wikiRequest<T>(path: string): Promise<T> {
  if (!endpoint.startsWith('https://')) throw new Error('Публичная вики пока не подключена.');
  const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 15000);
  try {
    const response = await fetch(endpoint.replace(/\/$/, '') + '/api/public/wiki' + path, {
      cache: 'no-store', signal: abort.signal,
    }).catch(() => { throw new Error('Не удалось загрузить вики. Проверьте интернет и повторите попытку.'); });
    if (!response.ok) throw new Error(response.status === 404 ? 'Публичная вики пока не подключена или материал больше не доступен.' : 'Вики временно недоступна. Повторите попытку.');
    const data = await response.json();
    // Also close recording links from an older server while rollout is pending.
    if (/^\/materials\/[A-Za-z0-9_-]+$/.test(path) && Array.isArray(data.links)) {
      const material = data as Material;
      const original = material.links;
      const links = original.filter(link => link.type !== 'zoom' && !protectedSource(link.url));
      data.links = links;
      data.restricted_links = material.restricted_links || links.length !== original.length;
      if (data.annotation) delete data.annotation.resource_id;
    }
    return data;
  } finally { clearTimeout(timer); }
}
