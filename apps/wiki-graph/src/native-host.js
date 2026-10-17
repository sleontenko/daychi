import { nativeHistory } from './native-history.js';
// Local-only UI. No credential/profile enters the WebView. Private mode is
// selected by the native host, with separate bridge message/route authority.
const protectedReader = document.body.dataset.nativeCabinet === '1';
const resume = protectedReader ? window.__daycheeResume : null;
if (resume) history.replaceState({wiki:true,wikiScroll:resume.scroll}, '', resume.hash);
let sequence = 0;
const pending = new Map();
const send = value => window.ReactNativeWebView.postMessage(JSON.stringify(value));
const call = (type, value) => new Promise((resolve,reject) => {
  const id = String(++sequence);
  const timer = setTimeout(()=>{pending.delete(id);reject(new Error('Нет связи. Повторите попытку.'));}, 20000);
  pending.set(id,{resolve,reject,timer}); send({type,id,value});
});
window.__daycheeReply = ({id,value,error}) => {
  const request = pending.get(id); if(!request) return;
  pending.delete(id);clearTimeout(request.timer);
  error ? request.reject(new Error(error)) : request.resolve(value);
};
window.__daycheeNative = {
  protectedReader, resume, history: nativeHistory(resume?.hash, resume?.history), bookmarks: [], opened: [], openedMaterial:id=>call('opened',id), request:path=>call(protectedReader ? 'protected' : 'public',path), bookmark:id=>call('bookmark',id),
  route:value=>{send({type:'route',value}); requestAnimationFrame(checkpoint);}, online:id=>send({type:'online',value:id}), back:()=>{},
};
function checkpoint() {
  if (!protectedReader) return;
  const p = new URLSearchParams(location.hash.slice(1));
  const input = document.querySelector('#catalog-search');
  if (input) input.value ? p.set('q', input.value.slice(0,300)) : p.delete('q');
  let camera; try { camera=JSON.parse(document.querySelector('#graph')?.dataset.camera || 'null'); } catch {}
  send({type:'checkpoint',value:{hash:'#'+p.toString(),scroll:window.scrollY,history:window.__daycheeNative.history.snapshot().slice(-12),camera}});
}
window.addEventListener('scroll', checkpoint, {passive:true});
window.addEventListener('wiki-camera', checkpoint);
document.addEventListener('input', checkpoint);
document.addEventListener('click', e=>{
  const link=e.target.closest('a[href]');
  if(link && /^https:\/\//i.test(link.getAttribute('href'))) {
    e.preventDefault();send({type:'source',value:link.getAttribute('href')});
  }
});
Promise.all([call('bookmarks').then(ids=>{window.__daycheeNative.bookmarks=ids;}),call('recent').then(ids=>{window.__daycheeNative.opened=ids;})]).catch(()=>{}).finally(()=>import('./graph.js'));
