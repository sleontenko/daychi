import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { retireServerReminders } from './device';
import { reconcileReminders, reminderPlan, type Preferences } from './reminder-plan';
import type { Occurrence } from './model';

export async function notificationPermission(request = false) {
  if (Platform.OS !== 'ios') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  return request ? (await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } })).granted : false;
}

export async function updateReminders(events: Occurrence[], prefs: Preferences) {
  if (Platform.OS !== 'ios') return 0;
  // Existing build-2 users must stop server reminders before enabling local ones.
  // A failed opt-out is visible and retried; never silently double-deliver.
  await retireServerReminders();
  const allowed = await notificationPermission();
  const plan = reminderPlan(events, { ...prefs, enabled: prefs.enabled && allowed }, Date.now());
  return reconcileReminders(plan, {
    pending: async () => (await Notifications.getAllScheduledNotificationsAsync()).map(n => ({
      id: n.identifier, at: Number(n.content.data?.reminderAt), title: String(n.content.data?.classTitle ?? ''),
    })),
    cancel: Notifications.cancelScheduledNotificationAsync,
    schedule: async item => {
      const time = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' }).format(new Date(item.event.starts_at));
      await Notifications.scheduleNotificationAsync({ identifier: item.id,
        content: { title: item.event.title, body: `Занятие в ${time} · время Израиля`, sound: 'default',
          data: { occurrenceId: item.event.id, reminderAt: item.at, classTitle: item.event.title } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(item.at) } });
    },
  });
}

export async function testReminder() {
  if (!await notificationPermission(true)) throw new Error('Разреши уведомления в настройках iPhone.');
  await Notifications.scheduleNotificationAsync({ identifier: 'quiet-test',
    content: { title: 'Тихая практика', body: 'Всё готово. Здесь будут напоминания о выбранных занятиях.', sound: 'default' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(Date.now() + 10000) } });
}
