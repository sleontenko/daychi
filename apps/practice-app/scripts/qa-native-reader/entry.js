import React,{useEffect,useState} from 'react';
import {registerRootComponent} from 'expo';
import {AppState,Pressable,Text,View,ScrollView} from 'react-native';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import CabinetWikiScreen from '../../src/features/wiki/cabinet-wiki-screen';
import CabinetAccountScreen from '../../src/features/cabinet-account/account-screen';
import {cabinetSession,signInCabinet,signOutCabinet} from './session';
import {toggleLegacy} from './access';
const button=(label,action)=><Pressable key={label} onPress={action} accessibilityRole="button" style={{padding:8,minHeight:36}}><Text style={{fontSize:12}}>{label}</Text></Pressable>;
function QA(){const [account,setAccount]=useState(false),[active,setActive]=useState(true),[controls,setControls]=useState(false);useEffect(()=>{globalThis.__qaOpenAccount=()=>setAccount(true);void cabinetSession().restore();const sub=AppState.addEventListener('change',value=>value==='active'?void cabinetSession().restore():cabinetSession().suspend());return()=>sub.remove();},[]);
const mode=async value=>{await fetch('http://127.0.0.1:8102/qa/mode/'+value,{method:'POST'});if(value==='active')await cabinetSession().restore();};
return <SafeAreaProvider><SafeAreaView style={{flex:1,backgroundColor:'#F5EAD8'}}><View style={{flexDirection:'row'}}>{button('QA',()=>setControls(!controls))}{button(account?'Назад в вики':'Аккаунт',()=>setAccount(!account))}{button(active?'Другой раздел':'Вики',()=>setActive(!active))}</View>{controls&&<View style={{flexDirection:'row',flexWrap:'wrap'}}>{button('Вход',()=>void signInCabinet())}{button('Выход',()=>void signOutCabinet())}{button('Legacy Zoom',toggleLegacy)}{['active','invalid','blocked','limited','offline'].map(value=>button(value,()=>void mode(value)))}</View>}{account?<ScrollView contentContainerStyle={{padding:20}}><CabinetAccountScreen/></ScrollView>:<CabinetWikiScreen active={active} onOpenAccess={()=>setAccount(true)}/>}</SafeAreaView></SafeAreaProvider>;}
registerRootComponent(QA);
