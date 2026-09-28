import { AccessError, invitationErrors } from './access-errors';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { Organic as C } from '../prototype/theme';
import { logoutAccess, redeemInvitation, restoreAccess, useAccess } from './session';
import { invitationCredential } from './invitation-code';
import { clearInvitation } from './invitation-link';

export function AccessGate({ onOpen }: { onOpen: () => void }) {
  const status = useAccess();
  const checking = status === 'loading';
  return <ScrollView contentContainerStyle={s.page}>
    <View style={s.intro}><Text accessibilityRole="header" style={s.title}>Живая база знаний</Text>
    <Text style={s.caption}>Материалы для практики</Text></View>
    <View style={s.panel}>
      {checking ? <ActivityIndicator color={C.accentDark} /> : <SymbolView name={{ ios: 'lock', android: 'lock_outline', web: 'lock_outline' }} size={26} tintColor={C.accentDark} />}
      <Text style={s.heading}>{checking ? 'Проверяем доступ…' : status === 'offline' ? 'Не удалось проверить доступ' : 'Материалы открываются по приглашению'}</Text>
      <Text style={s.caption}>{status === 'offline' ? 'Вход на этом телефоне сохранён. Проверьте интернет и повторите попытку.' : 'Для входа попросите в школе новое персональное приглашение и откройте его на этом телефоне — без пароля и регистрации. Расписание и выбор занятий работают и без него.'}</Text>
      {!checking && <Pressable accessibilityRole="button" onPress={status === 'offline' ? () => void restoreAccess() : onOpen} style={s.outline}><Text style={s.link}>{status === 'offline' ? 'Проверить снова' : 'Как получить доступ'}</Text></Pressable>}
    </View>
  </ScrollView>;
}

