import { graphOverview } from './graph-layout.mjs';

const preview=document.querySelector('.graph-preview-link');
const svg=document.querySelector('#knowledge-graph');
const stage=document.querySelector('#graph-stage');
const message=document.querySelector('#graph-message');
const messageText=document.querySelector('#graph-message-text');
const retry=document.querySelector('#graph-retry');
const count=document.querySelector('#graph-count');
const ns='http://www.w3.org/2000/svg';
const numbers=new Intl.NumberFormat('ru-RU'),plurals=new Intl.PluralRules('ru-RU');
function quantity(n,forms){return `${numbers.format(n)} ${forms[plurals.select(n)]||forms.many}`;}
const materials=n=>quantity(n,{one:'материал',few:'материала',many:'материалов'});
const sections=n=>quantity(n,{one:'раздел',few:'раздела',many:'разделов'});
function element(tag,attrs={},text){const el=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));if(text!==undefined)el.textContent=text;return el;}
function renderGraph(view){
  const description=element('title',{id:'graph-description'},`Граф вики: ${materials(view.materialCount)}, ${sections(view.sectionCount)}. Связи по разделам и сериям занятий.`);
  const groups=new Map(view.centers.map(c=>[c.id,element('g',{class:'cluster'})]));
  for(const e of view.edges){const a=view.positions.get(e.s),b=view.positions.get(e.t);if(!a||!b)continue;const group=groups.get(a.sec);group.append(element('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:e.k==='series'?'#8fa073':'#b9aa94',class:'graph-edge'}));}
  for(const c of view.centers){const group=groups.get(c.id);group.append(element('title',{},`${c.name}: ${materials(c.count)}`));for(const n of view.positions.values()){if(n.sec!==c.id)continue;group.append(element('circle',{cx:n.x,cy:n.y,r:n.type==='section'?6:n.type==='subtopic'?3:1.9,fill:c.color,class:n.type==='section'?'graph-section':'graph-node'}));}if(c.rank<8)group.append(element('text',{x:c.x,y:c.y+7,'text-anchor':'middle',class:`graph-label ${c.rank<3?'major':c.rank<6?'regular':'minor'}`},c.name));}
  svg.replaceChildren(description,...groups.values());
  count.textContent=`${materials(view.materialCount)} · ${sections(view.sectionCount)}`;
  svg.removeAttribute('hidden');preview.hidden=false;message.hidden=true;
}
async function loadGraph(){
  preview.hidden=true;retry.disabled=true;retry.hidden=true;svg.setAttribute('hidden','');message.hidden=false;message.classList.add('loading');
  messageText.textContent='Загружаем граф вики…';stage.setAttribute('aria-busy','true');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try {
    const response=await fetch('/api/site/wiki-graph',{credentials:'omit',signal:controller.signal,cache:'no-store'});
    if(!response.ok)throw new Error('Graph unavailable');
    const view=graphOverview(await response.json());
    if(!view.materialCount){messageText.textContent='В графе пока нет материалов.';count.textContent='Текущие разделы вики';return;}
    renderGraph(view);
  }catch{
    messageText.textContent='Граф сейчас недоступен. Проверьте интернет и попробуйте снова.';
    count.textContent='Текущие разделы вики';retry.hidden=false;
  }finally{clearTimeout(timer);retry.disabled=false;message.classList.remove('loading');stage.setAttribute('aria-busy','false');}
}
retry.addEventListener('click',loadGraph);
loadGraph();
