import { cabinetContentEnabled } from '../wiki/cabinet-api';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Organic as C } from '../prototype/theme';
import { cabinetSession, cancelCabinetSignIn, signInCabinet, signOutCabinet, useCabinetAccount } from './session';

export default function CabinetAccountScreen() {
  const state = useCabinetAccount(), [stamp, setStamp] = useState(Date.now);
  useEffect(() => { void cabinetSession().restore(); return () => { if (cabinetSession().getState().signIn !== 'idle') void cancelCabinetSignIn(); }; }, []);
  useEffect(() => {
    if (state.retryAt <= Date.now()) return;
    const timer = setTimeout(() => setStamp(Date.now()), state.retryAt - Date.now());
    return () => clearTimeout(timer);
  }, [state.retryAt]);
  const busy = state.status === 'checking' || state.signIn !== 'idle';
  const delayed = state.retryAt > stamp;
  const button = (label: string, action: () => Promise<unknown>, primary = false, disabled = false) =>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={() => void action()}
      style={[s.button, primary && s.primary, disabled && s.disabled]}><Text style={[s.link, primary && s.white]}>{label}</Text></Pressable>;
  const blocked = state.status === 'blocked', incomplete = state.status === 'signout-incomplete';
  const localError = state.status === 'storage-error';
  return <View style={s.page}>
    <Text accessibilityRole="header" style={s.title}>Аккаунт школы</Text>
    <Text style={s.body}>Войдите через кабинет школы. После входа приложение откроется само.</Text>
    {state.account && <View style={s.panel}>
      <Text accessibilityRole="header" style={s.heading}>{state.account.name || 'Ученик школы'}</Text>
      {state.account.email !== undefined && <Text selectable style={s.body}>{state.account.email}</Text>}
      <Text style={s.caption}>{state.status === 'active' ? 'Вход выполнен' : 'Последние полученные данные · аккаунт сейчас не подтверждён'}</Text>
    </View>}
    {busy && <View accessibilityLiveRegion="polite" style={s.progress}><ActivityIndicator color={C.accentDark} /><Text style={s.body}>
      {state.signIn === 'browser' ? 'Завершите вход в браузере' : state.signIn === 'exchange' ? 'Завершаем вход…' : 'Проверяем аккаунт…'}</Text></View>}
    {blocked && <Text accessibilityRole="alert" style={s.body}>Доступ к аккаунту ограничен школой. После восстановления доступа нажмите «Проверить снова».</Text>}
    {incomplete && <Text accessibilityRole="alert" style={s.body}>Выход не завершён: не удалось удалить вход с телефона. Аккаунт сейчас отключён, но после перезапуска вход может сохраниться.</Text>}
    {localError && <Text accessibilityRole="alert" style={s.body}>Не удалось прочитать или сохранить вход на телефоне. Повторите действие.</Text>}
    {state.error && !blocked && !incomplete && !localError && <Text accessibilityRole="alert" style={s.body}>
      {delayed ? 'Слишком много попыток. Повторите позже.' : state.error === 'invalid_token' ? 'Вход закончился. Войдите заново.' :
        state.error === 'interrupted' || state.error === 'invalid_grant' || state.error === 'expired' ? 'Вход не завершён. Начните вход заново.' : 'Не удалось подтвердить аккаунт. Проверьте интернет и повторите попытку.'}</Text>}
    {state.signIn !== 'idle' ? button('Отменить вход', cancelCabinetSignIn) : <>
      {!state.hasSession && !incomplete && button('Войти через кабинет', signInCabinet, true, busy || delayed)}
      {(state.hasSession || localError) && !incomplete && button(blocked ? 'Проверить снова' : 'Обновить', () => cabinetSession().restore(), false, busy || delayed)}
      {(state.hasSession || incomplete || localError) && button(incomplete ? 'Повторить выход' : 'Выйти', signOutCabinet)}
    </>}
    <Text style={s.caption}>{cabinetContentEnabled ? 'Материалы и записи вики открываются через кабинет. Для подключения к онлайн-занятию сохраняется отдельный доступ школы.' : 'Вход в кабинет пока не открывает закрытые записи и онлайн-ссылки. Тексты вики доступны без входа.'}</Text>
  </View>;
}
const s = StyleSheet.create({
  page: { gap: 18 }, title: { fontSize: 30, lineHeight: 35, fontWeight: '700', color: C.text },
  heading: { fontSize: 20, fontWeight: '600', color: C.text }, body: { fontSize: 17, lineHeight: 25, color: C.text },
  caption: { fontSize: 14, lineHeight: 21, color: '#645C50' }, panel: { backgroundColor: C.neutral100, borderRadius: 20, padding: 16, gap: 8 },
  progress: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  button: { minHeight: 44, padding: 12, borderRadius: 999, borderWidth: 1, borderColor: C.divider, justifyContent: 'center' },
  primary: { backgroundColor: '#B2622D', borderColor: '#B2622D' }, disabled: { opacity: 0.5 },
  link: { fontSize: 16, fontWeight: '600', color: C.accentDark, textAlign: 'center' }, white: { color: C.white },
});
