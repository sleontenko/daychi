const path=require('path');
if(process.env.DAYCHI_SYNTHETIC_READER_QA!=='1')throw Error('Synthetic QA requires explicit local opt-in');
const appRoot=path.resolve(__dirname,'../..');const {getDefaultConfig}=require(path.join(appRoot,'node_modules/expo/metro-config'));const config=getDefaultConfig(appRoot),base=path.join(appRoot,'src/features');
const aliases=new Map([[path.join(base,'cabinet-account/session'),path.join(__dirname,'session.js')],[path.join(base,'wiki/cabinet-api'),path.join(__dirname,'api.js')],[path.join(base,'access/session'),path.join(__dirname,'access.js')]]);
config.resolver.resolveRequest=(context,name,platform)=>{if(name==='expo-router'&&context.originModulePath.startsWith(base))return {type:'sourceFile',filePath:path.join(__dirname,'router.js')};const target=aliases.get(path.resolve(path.dirname(context.originModulePath),name));return target?{type:'sourceFile',filePath:target}:context.resolveRequest(context,name,platform);};
module.exports=config;
