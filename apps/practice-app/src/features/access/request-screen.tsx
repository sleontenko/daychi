import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Organic as C } from '../prototype/theme';
import { changeApplicant, checkAccessRequest, loadAccessRequest, newAccessRequest, submitAccessRequest, useAccessRequest, type Profile } from './request-client';

export default function RequestScreen({ onInvitation, onDone, onBack, returnLabel }: { onInvitation: () => void; onDone?: () => void; onBack?: () => void; returnLabel: string }) {
  const { record, ready, busy, error, checked } = useAccessRequest();
  const [attempted, setAttempted] = useState(false);
  const errors = { first_name: record.profile.first_name.trim() ? '' : 'Укажите имя.', last_name: record.profile.last_name.trim() ? '' : 'Укажите фамилию.', telegram: !record.profile.telegram.trim() || /^@?[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(record.profile.telegram.trim()) ? '' : 'Введите @имя или оставьте поле пустым.' };
  const invalid = Object.values(errors).some(Boolean);
  useEffect(() => {
    void loadAccessRequest().then(checkAccessRequest);
    const listener = AppState.addEventListener('change', value => { if (value === 'active') void checkAccessRequest(); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void checkAccessRequest(); }, 6000);
    return () => { listener.remove(); clearInterval(timer); };
  }, []);
  const terminal = ['rejected', 'revoked', 'signed_out'].includes(record.status);
  const draft = record.status === 'draft';
  const active = record.status === 'active';
  const title = draft ? 'Заявка на доступ' : active ? 'Доступ открыт' : record.status === 'rejected' ? 'Заявка отклонена' : terminal ? 'Доступ на этом телефоне закрыт' : 'Заявка на рассмотрении';
  const button = (label: string, action: () => void, secondary = false) => <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || !ready, busy }} disabled={busy || !ready} onPress={action} style={[s.button, secondary && (draft ? s.secondary : s.outline), busy && s.disabled]}><Text style={secondary ? s.link : s.label}>{label}</Text></Pressable>;
  return <View style={s.page}>
    {!draft && <View style={s.icon}><SymbolView name={{ ios: active ? 'checkmark.circle' : terminal ? 'exclamationmark.circle' : 'clock', android: active ? 'check_circle' : terminal ? 'error_outline' : 'schedule', web: active ? 'check_circle' : terminal ? 'error_outline' : 'schedule' }} tintColor={C.sageDark} size={30} /></View>}
    <View style={[s.intro, !draft && { gap: 16 }]}><Text accessibilityRole="header" style={s.title}>{title}</Text>
    <Text style={draft ? s.formBody : s.body}>{draft ? 'К вики и Zoom. Организатор рассмотрит заявку и откроет доступ этому телефону.' : active ? 'Закрытые материалы и Zoom доступны на этом телефоне.' : record.status === 'rejected' ? 'Если это ошибка, напишите организатору. Можно подать новую заявку.' : terminal ? 'Вы можете отправить новую заявку организатору. Расписание по-прежнему доступно.' : 'Уведомления не будет. Статус проверяется, когда вы открываете приложение и пока открыт этот экран. Расписание доступно.'}</Text></View>
    {!ready && <><ActivityIndicator color={C.accentDark} /><Pressable accessibilityRole="button" onPress={() => void loadAccessRequest()} style={s.secondary}><Text style={s.link}>Повторить проверку</Text></Pressable></>}
    {ready && draft && <>
      {([['first_name','Имя'], ['last_name','Фамилия'], ['telegram','Telegram — необязательно']] as [keyof Profile,string][]).map(([key,label]) => <View key={key} style={s.field}>
        <Text style={s.fieldLabel}>{label}</Text>
        <TextInput accessibilityLabel={label} value={record.profile[key]} onChangeText={value => changeApplicant(key,value)} editable={!busy && !record.submitted}
          placeholder={key === 'telegram' ? '@имя' : undefined} placeholderTextColor="#82796A" maxLength={key === 'telegram' ? 33 : 60}
          autoComplete={key === 'first_name' ? 'given-name' : key === 'last_name' ? 'family-name' : 'off'} autoCorrect={false}
          autoCapitalize={key === 'telegram' ? 'none' : 'words'} style={[s.input, attempted && errors[key] ? s.invalid : undefined]} />
        {attempted && !!errors[key] && <Text accessibilityRole="alert" style={s.fieldError}>{errors[key]}</Text>}
        {key === 'telegram' && <Text style={s.caption}>Чтобы организатор мог написать вам. Мы его не проверяем.</Text>}
      </View>)}
    </>}
    {ready && !draft && !active && <View style={s.card}><Text style={s.applicant}>{record.profile.first_name} {record.profile.last_name}</Text>{checked && <Text style={s.caption}>Проверено в {new Date(checked).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</Text>}</View>}
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {ready && (draft ? button(busy ? 'Отправляем…' : record.submitted ? 'Отправить ещё раз' : 'Отправить заявку', () => { setAttempted(true); if (!invalid) { Keyboard.dismiss(); void submitAccessRequest(); } })
      : active ? button(returnLabel, () => onDone?.())
      : terminal ? button('Подать новую заявку', () => { setAttempted(false); void newAccessRequest(); })
      : button(busy ? 'Проверяем…' : 'Проверить сейчас', () => void checkAccessRequest()))}
    {draft && button('У меня есть персональное приглашение', onInvitation, true)}
    {!draft && !active && onBack && button(returnLabel, onBack, true)}
    {draft && <Text style={[s.caption, s.center]}>Расписание доступно и без заявки.</Text>}
  </View>;
}
const s = StyleSheet.create({
  page: { gap: 16 }, intro: { gap: 6 }, center: { textAlign: 'center' }, formBody: { fontSize: 15, lineHeight: 22, color: C.text }, invalid: { borderColor: '#AD602D' }, fieldError: { fontSize: 14, color: '#8C491A', paddingHorizontal: 6 }, icon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#E2EDCF', alignItems: 'center', justifyContent: 'center' }, title: { fontSize: 26, lineHeight: 31, fontWeight: '700', color: C.text },
  applicant: { fontSize: 15, lineHeight: 22, fontWeight: '600', color: C.text },
  body: { fontSize: 16, lineHeight: 23, color: C.text }, caption: { fontSize: 13, lineHeight: 18, color: '#706B62' },
  field: { gap: 6 }, fieldLabel: { paddingHorizontal: 6, fontSize: 14, fontWeight: '600', color: C.text },
  input: { minHeight: 50, borderRadius: 99, borderWidth: 1.5, borderColor: C.neutral300, paddingHorizontal: 18, paddingVertical: 12, fontSize: 17, color: C.text, backgroundColor: C.neutral100 },
  card: { padding: 16, borderRadius: 20, gap: 4, backgroundColor: C.neutral100 },
  button: { minHeight: 52, borderRadius: 99, padding: 15, justifyContent: 'center', backgroundColor: '#AD602D' },
  outline: { backgroundColor: C.neutral100, borderWidth: 1.5, borderColor: C.accentBorder },
  secondary: { backgroundColor: 'transparent', minHeight: 44 }, label: { color: C.white, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  link: { color: C.accentDark, fontSize: 15, fontWeight: '600', textAlign: 'center' }, error: { color: '#8C491A', fontSize: 15, lineHeight: 22, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1, borderColor: C.accentBorder, backgroundColor: C.accentSoft }, disabled: { opacity: 0.6 },
});
