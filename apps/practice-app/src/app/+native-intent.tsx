import { redirectInvitation } from '../features/access/invitation-link';

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return redirectInvitation(path);
}
