import {Platform} from 'react-native';
import {createProtectedWikiReader as create} from '../../src/features/wiki/protected-reader.ts';
export * from '../../src/features/wiki/protected-reader.ts';
// Observe existing bridge metadata only; the production controller remains intact.
export function createProtectedWikiReader(options) {
  const reader=create(options),checkpoint=reader.checkpoint;
  let previous='';
  reader.checkpoint=value=>{
    checkpoint(value);
    const next=JSON.stringify(value);
    if(next===previous)return;
    previous=next;
    void fetch('http://127.0.0.1:8102/qa/checkpoint',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...value,platform:Platform.OS,epoch:reader.getState().epoch,resume:reader.getState().location,device:Platform.OS==='ios'&&Platform.isPad?'ipad':'phone'})}).catch(()=>{});
  };
  return reader;
}
