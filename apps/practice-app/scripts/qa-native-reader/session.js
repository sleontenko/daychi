import {useSyncExternalStore} from 'react';
import {createAccountSession} from '../../src/features/cabinet-account/session-core';
import {CabinetError,CALLBACK,meDTO} from '../../src/features/cabinet-account/protocol';
const ORIGIN='http://127.0.0.1:8102',TOKEN='synthetic-native-token',GRANT='synthetic-grant-123456',memory=new Map();
export const cabinetAccountEnabled=true;
const session=createAccountSession({origin:'https://staging.xuanxue.su',storage:{get:async key=>memory.get(key)??null,set:async(key,value)=>{memory.set(key,value);},delete:async key=>{memory.delete(key);}},random:async()=> 'a'.repeat(43),challenge:async()=> 'b'.repeat(43),client:{me:async()=>{const response=await fetch(ORIGIN+'/qa/me');if(!response.ok)throw new CabinetError(response.status===401?'invalid_token':response.status===403?'account_blocked':response.status===429?'rate_limited':'temporarily_unavailable',response.status===429?7:undefined);return meDTO(await response.json(),GRANT);},exchange:async()=>({access_token:TOKEN,session_id:GRANT,expires_in:7776000,renew_after:604801}),renew:async()=>{throw Error('No synthetic renewal');},revoke:async()=>{}}});
export const cabinetSession=()=>session;
export const useCabinetAccount=()=>useSyncExternalStore(session.subscribe,session.getState,session.getState);
export async function signInCabinet(){await fetch(ORIGIN+'/qa/mode/active',{method:'POST'});const attempt=await session.begin();if(attempt)await session.receive(CALLBACK+'?code='+ 'c'.repeat(43)+'&state='+attempt.state+'&iss='+encodeURIComponent('https://staging.xuanxue.su'));}
export const signOutCabinet=()=>session.logout();
export const cancelCabinetSignIn=()=>session.cancel();
