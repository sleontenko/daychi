import { LogBox, Platform } from 'react-native';
const original = globalThis.fetch;
globalThis.fetch = (value, options) => {
  const url = new URL(String(value));
  if (url.hostname === '127.0.0.1') return original(value, options);
  if (['staging.xuanxue.su', 'backend.test'].includes(url.hostname))
    return original('http://127.0.0.1:8116' + url.pathname + url.search, options);
  return Promise.reject(new Error('Synthetic fixture blocks external requests'));
};
LogBox.ignoreLogs(['Linking found multiple possible URI schemes in your Expo config.']);
require('expo-router/entry');
// Synthetic QA only: observable state and OS queue, never credentials or bodies.
setInterval(async () => {
  try {
    const { cabinetReminders } = require('../../src/features/cabinet-reminders/use-reminders');
    const { cabinetSession } = require('./session');
    const Notifications = require('expo-notifications');
    const Network = require('expo-network');
    const state = cabinetReminders().getState(), context = cabinetSession().reminderContext();
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    await original('http://127.0.0.1:8116/qa/receipt', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device: Platform.isPad ? 'ipad' : 'phone', phase: state.phase, online: state.online, loading: state.loading, revision: state.confirmed?.revision,
        lead: state.confirmed?.leadMinutes, classes: state.confirmed?.classIds, lessons: state.confirmed?.lessonIds,
        error: state.error, canEdit: cabinetReminders().canEdit(), status: context.status, generation: context.generation,
        network: await Network.getNetworkStateAsync(), pending: pending.map(n => ({ id: n.identifier, at: n.content.data?.reminderAt })) }) });
  } catch { /* Fixture diagnostics cannot affect the application. */ }
}, 2000);
