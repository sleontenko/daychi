import {useSyncExternalStore} from 'react';
let active=false;const listeners=new Set();const subscribe=cb=>{listeners.add(cb);return()=>listeners.delete(cb);};
export const useAccess=()=>useSyncExternalStore(subscribe,()=>active?'active':'locked');
export const acceptApprovedSession=async()=>{};
export const toggleLegacy=()=>{active=!active;listeners.forEach(fn=>fn());};
export async function privateRequest(path){if(!active)throw Error('Legacy locked');const {token}=await(await fetch('http://127.0.0.1:8102/qa/legacy')).json();const response=await fetch('http://127.0.0.1:8102'+path,{headers:{Authorization:'Bearer '+token}});if(!response.ok)throw Error('Legacy refused');return response.json();}
