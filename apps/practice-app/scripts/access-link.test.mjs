import assert from 'node:assert/strict';
import test from 'node:test';
import { redirectInvitation, getInvitation, clearInvitation, subscribeInvitation } from '../src/features/access/invitation-link.ts';
import { invitationCredential, isInvitationCode } from '../src/features/access/invitation-code.ts';

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

test('manual codes and full links yield only a credential, never a server override', () => {
  const code = 'ABCD2345EFGH';
  for (const input of ['abcd-2345-efgh', ' ABCD 2345 EFGH ', 'https://school.example/invite#' + code, 'quietpractice://invite#' + code]) {
    assert.equal(invitationCredential(input), code);
  }
  assert.equal(isInvitationCode(code), true);
  const legacy = 'a'.repeat(43);
  assert.equal(invitationCredential('https://school.example/invite#' + legacy), legacy);
  assert.equal(isInvitationCode(legacy), false);
  for (const input of ['0000-1111-OOOO', 'abcd', 'http://school.example/invite#' + code, 'https://user:pass@school.example/invite#' + code, 'https://school.example/other#' + code, 'quietpractice://other#' + code]) {
    assert.equal(invitationCredential(input), undefined);
  }
});

test('short code deep links use the same cold/warm handoff as legacy invitations', () => {
  assert.equal(redirectInvitation('quietpractice://invite#ABCD2345EFGH'), '/invite');
  assert.equal(getInvitation(), 'ABCD2345EFGH');
  clearInvitation();
});

test('access return resumes once, cancellation clears it, newer entry replaces it', async () => {
  const { setAccessReturn, resumeAccessReturn, clearAccessReturn, accessReturnLabel } = await import('../src/features/access/return-target.ts');
  let destination = '';
  setAccessReturn({ label: 'Материал', resume: () => { destination = 'material'; } });
  setAccessReturn({ label: 'Занятие', resume: () => { destination = 'class'; } });
  assert.equal(accessReturnLabel(), 'Занятие');
  assert.equal(resumeAccessReturn(), true);
  assert.equal(destination, 'class');
  assert.equal(resumeAccessReturn(), false);
  setAccessReturn({ label: 'Материал', resume: () => { destination = 'material'; } });
  clearAccessReturn();
  assert.equal(resumeAccessReturn(), false);
  assert.equal(destination, 'class');
});
