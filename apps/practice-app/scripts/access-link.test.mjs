import assert from 'node:assert/strict';
import test from 'node:test';
import { redirectInvitation, getInvitation, clearInvitation, subscribeInvitation } from '../src/features/access/invitation-link.ts';

test('cold and warm invitation URLs are captured without putting secrets into routes', () => {
  let changes = 0;
  const unsubscribe = subscribeInvitation(() => changes++);
  for (const prefix of ['quietpractice://invite#', 'quietpractice:///invite#']) {
    const token = 'A'.repeat(43);
    assert.equal(redirectInvitation(prefix + token), '/invite');
    assert.equal(getInvitation(), token);
    clearInvitation();
    assert.equal(getInvitation(), undefined);
  }
  assert.equal(changes, 4);
  unsubscribe();
});

test('malformed invitations clear stale credentials; unrelated links are not consumed', () => {
  redirectInvitation('quietpractice://invite#' + 'B'.repeat(43));
  assert.equal(redirectInvitation('quietpractice://invite#bad'), '/invite');
  assert.equal(getInvitation(), undefined);
  const unrelated = 'https://example.com/invite#' + 'C'.repeat(43);
  assert.equal(redirectInvitation(unrelated), unrelated);
  assert.equal(getInvitation(), undefined);
});
