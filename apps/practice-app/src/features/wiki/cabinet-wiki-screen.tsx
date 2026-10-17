import * as Device from 'expo-device';
import { useRouter } from 'expo-router';
import { useEffect, useState, useRef, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, AppState, BackHandler, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { cabinetAccountEnabled, cabinetSession } from '../cabinet-account/session';
import { Organic as C } from '../prototype/theme';
import { materialId, replyScript } from './bridge';
import { cabinetWikiRequest } from './cabinet-api';
import { createProtectedWikiReader, protectedWikiPath } from './protected-reader';
import { wikiHtml } from './native-html';
import LegacyZoomSheet from './legacy-zoom-sheet';

type Props = { active?: boolean; onDetailChange?: (open: boolean) => void; onOpenAccess: (invitation?: boolean) => void };
type Reader = ReturnType<typeof createProtectedWikiReader>;
const BOOKMARKS = 'quietpractice.wiki.bookmarks.v1', OPENED = 'quietpractice.wiki.recent.v1';
export default function CabinetWikiScreen(props: Props) {
  return cabinetAccountEnabled ? <AccountWiki {...props} /> : <View style={s.gate}><Text style={s.title}>Вики</Text><Text style={s.body}>Вход через кабинет пока не настроен для этой сборки.</Text></View>;
}
function AccountWiki({ active = true, onDetailChange, ...props }: Props) {
  const router = useRouter();
  const [reader] = useState(() => createProtectedWikiReader({ session: cabinetSession(), read: cabinetWikiRequest, foreground: AppState.currentState === 'active' }));
  const state = useSyncExternalStore(reader.subscribe, reader.getState, reader.getState);
  const [stamp, setStamp] = useState(Date.now);
  useEffect(() => { reader.setVisible(active); }, [reader, active]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', value => reader.setForeground(value === 'active'));
    return () => { sub.remove(); reader.dispose(); };
  }, [reader]);
  useEffect(() => { if (state.phase !== 'ready') onDetailChange?.(false); }, [state.phase, onDetailChange]);
  useEffect(() => {
    if (state.retryAt <= Date.now()) return;
    const timer = setTimeout(() => setStamp(Date.now()), state.retryAt - Date.now());
    return () => clearTimeout(timer);
  }, [state.retryAt]);
  if (!active || state.phase === 'paused') return <View style={s.container} />;
  if (state.phase === 'ready') return <ProtectedWiki key={state.epoch} reader={reader} onDetailChange={onDetailChange} {...props} />;
  const busy = state.phase === 'checking', delayed = state.retryAt > stamp;
  return <View style={s.gate}>
    <Text accessibilityRole="header" style={s.title}>Вики</Text>
    {busy ? <View style={s.progress}><ActivityIndicator color={C.accentDark} /><Text style={s.body}>Проверяем вход…</Text></View>
      : <Text accessibilityRole={state.phase === 'locked' ? undefined : 'alert'} style={s.body}>{state.phase === 'locked' ? 'Войдите через кабинет школы, чтобы читать материалы и открывать записи.'
        : state.phase === 'blocked' ? 'Доступ к аккаунту ограничен школой. После восстановления доступа проверьте вход снова.'
          : delayed ? 'Слишком много запросов. Повторите через несколько секунд.' : 'Не удалось загрузить материалы. Проверьте интернет и повторите попытку.'}</Text>}
    {!busy && state.phase !== 'locked' && <Pressable accessibilityRole="button" accessibilityState={{ disabled: delayed }} disabled={delayed} style={[s.button, delayed && s.disabled]} onPress={() => void cabinetSession().restore()}><Text style={s.link}>Повторить</Text></Pressable>}
    <Pressable accessibilityRole="button" style={s.button} onPress={() => router.push('/cabinet-account')}><Text style={s.link}>{state.phase === 'locked' ? 'Войти через кабинет' : 'Аккаунт школы'}</Text></Pressable>
  </View>;
}
function ProtectedWiki({ reader, onDetailChange, onOpenAccess }: Omit<Props, 'active'> & { reader: Reader }) {
  const web = useRef<WebView>(null), alive = useRef(true), count = useRef(0), back = useRef(false);
  const epoch = reader.getState().epoch;
  const [online, setOnline] = useState<string | null>(null), [sourceError, setSourceError] = useState(false), [webError, setWebError] = useState(false);
  const queue = useRef(Promise.resolve<string[]>([]));
  const [source] = useState(() => {
    const resume = JSON.stringify(reader.getState().location).replace(/[<>&\u2028\u2029]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
    let html = wikiHtml.replace('<body', '<body data-native-cabinet="1"');
    if (Platform.OS === 'ios' && Platform.isPad) html = html.replace('<body', '<body data-native-tablet');
    html = html.replace('<script nonce="daychee-local-ui">', '<script nonce="daychee-local-ui">window.__daycheeResume=' + resume + ';');
    return { html, baseUrl: 'https://daychee.local/wiki' };
  });
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; onDetailChange?.(false); };
  }, [onDetailChange]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (online) { setOnline(null); return true; }
      if (!back.current) return false;
      web.current?.injectJavaScript('window.__daycheeNative.back();true;'); return true;
    });
    return () => sub.remove();
  }, [online]);
  async function ids(key: string) {
    const raw = await AsyncStorage.getItem(key), value: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value.filter(materialId) : [];
  }
  async function message(event: WebViewMessageEvent) {
    if (!reader.current(epoch) || event.nativeEvent.data.length > 32768) return;
    let data: { type?: string; id?: string; value?: unknown };
    try { data = JSON.parse(event.nativeEvent.data); } catch { return; }
    if (!data || typeof data !== 'object') return;
    if (data.type === 'checkpoint') { reader.checkpoint(data.value); return; }
    if (data.type === 'route' && data.value && typeof data.value === 'object') {
      const route = data.value as { view?: string; canBack?: boolean };
      back.current = route.canBack === true || route.view === 'article' || route.view === 'concept';
      onDetailChange?.(route.view === 'article' || route.view === 'concept' || route.view === 'graph'); return;
    }
    if (data.type === 'online' && materialId(data.value)) { setOnline(data.value); return; }
    if (data.type === 'source') {
      void reader.source(data.value).then(url => { if (alive.current && reader.current(epoch)) return Linking.openURL(url); })
        .catch(() => { if (alive.current && reader.current(epoch)) setSourceError(true); }); return;
    }
    if (typeof data.id !== 'string' || !/^\d{1,10}$/.test(data.id) || count.current >= 8) return;
    count.current++;
    try {
      let value: unknown;
      if (data.type === 'protected') {
        const path = protectedWikiPath(data.value); if (!path) throw Error('Недопустимый запрос.');
        value = await reader.request(path);
      } else if (data.type === 'bookmarks' || data.type === 'recent') value = await ids(data.type === 'bookmarks' ? BOOKMARKS : OPENED);
      else if ((data.type === 'bookmark' || data.type === 'opened') && materialId(data.value)) {
        const id = data.value, opened = data.type === 'opened', key = opened ? OPENED : BOOKMARKS;
        const operation = queue.current.catch(() => []).then(async () => {
          if (!alive.current || !reader.current(epoch)) return [];
          const previous = await ids(key);
          const next = opened ? [id, ...previous.filter(item => item !== id)].slice(0, 20) : previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id];
          if (alive.current && reader.current(epoch)) await AsyncStorage.setItem(key, JSON.stringify(next));
          return next;
        });
        queue.current = operation; value = await operation;
      } else throw Error('Недопустимый запрос.');
      if (alive.current && reader.current(epoch)) web.current?.injectJavaScript(replyScript(data.id, value));
    } catch (error) {
      if (alive.current && reader.current(epoch)) web.current?.injectJavaScript(replyScript(data.id, undefined, error instanceof Error && error.message === '404' ? '404' : 'Не удалось загрузить материал. Повторите попытку.'));
    } finally { count.current--; }
  }
  return <View style={s.container}>
    <WebView ref={web} source={source} style={s.web} originWhitelist={['https://daychee.local']}
      webviewDebuggingEnabled={!Device.isDevice} javaScriptEnabled domStorageEnabled={false} sharedCookiesEnabled={false} thirdPartyCookiesEnabled={false}
      cacheEnabled={false} incognito allowFileAccess={false} allowUniversalAccessFromFileURLs={false} mixedContentMode="never"
      javaScriptCanOpenWindowsAutomatically={false} setSupportMultipleWindows={false} allowsBackForwardNavigationGestures={false} textZoom={100}
      onMessage={event => { void message(event); }} onError={() => setWebError(true)} onContentProcessDidTerminate={() => setWebError(true)}
      onShouldStartLoadWithRequest={request => request.url === 'about:blank' || request.url === 'https://daychee.local/wiki' || request.url.startsWith('https://daychee.local/wiki#')}
    />
    {(webError || sourceError) && <View style={s.notice}><Text style={s.body}>{webError ? 'Не удалось открыть вики.' : 'Не удалось открыть ссылку. Нажмите её ещё раз, чтобы проверить доступ.'}</Text><Pressable style={s.button} onPress={() => { setSourceError(false); setWebError(false); if (webError) void cabinetSession().restore(); }}><Text style={s.link}>Повторить</Text></Pressable></View>}
    {!!online && <LegacyZoomSheet id={online} close={() => setOnline(null)} onOpenAccess={onOpenAccess} />}
  </View>;
}
const s = StyleSheet.create({ container: { flex: 1, backgroundColor: C.background }, web: { flex: 1, backgroundColor: '#fff' }, gate: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center', padding: 20, gap: 18, backgroundColor: C.background }, title: { fontSize: 30, lineHeight: 35, fontWeight: '700', color: C.text }, body: { fontSize: 17, lineHeight: 25, color: C.text }, button: { minHeight: 48, padding: 12, borderRadius: 999, borderWidth: 1, borderColor: C.divider, justifyContent: 'center' }, link: { fontSize: 16, fontWeight: '600', textAlign: 'center', color: C.accentDark }, progress: { flexDirection: 'row', gap: 12, alignItems: 'center' }, disabled: { opacity: 0.5 }, notice: { padding: 16, gap: 8, backgroundColor: C.background } });
