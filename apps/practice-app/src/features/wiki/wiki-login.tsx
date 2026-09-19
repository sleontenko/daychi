import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Organic as C } from '../prototype/theme';

type Props = {
  username: string; password: string; busy: boolean; error: string;
  onUsername: (value: string) => void; onPassword: (value: string) => void; onSubmit: () => void;
};

export default function WikiLogin({ username, password, busy, error, onUsername, onPassword, onSubmit }: Props) {
  const passwordInput = useRef<TextInput>(null);
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState<'username' | 'password' | null>(null);
  const disabled = busy || !username.trim() || !password;
  const submit = () => { if (!disabled) onSubmit(); };
  return <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={s.page}>
      <View style={s.content}>
        <View style={s.intro}>
          <Text accessibilityRole="header" style={s.title}>Вики школы</Text>
          <Text style={s.description}>Записи занятий и материалы,{ '\n' }к которым хочется вернуться.</Text>
        </View>
        <View style={s.form}>
          <View style={s.formIntro}>
            <Text accessibilityRole="header" style={s.heading}>Вход для учеников</Text>
            <Text style={s.hint}>Общий логин и пароль школы.{ '\n' }Регистрация не нужна.</Text>
          </View>
          <View style={s.field}>
            <Text nativeID="wiki-username-label" style={s.label}>Логин</Text>
            <TextInput accessibilityLabel="Логин" accessibilityLabelledBy="wiki-username-label" autoCapitalize="none" autoCorrect={false}
              autoComplete="username" textContentType="username" returnKeyType="next" submitBehavior="submit" editable={!busy}
              value={username} onChangeText={onUsername} onFocus={() => setFocused('username')} onBlur={() => setFocused(null)}
              onSubmitEditing={() => passwordInput.current?.focus()} selectionColor={C.accentDark}
              style={[s.input, focused === 'username' && s.focused]} />
          </View>
          <View style={s.field}>
            <View style={s.passwordLabel}>
              <Text nativeID="wiki-password-label" style={s.label}>Пароль</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Скрыть пароль' : 'Показать пароль'}
                accessibilityState={{ expanded: visible, disabled: busy }} disabled={busy} onPress={() => setVisible(x => !x)}
                style={({ pressed }) => [s.reveal, pressed && s.pressed]}>
                <Text style={s.revealText}>{visible ? 'Скрыть' : 'Показать'}</Text>
              </Pressable>
            </View>
            <TextInput ref={passwordInput} accessibilityLabel="Пароль" accessibilityLabelledBy="wiki-password-label" secureTextEntry={!visible}
              autoCapitalize="none" autoCorrect={false} autoComplete="current-password" textContentType="password" returnKeyType="go"
              editable={!busy} value={password} onChangeText={onPassword} onSubmitEditing={submit}
              onFocus={() => setFocused('password')} onBlur={() => setFocused(null)} selectionColor={C.accentDark}
              style={[s.input, focused === 'password' && s.focused]} />
          </View>
          {!!error && <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.error}>
            <Text style={s.errorText}>{error}</Text>
          </View>}
          <Pressable accessibilityRole="button" accessibilityState={{ disabled, busy }} disabled={disabled} onPress={submit}
            style={({ pressed }) => [s.submit, disabled && s.disabled, pressed && s.pressed]}>
            {busy && <ActivityIndicator color={C.text} />}
            <Text style={[s.submitText, disabled && s.disabledText]}>{busy ? 'Входим…' : 'Войти в вики'}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
const s = StyleSheet.create({
  root: { flex: 1 }, page: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 32 },
  content: { width: '100%', maxWidth: 400, alignSelf: 'center', gap: 36 }, intro: { gap: 12 },
  title: { fontSize: 32, lineHeight: 39, fontWeight: '500', letterSpacing: -0.6, color: C.text },
  description: { fontSize: 17, lineHeight: 25, color: '#686052' },
  form: { gap: 20 }, formIntro: { gap: 8 }, heading: { fontSize: 20, lineHeight: 27, fontWeight: '600', color: C.text },
  hint: { fontSize: 15, lineHeight: 22, color: '#686052' }, field: { gap: 8 },
  label: { fontSize: 15, lineHeight: 22, fontWeight: '500', color: C.text },
  input: { minHeight: 54, borderWidth: 2, borderColor: '#8D8270', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: C.neutral100, color: C.text, fontSize: 17 },
  focused: { borderColor: C.accentDark }, passwordLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginVertical: -8 },
  reveal: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' }, revealText: { fontSize: 15, lineHeight: 22, color: C.accentDark, fontWeight: '500' },
  submit: { minHeight: 54, borderRadius: 14, backgroundColor: C.accentDark, padding: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  submitText: { fontSize: 17, lineHeight: 24, fontWeight: '600', color: C.white }, disabled: { backgroundColor: C.neutral300 }, disabledText: { color: '#686052' },
  pressed: { opacity: 0.75 }, error: { padding: 14, borderRadius: 12, backgroundColor: '#F2DDD0' }, errorText: { fontSize: 15, lineHeight: 22, color: '#803716' },
});
