// Presentation rules for existing content v1. No client-authored editorial links.
export const publicationTime = node => Number(node.updated_ts) > 0 ? Number(node.updated_ts) : Number(node.ts) || 0;
export function publications(nodes) {
  return nodes.map((node,index)=>({node,index})).sort((a,b)=>publicationTime(b.node)-publicationTime(a.node)||a.index-b.index).map(x=>x.node);
}
export const relationReason = kind => kind === 'series' ? 'Соседний номер в серии' : kind === 'semantic' ? 'Связь подтверждена цитатой' : 'Структура каталога';
export function rememberOpened(previous,id) { return [id,...previous.filter(value=>value!==id)].slice(0,20); }
export const BOOKMARKS_KEY = 'quietpractice.wiki.bookmarks.v1';
export const OPENED_KEY = 'quietpractice.wiki.recent.v1';
export function readIds(key,storage) {
  try { const value=JSON.parse(storage.getItem(key)||'[]'); return Array.isArray(value)?value.filter(id=>typeof id==='string'&&id.length<=200).slice(0,10000):[]; } catch { return []; }
}
