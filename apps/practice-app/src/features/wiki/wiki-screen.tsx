import * as Device from 'expo-device';
import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, AppState, BackHandler, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import BackButton from '../../components/back-button';
import { privateRequest, useAccess } from '../access/session';
import OnlineAccessPrompt from '../access/online-access-prompt';
import { Organic as C } from '../prototype/theme';
import { type Material, wikiRequest } from './api';
import { externalSource, materialId, protectedSource, publicSource, publicWikiPath, replyScript } from './bridge';
import { wikiHtml } from './native-html';
import LegacyWikiScreen from './legacy-wiki-screen';

const BOOKMARKS = 'quietpractice.wiki.bookmarks.v1';
const OPENED = 'quietpractice.wiki.recent.v1';
const source = { html: Platform.OS === 'ios' && Platform.isPad ? wikiHtml.replace('<body', '<body data-native-tablet') : wikiHtml, baseUrl: 'https://daychee.local/wiki' };
type Props = { active?: boolean; onDetailChange?: (open: boolean) => void; onOpenAccess: (invitation?: boolean) => void };
export default function WikiScreen(props: Props) {
  return Platform.OS === 'web' ? <LegacyWikiScreen {...props} /> : <NativeWiki {...props} />;
}
function NativeWiki({ active = true, onDetailChange, onOpenAccess }: Props) {
  const web = useRef<WebView>(null);
  const access = useAccess();
  const accessRef = useRef(access);
  useEffect(() => { accessRef.current = access; }, [access]);
  const generation = useRef(0), requests = useRef(0);
  const openedQueue = useRef(Promise.resolve<string[]>([]));
  const alive = useRef(true), bookmarkQueue = useRef(Promise.resolve<string[]>([]));
  const canBack = useRef(false);
  const [webError, setWebError] = useState(false);
  const [onlineId, setOnlineId] = useState<string | null>(null);
  const onlineRef = useRef<string | null>(null);
  const [privateData, setPrivateData] = useState<Material | null>(null);
  const [privateError, setPrivateError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => { const counter = generation; alive.current = true; return () => { alive.current = false; counter.current++; onDetailChange?.(false); }; }, [onDetailChange]);
  useEffect(() => {
    if (!active) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (onlineId) { onlineRef.current = null; setOnlineId(null); return true; }
      if (!canBack.current) return false;
      web.current?.injectJavaScript('window.__daycheeNative.back();true;'); return true;
    });
    return () => subscription.remove();
  }, [active, onlineId]);
  useEffect(() => {
    let valid = true;
    // Clear private data on access changes; never send it to the public web UI.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrivateData(null); setPrivateError('');
    if (onlineId && access === 'active') privateRequest<Material>('/api/wiki/materials/' + onlineId)
      .then(data => { if (valid && data.id === onlineId) setPrivateData(data); })
      .catch(() => { if (valid) setPrivateError('Не удалось загрузить ссылки. Проверьте интернет и доступ.'); });
    return () => { valid = false; };
  }, [onlineId, access, retry]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      // Private links must be rechecked after returning to the app.
      if (state === 'active') setRetry(value => value + 1);
    });
    return () => subscription.remove();
  }, []);
  async function bookmarks(key = BOOKMARKS) {
    const raw = await AsyncStorage.getItem(key);
    const value: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value.filter(materialId) : [];
  }
  async function message(event: WebViewMessageEvent) {
    if (event.nativeEvent.data.length > 8192) return;
    let data: { type?: string; id?: string; value?: unknown };
    try { data = JSON.parse(event.nativeEvent.data); } catch { return; }
    if (!data || typeof data !== 'object') return;
    if (data.type === 'route' && data.value && typeof data.value === 'object') {
      const route = data.value as { view?: string; canBack?: boolean };
      canBack.current = route.canBack === true || route.view === 'article';
      onDetailChange?.(route.view === 'article' || route.view === 'graph'); return;
    }
    if (data.type === 'source' && publicSource(data.value)) {
      void Linking.openURL(data.value).catch(() => setWebError(true)); return;
    }
    if (data.type === 'online' && materialId(data.value)) { onlineRef.current = data.value; setOnlineId(data.value); return; }
    if (typeof data.id !== 'string' || !/^\d{1,10}$/.test(data.id) || requests.current >= 8) return;
    const current = generation.current; requests.current++;
    try {
      let result: unknown;
      if (data.type === 'public') {
        const path = publicWikiPath(data.value);
        if (!path) throw Error('Недопустимый запрос.');
        result = await wikiRequest(path);
      } else if (data.type === 'bookmarks') result = await bookmarks();
      else if (data.type === 'recent') result = await bookmarks(OPENED);
      else if (data.type === 'opened' && materialId(data.value)) {
        const id = data.value;
        const operation = openedQueue.current.catch(() => []).then(async () => {
          const recent = await bookmarks(OPENED);
          const next = [id, ...recent.filter(value => value !== id)].slice(0, 20);
          await AsyncStorage.setItem(OPENED, JSON.stringify(next)); return next;
        });
        openedQueue.current = operation; result = await operation;
      }
      else if (data.type === 'bookmark' && materialId(data.value)) {
        const id = data.value;
        const operation = bookmarkQueue.current.catch(() => []).then(async () => {
          const saved = await bookmarks();
          const next = saved.includes(id) ? saved.filter(value => value !== id) : [...saved, id];
          await AsyncStorage.setItem(BOOKMARKS, JSON.stringify(next)); return next;
        });
        bookmarkQueue.current = operation; result = await operation;
      } else throw Error('Недопустимый запрос.');
      if (alive.current && current === generation.current) web.current?.injectJavaScript(replyScript(data.id, result));
    } catch (error) {
      if (alive.current && current === generation.current) web.current?.injectJavaScript(replyScript(data.id, undefined, error instanceof Error ? error.message : 'Повторите попытку.'));
    } finally { requests.current--; }
  }
  const closeOnline = () => { onlineRef.current = null; setOnlineId(null); };
  return <View style={s.container}>
    <WebView ref={web} source={source} style={s.web} originWhitelist={['https://daychee.local']}
      webviewDebuggingEnabled={!Device.isDevice} javaScriptEnabled domStorageEnabled={false} sharedCookiesEnabled={false} thirdPartyCookiesEnabled={false}
      cacheEnabled={false} incognito allowFileAccess={false} allowUniversalAccessFromFileURLs={false}
      mixedContentMode="never" javaScriptCanOpenWindowsAutomatically={false} setSupportMultipleWindows={false}
      allowsBackForwardNavigationGestures={false} textZoom={100}
      onMessage={event => { void message(event); }}
      onError={() => setWebError(true)} onContentProcessDidTerminate={() => setWebError(true)}
      onShouldStartLoadWithRequest={request => request.url === 'about:blank' || request.url === 'https://daychee.local/wiki' || request.url.startsWith('https://daychee.local/wiki#')}
    />
    {webError && <View style={s.error}><Text style={s.body}>Не удалось открыть вики или ссылку.</Text><Pressable style={s.button} onPress={() => { generation.current++; setWebError(false); web.current?.reload(); }}><Text style={s.link}>Повторить</Text></Pressable></View>}
    <Modal visible={!!onlineId} animationType="slide" presentationStyle={Platform.OS === 'ios' && Platform.isPad ? 'pageSheet' : 'fullScreen'} onRequestClose={closeOnline}>
      <SafeAreaProvider><SafeAreaView style={s.modal}>
        <BackButton label="Материал" onPress={closeOnline} />
        <ScrollView contentContainerStyle={s.page}>
          <Text accessibilityRole="header" style={s.title}>Записи и онлайн-занятие</Text>
          {access !== 'active' ? <OnlineAccessPrompt heading="Записи и ссылки доступны после проверки доступа" onPress={() => { closeOnline(); onOpenAccess(); }} /> : privateData ? <View style={s.panel}>
            {privateData.links.filter(link => (link.type === 'zoom' || protectedSource(link.url)) && externalSource(link.url)).map(link => <Pressable key={link.url} style={s.button} accessibilityRole="button" onPress={() => {
              // Recheck authorization on every open; don't act on a retained URL.
              if (!onlineId || onlineRef.current !== onlineId || accessRef.current !== 'active') return;
              void privateRequest<Material>('/api/wiki/materials/' + onlineId).then(fresh => {
                const latest = fresh.id === onlineId ? fresh.links.find(item => item.type === link.type && item.url === link.url) : null;
                if (onlineRef.current !== onlineId) return;
                if (accessRef.current === 'active' && latest && externalSource(latest.url)) return Linking.openURL(latest.url);
                throw Error('Доступ закончился.');
              }).catch(() => { if (onlineRef.current === onlineId) { setPrivateData(null); setPrivateError('Не удалось открыть ссылку. Проверьте доступ.'); } });
            }}><Text style={s.link}>{link.label} ↗</Text></Pressable>)}
            {!privateData.links.some(link => link.type === 'zoom' || protectedSource(link.url)) && <Text style={s.body}>Закрытые ссылки для этого материала пока не опубликованы.</Text>}
            {!!privateData.zoom_password && <><Text style={s.body}>Код доступа к Zoom</Text><Text selectable style={s.body}>{privateData.zoom_password}</Text></>}
          </View> : privateError ? <View><Text accessibilityRole="alert" style={s.body}>{privateError}</Text><Pressable style={s.button} onPress={() => setRetry(value => value + 1)}><Text style={s.link}>Повторить</Text></Pressable></View> : <ActivityIndicator color={C.accentDark} />}
        </ScrollView>
      </SafeAreaView></SafeAreaProvider>
    </Modal>
  </View>;
}
const s = StyleSheet.create({
  container: { flex: 1 }, web: { flex: 1, backgroundColor: '#fff' }, modal: { flex: 1, backgroundColor: C.background },
  page: { padding: 20, gap: 18, width: '100%', maxWidth: 720, alignSelf: 'center' }, panel: { padding: 20, gap: 14, backgroundColor: C.neutral100, borderRadius: 24 },
  title: { fontSize: 28, fontWeight: '700', color: C.text }, body: { fontSize: 17, lineHeight: 25, color: C.text },
  button: { padding: 14, minHeight: 48 }, link: { fontSize: 17, color: C.accentDark }, error: { padding: 16, backgroundColor: C.background },
});
