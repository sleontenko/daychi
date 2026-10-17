import {createCabinetContentClient,CONTENT_MISSING} from '../../src/features/wiki/cabinet-content-client';
import {cabinetSession} from './session';
export const cabinetContentEnabled=true;
const read=createCabinetContentClient('https://backend.test',async(url,options)=>{const response=await fetch('http://127.0.0.1:8102'+new URL(url).pathname+new URL(url).search,options);return {status:response.status,headers:response.headers,url,json:()=>response.json()};});
export async function cabinetWikiRequest(path){const value=await cabinetSession().readContent(token=>read(path,token));if(value===CONTENT_MISSING)throw Error('404');return value;}
