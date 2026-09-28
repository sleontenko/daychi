import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

type ExactAlarms = { canScheduleExactAlarms(): boolean; openSettings(): Promise<void> };
const native = Platform.OS === 'android' ? requireOptionalNativeModule<ExactAlarms>('DaycheeExactAlarms') : null;

export function exactAlarmsAllowed(): boolean {
  return Platform.OS !== 'android' || native?.canScheduleExactAlarms() === true;
}

export async function openExactAlarmSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (!native) throw new Error('Обнови приложение, чтобы настроить точные напоминания.');
  await native.openSettings();
}
