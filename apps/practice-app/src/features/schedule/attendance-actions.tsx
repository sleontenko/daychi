import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Organic as C } from '../prototype/theme';
import { isChosen, subscribed, type Attendance } from './attendance';
import type { Occurrence } from './model';

export default function AttendanceActions({ event, prefs, now, disabled, onChoose, onToggle, onCancel }: {
  event: Occurrence; prefs: Attendance; now: number; disabled: boolean;
  onChoose: (weekly: boolean) => void; onToggle: () => void; onCancel: () => void;
}) {
  const [weekly, setWeekly] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const chosen = isChosen(event, prefs), recurring = subscribed(event, prefs);
  const unavailable = event.status === 'cancelled' || Date.parse(event.starts_at) <= now;
  const button = (title: string, action: () => void, primary = false) =>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={action}
      style={({ pressed }) => [s.button, primary && s.primary, (pressed || disabled) && { opacity: 0.5 }]}>
      <Text style={[s.label, primary && { color: C.white }]}>{title}</Text>
    </Pressable>;
  return <View style={s.section}>
    <Text style={s.caption}>Мой выбор</Text>
    {unavailable && <Text style={s.body}>{event.status === 'cancelled' ? 'Занятие отменено' : 'Занятие уже началось или завершилось'}</Text>}
    {recurring ? <>
      <Text style={s.body}>Хожу каждую неделю</Text>
      <Text style={s.caption}>{chosen ? 'Я иду · эта дата выбрана.' : 'Пропускаю эту дату. Следующие недели остаются выбранными.'}</Text>
      {button(expanded ? 'Скрыть действия' : 'Изменить выбор', () => setExpanded(x => !x))}
      {expanded && <>
        {!unavailable && button(chosen ? 'Пропустить эту дату' : 'Вернуть эту дату', onToggle)}
        {confirmCancel ? <><Text style={s.body}>Больше не ходить каждую неделю?</Text>
          {button('Да, убрать регулярный выбор', onCancel)}
          {button('Оставить', () => setConfirmCancel(false))}</>
          : button('Больше не ходить каждую неделю', () => setConfirmCancel(true))}
      </>}
    </> : chosen ? <>
      <Text style={s.body}>Я иду · только эта дата</Text>
      {button(expanded ? 'Скрыть действия' : 'Изменить выбор', () => setExpanded(x => !x))}
      {expanded && <>
        {!unavailable && button('Ходить каждую неделю', () => onChoose(true))}
        {button('Убрать эту дату', onToggle)}
      </>}
    </> : !unavailable && <>
      <View style={s.options}>{[[true, 'Каждую неделю'], [false, 'Только эту дату']].map(([value, label]) =>
        <Pressable key={String(value)} accessibilityRole="button" accessibilityState={{ selected: weekly === value, disabled }} disabled={disabled}
          onPress={() => setWeekly(value === true)} style={[s.option, weekly === value && s.selected]}>
          <Text style={[s.optionLabel, weekly === value && s.selectedLabel]}>{label}</Text>
        </Pressable>)}</View>
      {button(weekly ? `Начну ходить ${new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'long' }).format(new Date(event.starts_at))}` : 'Пойду на эту дату', () => onChoose(weekly), true)}
      <Text style={s.caption}>{weekly ? 'Начиная с этой даты, каждую неделю до отмены.' : 'Сохранится только эта дата.'} Это личный выбор, не запись у преподавателя.</Text>
    </>}
    {recurring && <Text style={s.caption}>Напоминания на ближайшие 14 дней обновляются при открытии приложения.</Text>}
  </View>;
}

const s = StyleSheet.create({
  section: { gap: 12 }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, padding: 4, borderRadius: 999, backgroundColor: C.neutral200 },
  option: { flexGrow: 1, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, justifyContent: 'center' },
  selected: { backgroundColor: C.neutral100 },
  optionLabel: { color: '#68635B', fontSize: 15, textAlign: 'center', fontWeight: '500' },
  selectedLabel: { color: C.text, fontWeight: '600' },
  button: { minHeight: 48, padding: 16, borderRadius: 999, borderWidth: 1, borderColor: C.divider },
  primary: { backgroundColor: '#B2622D', borderColor: '#B2622D' }, label: { color: C.accentDark, fontSize: 16, textAlign: 'center', fontWeight: '500' },
  body: { fontSize: 18, color: C.text }, caption: { fontSize: 14, lineHeight: 21, color: '#68635B' },
});
