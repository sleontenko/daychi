import { nativeHistory } from './native-history.js';
// Local-only host. No login/session data enters the WebView.
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
  history: nativeHistory(), bookmarks: [], opened: [], openedMaterial:id=>call('opened',id), request:path=>call('public',path), bookmark:id=>call('bookmark',id),
  route:value=>send({type:'route',value}), online:id=>send({type:'online',value:id}), back:()=>{},
};
document.addEventListener('click', e=>{
  const link=e.target.closest('a[href]');
  if(link && /^https:\/\//i.test(link.getAttribute('href'))) {
    e.preventDefault();send({type:'source',value:link.getAttribute('href')});
  }
});
Promise.all([call('bookmarks').then(ids=>{window.__daycheeNative.bookmarks=ids;}),call('recent').then(ids=>{window.__daycheeNative.opened=ids;})]).catch(()=>{}).finally(()=>import('./graph.js'));