export default function AccessScreen({ invitation, onDone, returnLabel = 'Открыть вики', onCancel, embedded = false }: { invitation?: string; onDone?: () => void; onCancel?: () => void; returnLabel?: string; embedded?: boolean }) {
  const status = useAccess();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [success, setSuccess] = useState(false);
  const [rejection, setRejection] = useState<string | null>(null);
  async function act(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); } catch (e) { if (e instanceof AccessError) setRejection(e.code); else setError(e instanceof Error ? e.message : 'Не удалось проверить доступ.'); }
    finally { setBusy(false); }
  }
  async function enter() {
    const credential = invitationCredential(invitation ?? input);
    if (!credential) { setError('Проверьте код из приглашения: 12 букв и цифр. Можно также вставить ссылку целиком.'); return; }
    await act(async () => { await redeemInvitation(credential); setInput(''); setSuccess(true); });
  }
  function done() { setSuccess(false); clearInvitation(); onDone?.(); }
  function returnAfterRejection() { setRejection(null); clearInvitation(); (onCancel ?? onDone)?.(); }
  const activate = <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => void enter()} style={[s.button, busy && s.disabled]}>
    <Text style={s.label}>{busy ? 'Проверяем…' : invitation ? 'Получить доступ' : 'Активировать'}</Text></Pressable>;
  const content = <View style={embedded ? s.embedded : s.page}>
    <Text accessibilityRole="header" style={s.title}>{invitation ? 'Ваше приглашение' : 'Доступ по приглашению'}</Text>
    <View style={s.status}><Text style={s.heading}>{status === 'active' ? 'Доступ открыт' : status === 'offline' ? 'Вход сохранён' : 'Доступа пока нет'}</Text>
      <Text style={s.body}>{status === 'active' ? 'Вход сохранён на этом телефоне — пароль не нужен. Открыты материалы вики и подключение к онлайн-занятиям.' : status === 'offline' ? 'Не удалось проверить доступ. Проверьте интернет и повторите попытку.' : 'Расписание, выбор занятий и напоминания работают и без него. Материалы вики и подключение к онлайн-занятиям закрыты.'}</Text></View>
    {status !== 'active' && <>
      {!invitation && <><Text style={s.eyebrow}>КАК ПОЛУЧИТЬ ДОСТУП</Text><View style={s.panel}>
        <Text style={s.body}>1. Попросите в школе персональное приглашение — тем же способом, каким вы обычно связываетесь со школой.</Text>
        <Text style={s.body}>2. Откройте ссылку на этом телефоне. Если приложения ещё нет, сначала установите его, затем нажмите ссылку ещё раз.</Text>
        <Text style={s.body}>3. Нажмите «Получить доступ» — или введите код ниже. Пароль и регистрация не нужны.</Text>
      </View></>}
      <View style={s.destination}><Text style={s.body}>После активации: {returnLabel.toLocaleLowerCase('ru')}.</Text></View>
      {!invitation && <View style={s.field}><Text style={s.eyebrow}>КОД ИЗ ПРИГЛАШЕНИЯ</Text>
        <View style={s.codeRow}><TextInput accessibilityLabel="Код приглашения или ссылка" placeholder="XXXX-XXXX-XXXX" placeholderTextColor="#82796A" value={input}
          onChangeText={value => { setInput(value); setError(''); }} editable={!busy} autoCapitalize="characters" autoCorrect={false} spellCheck={false} autoComplete="off"
          maxLength={512} returnKeyType="go" onSubmitEditing={() => void enter()} style={[s.input, s.codeInput]} />{activate}</View></View>}
      {!!error && <Text accessibilityRole="alert" style={s.body}>{error}</Text>}
      {invitation && activate}
      <Text style={s.caption}>Код — запасной путь, если ссылка не открыла приложение. Он одноразовый и действует 7 дней.</Text>
      {status === 'offline' && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void act(restoreAccess)} style={s.secondary}><Text style={s.link}>Проверить снова</Text></Pressable>}
    </>}
    {status === 'active' && <>
      {!!error && <Text accessibilityRole="alert" style={s.body}>{error}</Text>}
      {invitation && <Pressable accessibilityRole="button" onPress={done} style={s.button}><Text style={s.label}>{returnLabel}</Text></Pressable>}
      <Text style={s.caption}>После выхода или для другого телефона потребуется новое приглашение.</Text>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void act(logoutAccess)} style={s.secondary}><Text style={s.link}>{busy ? 'Выходим…' : 'Выйти на этом телефоне'}</Text></Pressable>
    </>}
    <Text style={s.caption}>Вход, закладки и выбор хранятся только на этом телефоне и пока не переносятся на другие устройства.</Text>
    {invitation && onDone && <Pressable accessibilityRole="button" onPress={onCancel ?? onDone} style={s.secondary}><Text style={s.link}>Вернуться в приложение</Text></Pressable>}
    <Modal visible={success || !!rejection} animationType="fade" onRequestClose={() => rejection ? setRejection(null) : done()}>
      <SafeAreaProvider><SafeAreaView style={s.success}>
        <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" onPress={() => rejection ? setRejection(null) : done()} style={s.close}><SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={20} tintColor={C.text} /></Pressable>
        <View style={s.successBody}><SymbolView name={{ ios: rejection ? 'exclamationmark.circle' : 'checkmark.circle.fill', android: rejection ? 'error_outline' : 'check_circle', web: rejection ? 'error_outline' : 'check_circle' }} size={42} tintColor={C.sageDark} />
          <Text accessibilityRole="header" style={s.title}>{rejection ? invitationErrors[rejection].title : 'Доступ открыт'}</Text>
          <Text style={s.body}>{rejection ? invitationErrors[rejection].message : 'На этом телефоне теперь доступны материалы вики и подключение к онлайн-занятиям. Вход сохранён — вводить ничего не нужно.'}</Text>
          <Text style={s.caption}>{rejection ? 'Общее расписание доступно и без приглашения.' : 'Закладки и выбор хранятся на этом телефоне и пока не переносятся на другие устройства.'}</Text>
        </View><Pressable accessibilityRole="button" onPress={() => rejection ? returnAfterRejection() : done()} style={s.button}><Text style={s.label}>{rejection ? 'Вернуться в приложение' : returnLabel}</Text></Pressable>
      </SafeAreaView></SafeAreaProvider>
    </Modal>
  </View>;
  return embedded ? content : <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>{content}</ScrollView></KeyboardAvoidingView>;
}
const s = StyleSheet.create({
  flex: { flex: 1 }, scroll: { flexGrow: 1 }, page: { padding: 16, gap: 14 }, embedded: { gap: 14 }, intro: { gap: 4 }, codeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, codeInput: { flexGrow: 1, flexBasis: 175 },
  title: { fontSize: 28, fontWeight: '700', color: C.text }, heading: { fontSize: 17, fontWeight: '600', color: C.text }, body: { fontSize: 16, lineHeight: 22, color: C.text },
  caption: { fontSize: 14, lineHeight: 21, color: '#706B62' }, eyebrow: { fontSize: 13, fontWeight: '600', color: '#706B62' }, field: { gap: 10 },
  panel: { backgroundColor: C.neutral100, borderRadius: 22, padding: 16, gap: 12 }, status: { backgroundColor: '#EEE9DD', borderRadius: 20, padding: 18, gap: 8 }, destination: { backgroundColor: '#E2EDCF', padding: 14, borderRadius: 16 },
  input: { minHeight: 52, borderWidth: 1, borderColor: C.divider, borderRadius: 99, paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, color: C.text, backgroundColor: C.neutral100 },
  button: { minHeight: 52, padding: 15, borderRadius: 99, backgroundColor: '#AD602D', justifyContent: 'center' }, disabled: { opacity: 0.65 },
  label: { fontSize: 16, fontWeight: '600', color: C.white, textAlign: 'center' }, outline: { borderWidth: 1, borderColor: C.divider, borderRadius: 99, padding: 14, alignSelf: 'flex-start' },
  secondary: { minHeight: 44, justifyContent: 'center' }, link: { fontSize: 16, color: C.accentDark }, success: { flex: 1, backgroundColor: C.background, padding: 20 }, successBody: { flex: 1, justifyContent: 'center', gap: 18 }, close: { alignSelf: 'flex-end', minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
