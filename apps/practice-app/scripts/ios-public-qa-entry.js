// Isolated simulator fixture entry. Never used by normal builds or archives.
if (require('expo-device').isDevice || require('expo-modules-core').requireNativeModule('ExpoApplication').applicationId !== 'ai.mypraxis.quietpractice.publicqa') {
  throw Error('Public QA fixture requires the separate simulator bundle ID');
}
const fixtureState = process.env.EXPO_PUBLIC_UI_QA_STATE || 'pending';
if (!['none', 'pending', 'active', 'rejected', 'revoked', 'signed_out', 'legacy'].includes(fixtureState)) throw Error('Unknown fixture state');
const SecureStore = require('expo-secure-store');
const Storage = require('@react-native-async-storage/async-storage').default;
const originalFetch = global.fetch;
const reply = (data, status = 200) => Promise.resolve({ ok: status === 200, status, json: async () => data });
const material = { id: 'qa-public-material', title: 'Материал для проверки', date: '2026-10-02', category: 'qa', category_name: 'Практика', subtopic: 'Основы', subtopic_key: 'basic', timestamp: 1790899200, description: 'Синтетический материал. Проверяем бесплатную вики и сохранение закладки.', links: [], restricted_links: true };
global.fetch = async (url, options) => {
  const path = String(url).split('/api')[1];
  // Optional full-catalog QA: only public, redacted GETs from an isolated local
  // copy. It cannot proxy credentials, access, deletion, or arbitrary origins.
  if (process.env.EXPO_PUBLIC_UI_QA_CORPUS === '1' && path?.startsWith('/public/wiki/') && !options?.method)
    return originalFetch('http://127.0.0.1:8895/api' + path);
  if (path === '/access/delete') {
    const old = await Storage.getItem('qa.deletion.body.' + fixtureState);
    if (!old) { await Storage.setItem('qa.deletion.body.' + fixtureState, options.body); await new Promise(resolve => setTimeout(resolve, 2500)); throw Error('Synthetic lost response'); }
    if (old !== options.body) throw Error('Synthetic retry operation changed');
    return reply({ deleted: true });
  }
  if (path?.startsWith('/access/request')) return reply({ id: 'qa-request', created_at:1790899200, decided_at:['active','rejected','revoked'].includes(fixtureState)?1790985600:null, status: fixtureState === 'legacy' ? 'active' : fixtureState });
  if (path === '/access/session') return reply({ active: true, invitation_reference:'qa-invitation',invitation_label:'Демо-приглашение',activated_at:1790985600 }, ['active','legacy'].includes(fixtureState) ? 200 : 401);
  if (path === '/access/zoom') return reply([]);
  if (path?.startsWith('/wiki/materials/')) return reply({ ...material, links: [{ url: 'https://example.invalid/online/qa', label: 'Онлайн-запись · демо', type: 'zoom' }] });
  if (path?.startsWith('/access/')) return reply({}, 401);
  if (path === '/public/wiki/graph') return reply({version:'qa-v1',sections:[{id:'qa',name:'Практика',count:2}],nodes:[{id:'sec-qa',type:'section',label:'Практика',sec:'qa',count:2},{id:material.id,type:'material',label:material.title,sec:'qa',sub:'Основы',date:material.date,ts:material.timestamp},{id:'qa-second-material',type:'material',label:'Продолжение практики',sec:'qa',sub:'Основы',date:'2026-10-01',ts:1790812800}],edges:[{s:'sec-qa',t:material.id,k:'structure'},{s:'sec-qa',t:'qa-second-material',k:'structure'},{s:material.id,t:'qa-second-material',k:'series'}]});
  if (path === '/public/wiki/categories') return reply([{ id: 'qa', name: 'Практика', count: 1, subtopics: [{ id: 'basic', name: 'Основы', count: 1 }] }]);
  if (path?.startsWith('/public/wiki/materials/')) return reply({...material,id:path.endsWith('qa-second-material')?'qa-second-material':material.id,annotation:{status:'source_checked_draft',summary:'Синтетический конспект для проверки нового reader. В начале занятия разбирается положение тела и спокойное дыхание.',points:[{text:'Сначала найдите устойчивое положение и свободное дыхание.',start_seconds:60,end_seconds:75}],resource_id:'dQw4w9WgXcQ'}});
  if (path?.startsWith('/public/wiki/materials')) return reply({ total: 1, items: [material], missing_ids: [] });
  if (path === '/v1/schedule') return originalFetch(url, options); // public schedule only
  throw Error('Fixture blocked unexpected network request');
};
// Switch synthetic states deliberately; a restart within the same state retains
// bookmarks and an unfinished deletion, so retry/persistence can be exercised.
if (SecureStore.getItem('qa.fixture-state.v2') !== fixtureState) {
  const secret = 'a'.repeat(64), session = 'b'.repeat(64);
  const id = 'ffe054fe7ae0cb6dc65c3af9', sessionId = 'a0fab1377f49a759b57f6331';
  const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
  const granted = ['active', 'legacy'].includes(fixtureState);
  SecureStore.setItem('daychee.access.request.v1', JSON.stringify({ profile: { first_name: ['none','legacy'].includes(fixtureState) ? '' : 'Demo', last_name: ['none','legacy'].includes(fixtureState) ? '' : 'Applicant', telegram: '' }, ...(['none','legacy'].includes(fixtureState) ? {} : { secret, session, submitted: true }), status: ['none','legacy'].includes(fixtureState) ? 'draft' : fixtureState }), options);
  SecureStore.setItem('daychee.access.deletion.v1.' + id, secret, options);
  SecureStore.setItem('daychee.access.deletion.v1.' + sessionId, session, options);
  SecureStore.setItem('daychee.access.deletion.v1.index', JSON.stringify(fixtureState === 'none' ? [] : fixtureState === 'legacy' ? [sessionId] : granted ? [id, sessionId] : [id]), options);
  if (granted) SecureStore.setItem('daychee.access.session.v1', session, options);
  else SecureStore.setItem('daychee.access.session.v1', '', options);
  SecureStore.setItem('qa.fixture-state.v2', fixtureState, options);
  void Storage.setItem('quietpractice.wiki.bookmarks.v1', JSON.stringify([material.id]));
}
require('expo-router/entry');
