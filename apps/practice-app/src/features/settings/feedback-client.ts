const endpoint = process.env.EXPO_PUBLIC_DAYCHEE_API_URL ?? '';
export type FeedbackDraft = { kind: string; message: string; contact: string; operationId?: string; version?: string };
// An operation identifier, not an authentication credential.
export function feedbackOperationId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });
}
export async function sendFeedback(draft: FeedbackDraft) {
  if (!endpoint.startsWith('https://')) throw new Error('Отправка пока не подключена. Черновик сохранён.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(`${endpoint.replace(/\/$/, '')}/api/feedback`, {
      method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation_id: draft.operationId, kind: draft.kind, message: draft.message, contact: draft.contact, version: draft.version }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.status !== 'sent') throw new Error(typeof result?.detail === 'string' ? result.detail : 'Не удалось отправить. Черновик сохранён — попробуйте ещё раз.');
  } catch (error) {
    if (error instanceof TypeError || controller.signal.aborted) throw new Error('Не удалось связаться с сервером. Черновик сохранён — проверьте интернет и повторите отправку.');
    throw error;
  } finally { clearTimeout(timer); }
}
