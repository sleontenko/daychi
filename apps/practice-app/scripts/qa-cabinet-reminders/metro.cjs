const path = require('path');
if (process.env.DAYCHI_SYNTHETIC_REMINDERS_QA !== '1') throw Error('Explicit synthetic opt-in required');
const root = path.resolve(__dirname, '../..');
const config = require(path.join(root, 'node_modules/expo/metro-config')).getDefaultConfig(root);
config.resolver.resolveRequest = (context, name, platform) => {
  const target = path.resolve(path.dirname(context.originModulePath), name);
  if (target === path.join(root, 'src/features/cabinet-account/session')) return { type: 'sourceFile', filePath: path.join(__dirname, 'session.js') };
  if (name === '@react-native-async-storage/async-storage') return { type: 'sourceFile', filePath: path.join(__dirname, 'storage.js') };
  if (name === 'expo-secure-store') return { type: 'sourceFile', filePath: path.join(__dirname, 'secure.js') };
  return context.resolveRequest(context, name, platform);
};
module.exports = config;
