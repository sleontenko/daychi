import { redirectCabinetCallback } from '../features/cabinet-account/session';
import { redirectInvitation } from '../features/access/invitation-link';

export async function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return (await redirectCabinetCallback(path)) ?? redirectInvitation(path);
}
