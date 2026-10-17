const nativeFetch = globalThis.fetch;
const origin = 'http://127.0.0.1:8102';
const day = new Date().toISOString().slice(0, 10);
const dateAt = n => new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const occurrences = [];
for (let n=1;n<=14;n++) for (let slot=0;slot<2;slot++) {
  const date=dateAt(n), kind=n%7;
  const zone='+'+String(Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jerusalem',hour:'2-digit',hourCycle:'h23'}).format(new Date(date+'T12:00:00Z')))-12).padStart(2,'0')+':00';
  occurrences.push({id:`qa-${kind}-${slot}:${date}`,title:slot?'Тайцзи (Парк)':'Медитация онлайн',starts_at:date+(slot?'T18:00:00':'T10:00:00')+zone,ends_at:date+(slot?'T19:00:00':'T11:00:00')+zone,status:'scheduled'});
}
globalThis.fetch = async (url, options) => {
  const text=String(url), parsed=new URL(text);
  if (text.startsWith(origin+'/')) return nativeFetch(url, options);
  if (parsed.pathname==='/api/v1/schedule') {
    const {mode}=await (await nativeFetch(origin+'/qa/schedule-mode')).json();
    if(mode==='offline')throw Error('Synthetic schedule offline');
    return new Response(JSON.stringify({revision:'synthetic-navigation-v1',fetched_at:new Date().toISOString(),valid_until:dateAt(16)+'T00:00:00Z',source_url:'https://www.telaviv-taiji.com/kogda',timezone:'Asia/Jerusalem',kind:'weekly_template',exceptions_verified:false,occurrences:mode==='empty'?[]:mode==='hide-series'?occurrences.filter(value=>!value.id.startsWith('qa-1-0:')):occurrences}),{status:200,headers:{'Content-Type':'application/json'}});
  }
  if (parsed.hostname==='backend.test') return nativeFetch(origin+parsed.pathname+parsed.search,options);
  // Native's independent school-HTML race fails locally; no external request.
  throw Error('Synthetic navigation fixture blocks external network');
};
