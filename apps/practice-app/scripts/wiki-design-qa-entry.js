// Synthetic simulator-only entry. Never use for archives or normal builds.
if(require('expo-device').isDevice || require('expo-modules-core').requireNativeModule('ExpoApplication').applicationId !== 'ai.mypraxis.quietpractice.wikidesignqa') throw Error('Wiki QA requires its separate simulator bundle');
const fixture=require('../../wiki-graph/qa/content-v1.json');
const reply=(value,status=200)=>Promise.resolve({ok:status===200,status,json:async()=>value});
global.fetch=(url,options)=>{
 const prefix='https://example.invalid/api/public/wiki';
 const address=String(url);
 if(address.startsWith(prefix) && !options?.method) {
  const path=address.slice(prefix.length);
  if(path.startsWith('/graph')) return reply(fixture.graph);
  if(path.startsWith('/materials/')) {const id=path.split('/')[2].split('?')[0];const row=fixture.materials.find(r=>r.id===id);return reply(row||{},row?200:404);}
 }
 if(address.startsWith('https://example.invalid/api/access/'))return reply({},401);
 return Promise.reject(Error('Isolated wiki QA blocked an unexpected network request'));
};
require('expo-router/entry');
