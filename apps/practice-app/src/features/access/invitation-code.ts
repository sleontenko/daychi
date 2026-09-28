const CODE = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{12}$/;
const LEGACY = /^[A-Za-z0-9_-]{32,128}$/;

/** Parse only the credential; never let pasted links choose the API server. */
export function invitationCredential(value: string): string | undefined {
  let candidate = value.trim();
  if (/^(https:\/\/|quietpractice:\/\/)/i.test(candidate)) {
    try {
      const link = new URL(candidate);
      if (link.username || link.password || link.search) return;
      if (link.protocol === 'https:' && !link.pathname.endsWith('/invite')) return;
      if (link.protocol === 'quietpractice:' && (link.hostname !== 'invite' || !['', '/'].includes(link.pathname))) return;
      candidate = link.hash.slice(1);
    } catch { return; }
  }
  const code = candidate.replace(/[\s-]/g, '').toUpperCase();
  if (CODE.test(code)) return code;
  if (LEGACY.test(candidate)) return candidate;
}

export function isInvitationCode(value: string) { return CODE.test(value); }
