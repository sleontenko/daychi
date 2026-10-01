'use strict';
const $ = id => document.getElementById(id);
let csrf = '', rows = [], filter = 'pending', pendingOperation = null, resultCopied = false, revokeId = '', fresh = false, creating = false, revoking = false;
const names = {pending:'Ожидает',active:'Доступ открыт',expired:'Истекло',signed_out:'Вышел на телефоне',revoked:'Отозвано'};
const date = value => value ? new Date(value*1000).toLocaleDateString('ru-RU',{timeZone:'Asia/Jerusalem',day:'numeric',month:'short'}) : 'дата неизвестна';
function notice(message=''){$('notice').textContent=message;}
function loseSession(message){
  csrf='';fresh=false;$('workspace').hidden=true;$('logout').hidden=true;$('login').hidden=false;
  rows=[];accessRequests=[];requestFresh=false;$('list').replaceChildren();$('requests-list').replaceChildren();
  for(const id of ['request-name','request-status','request-telegram','request-date','request-match','request-message'])$(id).textContent='';
  $('invite-text').value='';$('result').hidden=true;
  if($('create-dialog').open)$('create-dialog').close();if($('revoke-dialog').open)$('revoke-dialog').close();
  if($('reject-request-dialog').open)$('reject-request-dialog').close();
  notice(message);$('password').focus();
}
async function request(path, options={}){
  const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch('/api/admin'+path,{credentials:'same-origin',cache:'no-store',...options,signal:controller.signal,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf,...options.headers}});
    const data=await response.json();
    if(!response.ok){
      if(response.status===401 && path!=='/login')loseSession('Сессия завершилась. Войдите снова; поиск и черновик сохранены.');
      const error=new Error(typeof data.detail==='string'?data.detail:'Не удалось выполнить запрос.');error.status=response.status;throw error;
    }
    return data;
  }catch(error){
    if(error.name==='AbortError'||error instanceof TypeError)throw new Error('Нет ответа сервера. Проверьте соединение.');
    throw error;
  }finally{clearTimeout(timeout);}
}
function render(){
  const query=$('search').value.trim().toLocaleLowerCase('ru');
  const visible=rows.filter(r=>(filter==='done'?!['pending','active'].includes(r.status):r.status===filter)&&r.label.toLocaleLowerCase('ru').includes(query));
  $('list').replaceChildren();$('count').textContent=`${visible.length} из ${rows.length}`;
  document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));
  if(!visible.length){const p=document.createElement('p');p.className='empty';p.textContent=query?'Ничего не найдено. Попробуйте другую метку.':'Здесь пока нет приглашений.';$('list').append(p);}
  for(const row of visible){
    const article=document.createElement('article');article.className='row';
    const info=document.createElement('div'), title=document.createElement('h3'), status=document.createElement('p'), meta=document.createElement('p');
    title.textContent=row.label||'Без метки';status.textContent=names[row.status];status.className='status'+(['pending','active'].includes(row.status)?'':' done');
    meta.className='muted small';meta.textContent=row.status==='pending'?`Активировать до ${date(row.expires)}`:`Создано: ${date(row.created_at)}`;
    info.append(title,status,meta);article.append(info);
    if(['pending','active'].includes(row.status)){
      const b=document.createElement('button');b.className='text';b.textContent=row.status==='pending'?'Отменить':'Отозвать';b.disabled=!fresh;
      b.addEventListener('click',()=>{revokeId=row.id;$('revoke-title').textContent=row.status==='pending'?'Отменить приглашение?':'Отозвать доступ?';$('revoke-description').textContent=(row.label||'Без метки')+'. '+(row.status==='pending'?'Ссылка и код перестанут работать. Если приглашение уже успели активировать, доступ также будет закрыт.':'На этом телефоне перестанут открываться вики и Zoom. Для повторного входа понадобится новое приглашение.');$('confirm-revoke').textContent=row.status==='pending'?'Отменить приглашение':'Отозвать';$('cancel-revoke').textContent='Не сейчас';$('revoke-message').textContent='';$('revoke-dialog').showModal();});article.append(b);
    }
    $('list').append(article);
  }
  $('create').disabled=!fresh;
}
async function refresh(){
  $('refresh').disabled=true;$('service-state').textContent='Проверяем API…';
  try{
    const data=await request('/invitations');rows=data.items;fresh=true;
    $('issued').textContent=data.summary.issued;$('activated').textContent=data.summary.activated;$('active').textContent=data.summary.active_accesses;
    $('legacy').hidden=!(data.summary.legacy_created_unknown||data.summary.legacy_activated_unknown);
    $('service-state').textContent='API доступен · проверено только что';notice();render();return true;
  }catch(error){fresh=false;render();$('service-state').textContent='Не удалось проверить API';notice(error.message+' Список может быть устаревшим.');return false;
  }finally{$('refresh').disabled=false;}
}
async function enter(data){csrf=data.csrf;$('login').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;$('password').value='';await refresh();await refreshRequests();routeRequest();}
$('login-form').addEventListener('submit',async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;b.textContent='Входим…';try{await enter(await request('/login',{method:'POST',body:JSON.stringify({password:$('password').value})}));}catch(error){notice(error.message);}finally{b.disabled=false;b.textContent='Войти';}});
$('logout').addEventListener('click',async()=>{try{await request('/logout',{method:'POST'});rows=[];$('list').replaceChildren();pendingOperation=null;$('label').value='';loseSession('Вы вышли.');}catch(error){notice(error.message);}});
$('refresh').addEventListener('click',refresh);$('search').addEventListener('input',render);
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;render();}));
$('create').addEventListener('click',()=>{
  $('create-form').hidden=false;$('result').hidden=true;$('check-list').hidden=true;$('create-message').textContent='';$('invite-text').value='';resultCopied=false;
  $('create-dialog').showModal();$('label').focus();
});
function closeCreate(){
  if(creating)return;
  if($('invite-text').value&&!resultCopied&&!confirm('Закрыть без копирования? Этот код нельзя будет восстановить.'))return;
  $('invite-text').value='';$('create-dialog').close();
}
$('close-create').addEventListener('click',closeCreate);$('done').addEventListener('click',closeCreate);
$('create-dialog').addEventListener('cancel',e=>{e.preventDefault();closeCreate();});
$('create-form').addEventListener('submit',async e=>{
  e.preventDefault();if(creating)return;
  if(!pendingOperation)pendingOperation={id:crypto.randomUUID(),label:$('label').value.trim()};
  const b=e.submitter;creating=true;b.disabled=true;b.textContent='Создаём…';$('label').disabled=true;
  $('create-message').textContent='';
  try{
    const result=await request('/invitations',{method:'POST',body:JSON.stringify({label:pendingOperation.label,operation_id:pendingOperation.id})});
    pendingOperation=null;$('label').value='';filter='pending';$('search').value='';
    if(result.already_created){$('create-message').textContent='Это приглашение уже создано. Код повторно не выдаётся. Проверьте список; если код потерян, отмените приглашение и создайте новое.';$('check-list').hidden=false;}
    else{
      $('create-form').hidden=true;$('result').hidden=false;$('result-state').textContent='Приглашение создано';
      $('invite-text').value=`Приглашение в Дейчи\n${result.url}\n\nКод: ${result.code.match(/.{4}/g).join('-')}\nОткройте ссылку на телефоне с установленным Дейчи. Приглашение одноразовое, активировать можно в течение 7 дней.`;
      $('copy').textContent='Скопировать текст';$('copy').focus();
    }
    await refresh();
  }catch(error){$('create-message').textContent=error.message+' Результат создания может быть неизвестен. Повтор с той же меткой не создаст дубль.';$('check-list').hidden=false;
  }finally{creating=false;b.disabled=false;b.textContent=pendingOperation?'Проверить / повторить':'Создать';$('label').disabled=Boolean(pendingOperation);}
});
$('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('invite-text').value);resultCopied=true;$('copy').textContent='Текст скопирован';}catch{ $('invite-text').focus();$('invite-text').select();$('create-message').textContent='Не удалось скопировать автоматически. Текст выделен — скопируйте его вручную.';}});
$('check-list').addEventListener('click',async()=>{
  if(creating)return;filter='pending';$('search').value=pendingOperation?.label||'';
  if(await refresh()){ $('create-dialog').close();notice('Проверьте список. Если результат неизвестен, снова откройте создание: повтор использует ту же операцию.'); }
});
$('cancel-revoke').addEventListener('click',()=>{if(!revoking)$('revoke-dialog').close();});
$('revoke-dialog').addEventListener('cancel',e=>{if(revoking)e.preventDefault();});
$('confirm-revoke').addEventListener('click',async()=>{
  if(revoking)return;revoking=true;$('confirm-revoke').disabled=true;
  try{await request('/invitations/'+encodeURIComponent(revokeId)+'/revoke',{method:'POST'});$('revoke-dialog').close();await refresh();}
  catch(error){$('revoke-message').textContent=error.message+' При неизвестном результате повтор безопасен.';}
  finally{revoking=false;$('confirm-revoke').disabled=false;}
});
window.addEventListener('offline',()=>{fresh=false;render();notice('Нет интернета. Список может быть устаревшим.');});
window.addEventListener('online',()=>{if(csrf)refresh();});
request('/session').then(enter).catch(error=>loseSession(error.message));

// Access requests: hash routes survive login; no credentials enter the URL.
let accessRequests=[], requestFilter='pending', requestFresh=false, deciding=false, requestScroll=0, requestSection=true, routedRequest='';
const requestNames={pending:'Ожидает',approved:'Одобрена',active:'Доступ открыт',rejected:'Отклонена',revoked:'Доступ отозван',signed_out:'Вышел на телефоне'};
const selectedRequest=()=>/^#request=([a-f0-9]{32})$/.exec(location.hash)?.[1];
function showRequestSection(show){
  requestSection=show;$('requests-workspace').hidden=!show;$('invitation-workspace').hidden=show;
  $('requests-tab').setAttribute('aria-pressed',String(show));$('invites-tab').setAttribute('aria-pressed',String(!show));
}
function routeRequest(){
  if(!csrf)return;
  const identity=selectedRequest();
  if(identity!==routedRequest){if($('reject-request-dialog').open)$('reject-request-dialog').close();$('request-message').textContent='';routedRequest=identity;}
  if(identity)showRequestSection(true);
  $('requests-list-screen').hidden=Boolean(identity);$('request-detail').hidden=!identity;
  renderRequests();
}
function renderRequests(){
  const identity=selectedRequest(), query=$('request-search').value.trim().toLocaleLowerCase('ru');
  $('requests-count').textContent=accessRequests.filter(r=>r.status==='pending').length+' ожидают';
  $('requests-tab').textContent='Заявки'+(accessRequests.some(r=>r.status==='pending')?' · '+accessRequests.filter(r=>r.status==='pending').length:'');
  $('request-pending').setAttribute('aria-pressed',String(requestFilter==='pending'));$('request-all').setAttribute('aria-pressed',String(requestFilter==='all'));
  const list=$('requests-list');list.replaceChildren();
  for(const row of accessRequests.filter(r=>(requestFilter==='all'||r.status==='pending')&&`${r.first_name} ${r.last_name} ${r.telegram}`.toLocaleLowerCase('ru').includes(query))){
    const b=document.createElement('button');b.className='request-row';
    const title=document.createElement('strong'), meta=document.createElement('span'), status=document.createElement('span');
    title.textContent=row.first_name+' '+row.last_name;status.textContent=requestNames[row.status]||row.status;status.className='status';
    meta.textContent=(row.telegram?'@'+row.telegram:'без Telegram')+' · '+date(row.created_at);meta.className='muted small';
    b.append(title,status,meta);b.addEventListener('click',()=>{requestScroll=window.scrollY;history.pushState({requestList:true},'', '#request='+row.id);routeRequest();window.scrollTo(0,0);});list.append(b);
  }
  if(!list.children.length){const p=document.createElement('p');p.className='empty';p.textContent=query?'Ничего не найдено.':'Здесь пока нет заявок.';list.append(p);}
  if(!identity)return;
  const row=accessRequests.find(r=>r.id===identity);
  $('request-actions').hidden=!row||row.status!=='pending';$('request-approve').disabled=deciding||!requestFresh;$('request-reject').disabled=deciding||!requestFresh;
  if(!row){$('request-name').textContent='Заявка не найдена';$('request-status').textContent='';$('request-telegram').textContent='—';$('request-date').textContent='—';$('request-match').hidden=true;return;}
  $('request-name').textContent=row.first_name+' '+row.last_name;$('request-status').textContent=requestNames[row.status]||row.status;
  $('request-telegram').textContent=row.telegram?'@'+row.telegram:'не указан';$('request-date').textContent=date(row.created_at);
  const duplicates=accessRequests.filter(r=>r.id!==identity&&((r.first_name.toLocaleLowerCase('ru')===row.first_name.toLocaleLowerCase('ru')&&r.last_name.toLocaleLowerCase('ru')===row.last_name.toLocaleLowerCase('ru'))||(row.telegram&&r.telegram.toLowerCase()===row.telegram.toLowerCase())));
  $('request-match').hidden=!duplicates.length;$('request-match').textContent='Возможное совпадение. Других заявок с таким именем или Telegram: '+duplicates.length+'. Это может быть переустановка или другой человек. Автоматического объединения нет.';
}
async function refreshRequests(){
  $('request-refresh').disabled=true;$('request-check').disabled=true;
  try{const data=await request('/requests');if(!csrf)return false;accessRequests=data.items;requestFresh=true;$('requests-tab').hidden=false;$('requests-error').textContent='';renderRequests();return true;}
  catch(error){requestFresh=false;if(error.status===404){$('requests-tab').hidden=true;showRequestSection(false);}else $('requests-error').textContent=error.message+' Заявки не удалось обновить.';renderRequests();return false;}
  finally{$('request-refresh').disabled=false;$('request-check').disabled=false;}
}
async function decideRequest(decision){
  if(deciding||!requestFresh)return;
  const identity=selectedRequest();if(!identity)return;
  if(decision==='reject')$('reject-request-dialog').close();
  deciding=true;$('request-message').textContent='';renderRequests();
  try{await request('/requests/'+identity+'/'+decision,{method:'POST'});await refreshRequests();if(selectedRequest()===identity)$('request-message').textContent=decision==='approve'?'Одобрено. Телефон получит доступ при следующей проверке статуса.':'Заявка отклонена.';}
  catch(error){requestFresh=false;if(selectedRequest()===identity)$('request-message').textContent=error.message+' Результат может быть неизвестен. Проверьте статус перед повтором.';}
  finally{deciding=false;renderRequests();}
}
$('requests-tab').addEventListener('click',()=>{showRequestSection(true);void refreshRequests();});
$('invites-tab').addEventListener('click',()=>showRequestSection(false));
$('request-search').addEventListener('input',renderRequests);
$('request-pending').addEventListener('click',()=>{requestFilter='pending';renderRequests();});$('request-all').addEventListener('click',()=>{requestFilter='all';renderRequests();});
$('request-refresh').addEventListener('click',refreshRequests);$('request-check').addEventListener('click',async()=>{if(await refreshRequests())$('request-message').textContent='Статус обновлён.';});
$('request-approve').addEventListener('click',()=>decideRequest('approve'));$('request-reject').addEventListener('click',()=>{const row=accessRequests.find(r=>r.id===selectedRequest());if(!row||deciding||!requestFresh)return;$('reject-request-description').textContent=row.first_name+' '+row.last_name+' увидит «Заявка отклонена» при следующей проверке и сможет подать новую.';$('reject-request-dialog').showModal();});
$('cancel-reject-request').addEventListener('click',()=>$('reject-request-dialog').close());
$('confirm-reject-request').addEventListener('click',()=>decideRequest('reject'));
$('request-back').addEventListener('click',()=>{if(history.state?.requestList)history.back();else{history.replaceState(null,'',location.pathname);routeRequest();window.scrollTo(0,requestScroll);}});
window.addEventListener('popstate',()=>{routeRequest();if(!selectedRequest())window.scrollTo(0,requestScroll);});window.addEventListener('hashchange',routeRequest);
window.addEventListener('offline',()=>{requestFresh=false;renderRequests();});window.addEventListener('online',()=>{if(csrf)void refreshRequests();});
setInterval(()=>{if(csrf&&!document.hidden&&!deciding&&requestSection)void refreshRequests();},30000);
