export type ProtectedReadResult =
  | { kind: 'allowed'; value: unknown }
  | { kind: 'invalid-credential' | 'denied' | 'missing' | 'unavailable' };
export type ProtectedReadState<T> = {
  status: 'idle' | 'loading' | 'ready' | 'sign-in-required' | 'denied' | 'missing' | 'unavailable';
  materialId: string | null;
  value: T | null;
};
export function createProtectedReader<T>(options: {
  read: (materialId: string, signal: AbortSignal) => Promise<ProtectedReadResult>;
  validate: (value: unknown, materialId: string) => T | null;
  timeoutMs?: number;
}): {
  getState(): ProtectedReadState<T>;
  subscribe(listener: () => void): () => void;
  open(materialId: string): Promise<void>;
  invalidate(): void;
  dispose(): void;
};
