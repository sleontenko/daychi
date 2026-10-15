import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createProtectedReader } from '../../wiki-graph/src/protected-read.js';
const compile = name => ts.transpileModule(readFileSync(new URL('../src/features/wiki/' + name + '.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const bridge = {}, exports = {};
vm.runInNewContext(compile('bridge'), { exports: bridge, URL });
vm.runInNewContext(compile('prepared-access'), { exports, URL, require: name => name === './bridge' ? bridge : { createProtectedReader } });
const clone = value => JSON.parse(JSON.stringify(value));
const recording = { id: 'lesson_1', links: [{ url: 'https://youtu.be/abcdefghijk', label: 'Запись', type: 'article' }],
  zoom_password: 'private-code', credential: 'must-not-be-copied', annotation: { summary: 'Not needed for this modal' } };

test('native prepared reader projects only protected HTTPS links and no credential/profile/annotation', () => {
  const result = exports.protectedLinksDTO(recording, 'lesson_1');
  assert.deepEqual(clone(result), { id: 'lesson_1', links: recording.links, zoom_password: null });
  assert.equal(exports.protectedLinksDTO(recording, 'other'), null);
  assert.equal(exports.protectedLinksDTO({ account: { status: 'active' } }, 'lesson_1'), null);
  const zoom = exports.protectedLinksDTO({ ...recording, links: [
    ...recording.links, { url: 'https://us02web.zoom.us/j/123', label: 'Занятие', type: 'zoom' },
    { url: 'https://example.test/public', label: 'Статья', type: 'article' },
    { url: 'https://user:password@youtu.be/abcdefghijk', label: 'Invalid', type: 'video' },
    { url: 'javascript:alert(1)', label: 'Invalid', type: 'video' },
  ] }, 'lesson_1');
  assert.equal(zoom.links.length, 2); assert.equal(zoom.zoom_password, 'private-code');
});

test('native prepared access clears a URL immediately on invalidation and rechecks admission on reopen', async () => {
  let allowed = true, reads = 0;
  const access = exports.createPreparedMaterialAccess(async () => {
    reads++; return allowed ? { kind: 'allowed', value: recording } : { kind: 'denied' };
  });
  await access.open('lesson_1'); assert.equal(access.getState().status, 'ready');
  access.invalidate(); assert.equal(access.getState().value, null);
  allowed = false; await access.open('lesson_1'); assert.equal(access.getState().status, 'denied');
  assert.equal(access.getState().value, null); assert.equal(reads, 2);
  assert.equal(bridge.publicWikiPath('/api/wiki/materials/lesson_1'), '/materials/lesson_1');
  assert.equal(bridge.publicSource(recording.links[0].url), false);
});

test('native preparation rejects malformed private DTOs rather than displaying stale links', async () => {
  let value = recording;
  const access = exports.createPreparedMaterialAccess(async () => ({ kind: 'allowed', value }));
  await access.open('lesson_1');
  value = { ...recording, links: [{ url: 'https://youtu.be/abcdefghijk', label: null, type: 'video' }] };
  await access.open('lesson_1'); assert.equal(access.getState().status, 'unavailable');
  assert.equal(access.getState().value, null);
});
