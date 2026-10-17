import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import BackButton from '../../components/back-button';
import { privateRequest, useAccess } from '../access/session';
import OnlineAccessPrompt from '../access/online-access-prompt';
import { Organic as C } from '../prototype/theme';
import type { Material } from './api';
import { externalSource } from './bridge';
import { meetingSource } from './protected-reader';

// Independent legacy capability. Cabinet content success never authorizes Zoom.
export default function LegacyZoomSheet({ id, close, onOpenAccess }: { id: string; close(): void; onOpenAccess(): void }) {
  const access = useAccess(), [data, setData] = useState<Material | null>(null), [error, setError] = useState(false);
  const [retry, setRetry] = useState(0), valid = useRef(false);
  useEffect(() => {
    let alive = true; valid.current = access === 'active';
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null); setError(false);
    if (access === 'active') void privateRequest<Material>('/api/wiki/materials/' + id)
      .then(value => { if (alive && value.id === id) setData(value); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; valid.current = false; };
  }, [access, id, retry]);
  const links = data?.links.filter(link => link.type === 'zoom' && externalSource(link.url) && meetingSource(link.url)) || [];
  return <Modal visible animationType="slide" presentationStyle={Platform.OS === 'ios' && Platform.isPad ? 'pageSheet' : 'fullScreen'} onRequestClose={close}>
    <SafeAreaProvider><SafeAreaView style={s.safe}><BackButton label="Материал" onPress={close} />
      <ScrollView contentContainerStyle={s.page}><Text accessibilityRole="header" style={s.title}>Онлайн-занятие</Text>
        {access !== 'active' ? <OnlineAccessPrompt heading="Подключение к занятию доступно после проверки доступа школы" onPress={() => { close(); onOpenAccess(); }} />
          : error ? <><Text accessibilityRole="alert" style={s.body}>Не удалось проверить подключение. Повторите попытку.</Text><Pressable style={s.button} onPress={() => setRetry(value => value + 1)}><Text style={s.link}>Повторить</Text></Pressable></>
            : !data ? <ActivityIndicator color={C.accentDark} /> : <>
              {links.map(link => <Pressable key={link.url} accessibilityRole="button" style={s.button} onPress={() => {
                if (!valid.current) return;
                void privateRequest<Material>('/api/wiki/materials/' + id).then(fresh => {
                  if (valid.current && fresh.id === id && fresh.links.some(item => item.type === 'zoom' && item.url === link.url)) return Linking.openURL(link.url);
                }).catch(() => { if (valid.current) { setData(null); setError(true); } });
              }}><Text style={s.link}>{link.label} ↗</Text></Pressable>)}
              {!links.length && <Text style={s.body}>Подключение к этому занятию пока не опубликовано.</Text>}
              {!!links.length && !!data.zoom_password && <><Text style={s.body}>Код доступа к Zoom</Text><Text selectable style={s.body}>{data.zoom_password}</Text></>}
            </>}
      </ScrollView></SafeAreaView></SafeAreaProvider>
  </Modal>;
}
const s = StyleSheet.create({ safe: { flex: 1, backgroundColor: C.background }, page: { padding: 20, gap: 18, maxWidth: 720, width: '100%', alignSelf: 'center' }, title: { fontSize: 28, fontWeight: '700', color: C.text }, body: { fontSize: 17, lineHeight: 25, color: C.text }, button: { minHeight: 48, padding: 14 }, link: { fontSize: 17, color: C.accentDark } });
