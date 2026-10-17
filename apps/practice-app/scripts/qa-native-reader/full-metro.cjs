const path=require('path');
if(process.env.DAYCHI_SYNTHETIC_READER_QA!=='1')throw Error('Synthetic QA requires explicit opt-in');
const appRoot=path.resolve(__dirname,'../..');
const {getDefaultConfig}=require(path.join(appRoot,'node_modules/expo/metro-config'));
const config=getDefaultConfig(appRoot),base=path.join(appRoot,'src/features');
const aliases=new Map([[path.join(base,'cabinet-account/session'),path.join(__dirname,'session.js')],[path.join(base,'wiki/cabinet-api'),path.join(__dirname,'api.js')],[path.join(base,'wiki/protected-reader'),path.join(__dirname,'full-reader-observer.js')]]);
config.resolver.resolveRequest=(context,name,platform)=>{const target=aliases.get(path.resolve(path.dirname(context.originModulePath),name));const result=target?{type:'sourceFile',filePath:target}:context.resolveRequest(context,name,platform);return result;};
module.exports=config;
