import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { notificationPermission } from '../schedule/local-reminders';
import { exactAlarmsAllowed } from '../schedule/exact-alarms';
import { accountReminderPlan, reconcileAccountReminders } from './reminders';
import type { ReminderState } from './controller';

export async function updateAccountReminders(state: ReminderState, enabled: boolean, current: () => boolean, pauseGuest = false) {
  if (Platform.OS === 'web') return { scheduled: 0, eligible: 0, through: null };
  const allowed = await notificationPermission(), exact = exactAlarmsAllowed();
  const plan = state.scope ? accountReminderPlan(state.scope, state.confirmed, state.calendar?.lessons ?? [], enabled && allowed, Date.now()) : [];
  return reconcileAccountReminders(plan, state.scope, {
    current, pauseGuest, preserveCurrent: !state.confirmed, capacity: 60, totalCapacity: Platform.OS === 'ios' ? 64 : 60,
    pending: async () => (await Notifications.getAllScheduledNotificationsAsync()).map(n => ({ id: n.identifier,
      at: Number(n.content.data?.reminderAt), title: String(n.content.data?.classTitle ?? ''),
      stale: Platform.OS === 'android' && n.content.data?.exactAlarmAllowed !== exact })),
    cancel: Notifications.cancelScheduledNotificationAsync,
    schedule: async item => {
      const time = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' }).format(new Date(item.lesson.startsAt));
      await Notifications.scheduleNotificationAsync({ identifier: item.id,
        content: { title: item.lesson.classTitle, body: `Занятие в ${time} · время Израиля`, sound: 'default',
          data: { occurrenceId: item.lesson.id, reminderAt: item.at, classTitle: item.lesson.classTitle,
            ...(Platform.OS === 'android' ? { exactAlarmAllowed: exact } : {}) } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(item.at),
          ...(Platform.OS === 'android' ? { channelId: 'practice-reminders' } : {}) } });
    },
  });
}
