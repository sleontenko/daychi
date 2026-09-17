import { Platform } from 'react-native';

export type Topic = {
  slug: string;
  title: string;
  source_count: number;
  estimated_minutes: number;
};

export type Overview = {
  messages: number;
  links: number;
  attachments: number;
  unique_materials: number;
  topics: Topic[];
};

export type Material = {
  id: string;
  title: string;
  topic_slug: string;
  notebook_title?: string | null;
  kind: string;
  source_url?: string | null;
  date?: string | null;
  duration_minutes?: number | null;
};

export type MaterialPage = {
  items: Material[];
  total: number;
  limit: number;
  offset: number;
};

export type Answer = {
  answer: string;
  citations: Material[];
  model: string;
  provider?: string;
  provider_status?: string;
};

const localHost = Platform.select({
  android: 'http://10.0.2.2:8000',
  default: 'http://127.0.0.1:8000',
});

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || localHost;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail || `API error ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getOverview() {
  return request<Overview>('/api/v1/overview');
}

export function getTopics() {
  return request<Topic[]>('/api/v1/topics');
}

export function getMaterials(options: { query?: string; topic?: string; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (options.query) params.set('q', options.query);
  if (options.topic) params.set('topic', options.topic);
  params.set('limit', String(options.limit || 30));
  return request<MaterialPage>(`/api/v1/materials?${params}`);
}

export function ask(question: string) {
  return request<Answer>('/api/v1/ask', {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
}
