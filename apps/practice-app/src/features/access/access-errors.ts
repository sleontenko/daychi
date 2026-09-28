export const invitationErrors: Record<string, { title: string; message: string }> = {
  expired: { title: 'Срок приглашения истёк', message: 'Попросите в школе новое приглашение и откройте его на этом телефоне.' },
  used: { title: 'Приглашение уже использовано', message: 'Оно подходит для одного телефона. Если доступ нужен на этом устройстве, попросите новое приглашение.' },
  revoked: { title: 'Приглашение отозвано', message: 'Уточните в школе возможность получить новое приглашение.' },
  invalid: { title: 'Приглашение недействительно', message: 'Проверьте ссылку или код из сообщения. Если ошибка повторяется, попросите новое приглашение.' },
};
export class AccessError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}
