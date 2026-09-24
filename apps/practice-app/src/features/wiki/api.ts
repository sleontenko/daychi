import { privateRequest } from '../access/session';
export type { Category, Material, Summary, Results } from './catalog-model';
export const wikiRequest = <T,>(path: string) => privateRequest<T>(`/api/wiki${path}`);
