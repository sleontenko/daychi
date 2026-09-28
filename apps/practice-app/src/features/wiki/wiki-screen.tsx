import { useAccess } from '../access/session';
import { AccessGate } from '../access/access-screen';
import BackButton from '../../components/back-button';
import { SymbolView } from 'expo-symbols';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, FlatList, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Organic as C } from '../prototype/theme';
import { Category, Material, Results, Summary, wikiRequest } from './api';

const BOOKMARKS = 'quietpractice.wiki.bookmarks.v1';
function Button({ title, onPress, selected, disabled }: { title: string; onPress: () => void; selected?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [s.button, selected && s.selected, (pressed || disabled) && { opacity: 0.55 }]}>
    <Text style={[s.link, selected && { color: '#fff' }]}>{title}</Text></Pressable>;
}
export default function WikiScreen({ active = true, onDetailChange, onOpenAccess }: { active?: boolean; onDetailChange?: (open: boolean) => void; onOpenAccess: () => void }) {
  const access = useAccess();
  const [section, setSection] = useState<'materials' | 'dictionary'>('materials');
  const [termQuery, setTermQuery] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState('');
  const [subtopic, setSubtopic] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'new' | 'old'>('new');
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [menuCategory, setMenuCategory] = useState('');
  const [savedOnly, setSavedOnly] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [results, setResults] = useState<Results>({ total: 0, items: [], missing_ids: [] });
  const [detail, setDetail] = useState<Material | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const list = useRef<FlatList<Summary>>(null);
  const listOffset = useRef(0);
  const retainedLimit = useRef(40);
  const lastQuery = useRef<unknown>(null);
  const detailScroll = useRef<ScrollView>(null);
  const detailOffsets = useRef<Record<string, number>>({});
  useEffect(() => { onDetailChange?.(!!detailId); return () => onDetailChange?.(false); }, [detailId, onDetailChange]);
  useEffect(() => {
    if (!active || !detailId) return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => { setDetailId(null); setDetail(null); setError(''); return true; });
    return () => handler.remove();
  }, [active, detailId]);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const detailGeneration = useRef(0);
  const bookmarkBusy = useRef(false);
  const paging = useRef(false);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(BOOKMARKS).then(bookmarks => {
      if (!active) return;
      const parsed: unknown = bookmarks ? JSON.parse(bookmarks) : [];
      setSaved(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []);
    }).catch(() => { if (active) setError('Не удалось восстановить сохранённые данные.'); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => { const timer = setTimeout(() => setSearch(query), 250); return () => clearTimeout(timer); }, [query]);
  const fail = useCallback((e: unknown) => {
    setError(e instanceof Error ? e.message : 'Не удалось загрузить материалы.');
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') setRevision(x => x + 1); });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (access !== 'active') return;
    let active = true;
    wikiRequest<Category[]>('/categories').then(rows => { if (active) setCategories(rows); }).catch(e => { if (active) fail(e); });
    return () => { active = false; };
  }, [revision, fail, access]);
  const savedFilter = savedOnly ? (saved.length ? saved.join(',') : 'none') : '';
  const makePath = useCallback((offset: number) => {
    const params = new URLSearchParams({ q: search, category, subtopic, sort, offset: String(offset), limit: '40' });
    if (savedFilter) params.set('ids', savedFilter);
    return `/materials?${params}`;
  }, [search, category, subtopic, sort, savedFilter]);
  useEffect(() => {
    const id = ++generation.current;
    if (lastQuery.current !== makePath) {
      lastQuery.current = makePath; listOffset.current = 0; retainedLimit.current = 40;
    }
    if (access !== 'active') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults({ total: 0, items: [], missing_ids: [] }); setCategories([]); return;
    }
    // Clear results before applying a different catalog query.

    setBusy(true); setError(''); setResults({ total: 0, items: [], missing_ids: [] });
    async function restorePage() {
      let rows = await wikiRequest<Results>(makePath(0));
      while (generation.current === id && rows.items.length < retainedLimit.current && rows.items.length < rows.total) {
        const next = await wikiRequest<Results>(makePath(rows.items.length));
        const added = next.items.filter(row => !rows.items.some(old => old.id === row.id));
        if (!added.length) break;
        rows = { ...next, items: [...rows.items, ...added] };
      }
      return rows;
    }
    restorePage().then(rows => { if (generation.current === id) setResults(rows); })
      .catch(e => { if (generation.current === id) fail(e); })
      .finally(() => { if (generation.current === id) setBusy(false); });
    const requests = generation;
    return () => { requests.current++; };
  }, [makePath, revision, fail, access]);
  useEffect(() => {
    if (access !== 'active') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDetail(null); return;
    }
    if (!detailId) return;
    const id = ++detailGeneration.current;
    // Clear the previous material while the new request is pending.

    setDetail(null); setError('');
    wikiRequest<Material>(`/materials/${encodeURIComponent(detailId)}`).then(row => { if (id === detailGeneration.current) setDetail(row); })
      .catch(e => { if (id === detailGeneration.current) fail(e); });
    const requests = detailGeneration;
    return () => { requests.current++; };
  }, [detailId, revision, fail, access]);
  async function bookmark(id: string) {
    if (bookmarkBusy.current) return;
    bookmarkBusy.current = true;
    const next = saved.includes(id) ? saved.filter(x => x !== id) : [...saved, id];
    try { await AsyncStorage.setItem(BOOKMARKS, JSON.stringify(next)); setSaved(next); }
    catch { setError('Не удалось сохранить закладку. Повторите.'); }
    finally { bookmarkBusy.current = false; }
  }
  async function more() {
    if (busy || paging.current) return;
    const id = generation.current;
    paging.current = true; setBusy(true); setError('');
    try { const next = await wikiRequest<Results>(makePath(results.items.length));
      if (id === generation.current) {
        retainedLimit.current = results.items.length + next.items.length;
        setResults(old => ({ total: next.total, missing_ids: next.missing_ids, items: [...old.items, ...next.items.filter(r => !old.items.some(x => x.id === r.id))] }));
      }
    } catch (e) { if (id === generation.current) fail(e); }
    finally { paging.current = false; if (id === generation.current) setBusy(false); }
  }
  const notice = error ? <View accessibilityRole="alert" style={s.notice}><Text style={s.body}>{error}</Text>
    <Button title="Повторить" onPress={() => setRevision(x => x + 1)} /></View> : null;
  if (access !== 'active') return <View style={{ flex: 1 }}>{detailId && <BackButton label="Вики" onPress={() => setDetailId(null)} />}<AccessGate onOpen={onOpenAccess} /></View>;
  if (!ready) return <ActivityIndicator style={s.page} color={C.accentDark} />;
  const detailView = detailId ? <View style={{ flex: 1 }}>
    <BackButton label="Вики" onPress={() => { setDetailId(null); setDetail(null); setError(''); }} />
    <ScrollView ref={detailScroll} contentContainerStyle={[s.page, { gap: 16 }]}
      scrollEventThrottle={16} onScroll={event => { if (detail) detailOffsets.current[detailId] = event.nativeEvent.contentOffset.y; }}
      onContentSizeChange={() => { if (detail) detailScroll.current?.scrollTo({ y: detailOffsets.current[detailId] ?? 0, animated: false }); }}>
    {detail ? <><Text style={s.eyebrow}>{detail.category_name.toUpperCase()}</Text>
      <Text accessibilityRole="header" style={s.title}>{detail.title}</Text><Text style={s.meta}>{detail.date}{detail.subtopic ? ` · ${detail.subtopic}` : ''}</Text>
      <Button title={saved.includes(detail.id) ? '✓ Сохранено · Убрать' : 'Сохранить для повторения'} selected={saved.includes(detail.id)} onPress={() => void bookmark(detail.id)} />
      <View style={s.panel}><Text style={s.heading}>О материале</Text><Text selectable style={s.body}>{detail.description && detail.description.replace(/\s+/g, ' ').trim().toLowerCase() !== detail.title.replace(/\s+/g, ' ').trim().toLowerCase() ? detail.description : 'Описание готовится. Пока можно открыть оригинал материала.'}</Text></View>
      <View style={s.panel}><Text style={s.heading}>Открыть оригинал</Text>
        {detail.links.map((link, index) => <Button key={`${link.url}:${index}`} title={`${link.label} ↗`} onPress={() => {
          void Linking.openURL(link.url).catch(() => setError('Не удалось открыть ссылку. Проверьте доступ к источнику.'));
        }} />)}
        {!!detail.zoom_password && <><Text style={s.meta}>Код доступа к Zoom · удерживай, чтобы скопировать</Text><Text selectable style={s.body}>{detail.zoom_password}</Text></>}
      </View></> : !error && <ActivityIndicator color={C.accentDark} />}
    {notice}{!detail && !!error && saved.includes(detailId) && <Button title="Убрать сохранение" onPress={() => void bookmark(detailId)} />}
  </ScrollView></View> : null;
  const chosen = categories.find(x => x.id === category);
  const menuChosen = categories.find(x => x.id === menuCategory);
  const header = <View style={s.header}>
    <View><Text accessibilityRole="header" style={s.title}>Живая база знаний</Text><Text style={s.meta}>Материалы для практики</Text></View>
    <View style={s.wrap}><Button title="Материалы" selected onPress={() => setSection('materials')} /><Button title="Словарь" onPress={() => setSection('dictionary')} /></View>
    <View style={s.searchRow}>
      <View style={s.searchWrap}>
        <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={16} tintColor={C.neutral500} />
        <TextInput accessibilityLabel="Поиск по вики" placeholder="тема, практика, занятие…" placeholderTextColor="#756D60" value={query} onChangeText={setQuery} style={s.input} clearButtonMode="while-editing" />
      </View>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: !category && !savedOnly }} onPress={() => { setCategory(''); setSubtopic(''); setSavedOnly(false); }} style={[s.chip, !category && !savedOnly && s.selected]}><Text style={[s.chipText, !category && !savedOnly && s.inverse]}>Всё</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: savedOnly }} onPress={() => setSavedOnly(x => !x)} style={[s.chip, savedOnly && s.selected]}><Text style={[s.chipText, savedOnly && s.inverse]}>Сохранённые</Text></Pressable>
      {categories.map(c => <Pressable key={c.id} accessibilityRole="button" accessibilityState={{ selected: category === c.id }} onPress={() => { setCategory(category === c.id ? '' : c.id); setSubtopic(''); }} style={[s.chip, category === c.id && s.selected]}><Text style={[s.chipText, category === c.id && s.inverse]}>{c.name}</Text></Pressable>)}
    </ScrollView>
    <View style={s.wrap}>
      <Button title="Все разделы и подтемы" onPress={() => { setMenuCategory(category); setCategoriesOpen(true); }} />
      <Button title={sort === 'new' ? 'Сначала новые' : 'Сначала старые'} onPress={() => setSort(sort === 'new' ? 'old' : 'new')} />
    </View>
    <Text style={s.meta}>Найдено: {results.total}</Text>
    {!!subtopic && <Button title={`Подтема: ${chosen?.subtopics.find(x => x.id === subtopic)?.name ?? subtopic} · Сбросить`} onPress={() => setSubtopic('')} />}
    {notice}
    {savedOnly && results.missing_ids?.map(id => <View key={id} style={s.panel}><Text style={s.meta}>Сохранённый материал больше не доступен.</Text><Button title="Убрать сохранение" onPress={() => void bookmark(id)} /></View>)}
  </View>;
  if (section === 'dictionary' && !detailId) return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.page, { gap: 16 }]}>
    <Text accessibilityRole="header" style={s.title}>Живая база знаний</Text>
    <View style={s.wrap}><Button title="Материалы" onPress={() => setSection('materials')} /><Button title="Словарь" selected onPress={() => {}} /></View>
    <TextInput accessibilityLabel="Поиск по словарю" placeholder="Найти термин…" placeholderTextColor="#756D60" value={termQuery} onChangeText={setTermQuery} style={[s.input, s.searchWrap]} />
    <Text style={s.meta}>Термины в понимании школы. Определения появляются после сверки с источниками.</Text>
    <View style={s.panel}><Text style={s.heading}>{termQuery.trim() ? 'Определение пока не опубликовано' : 'Словарь готовится'}</Text>
      <Text style={s.body}>Проверенные определения ещё не добавлены. Можно поискать термин в названиях материалов.</Text>
      <Button title="Искать в материалах" onPress={() => { setQuery(termQuery); setCategory(''); setSubtopic(''); setSavedOnly(false); setSection('materials'); }} />
    </View>
  </ScrollView>;
  return <View style={{ flex: 1 }}>
    <Modal visible={categoriesOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCategoriesOpen(false)}>
      <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: C.background }}>
        <View style={[s.page, { paddingBottom: 12 }]}><Text accessibilityRole="header" style={s.title}>Все разделы</Text>
          <Button title="Закрыть" onPress={() => setCategoriesOpen(false)} /></View>
        <ScrollView contentContainerStyle={[s.page, { gap: 16 }]}>
          <Button title="Все материалы" selected={!category && !savedOnly} onPress={() => { setCategory(''); setSubtopic(''); setSavedOnly(false); setCategoriesOpen(false); }} />
          <Button title="Сохранённые" selected={savedOnly} onPress={() => { setCategory(''); setSubtopic(''); setSavedOnly(true); setCategoriesOpen(false); }} />
          <View style={s.wrap}>{categories.map(c => <Button key={c.id} title={`${c.name} · ${c.count}`}
            selected={menuCategory === c.id} onPress={() => setMenuCategory(c.id)} />)}</View>
          {menuChosen && <View style={s.panel}>
            <Text accessibilityRole="header" style={s.heading}>{menuChosen.name}</Text>
            <Button title="Все материалы раздела" onPress={() => { setCategory(menuChosen.id); setSubtopic(''); setCategoriesOpen(false); }} />
            <View style={s.wrap}>{menuChosen.subtopics.map(topic => <Button key={topic.id} title={`${topic.name} · ${topic.count}`}
              selected={category === menuChosen.id && subtopic === topic.id}
              onPress={() => { setCategory(menuChosen.id); setSubtopic(topic.id); setCategoriesOpen(false); }} />)}</View>
          </View>}
          {!categories.length && <Text style={s.body}>Разделы пока не загружены. Закрой меню и нажми «Повторить».</Text>}
        </ScrollView>
      </SafeAreaView></SafeAreaProvider>
    </Modal>{detailView}<FlatList ref={list} style={{ display: detailId ? 'none' : 'flex' }} data={results.items} keyExtractor={row => row.id} contentContainerStyle={s.page} keyboardShouldPersistTaps="handled" ListHeaderComponent={header}
    scrollEventThrottle={16} onScroll={event => { if (!detailId && !busy && results.items.length) listOffset.current = event.nativeEvent.contentOffset.y; }}
    onContentSizeChange={() => { if (!detailId && results.items.length) list.current?.scrollToOffset({ offset: listOffset.current, animated: false }); }}
    renderItem={({ item }: { item: Summary }) => <Pressable accessibilityRole="button" onPress={() => setDetailId(item.id)} style={({ pressed }) => [s.row, pressed && { opacity: 0.6 }]}>
      <View style={s.top}><View style={s.tag}><Text style={s.tagText}>{item.category_name}</Text></View><Text style={s.date}>{item.date}</Text></View>
      <Text style={s.heading}>{item.title}</Text>
      {!!item.subtopic && <Text style={s.summary}>{item.subtopic}</Text>}
      {saved.includes(item.id) && <Text style={s.summary}>Сохранено</Text>}
    </Pressable>}
    ListEmptyComponent={!busy && !error ? <Text style={s.body}>{savedOnly ? 'Здесь пока нет доступных материалов. Сохрани запись или измени фильтры.' : 'Ничего не найдено. Попробуй другую тему.'}</Text> : null}
    ListFooterComponent={<View style={s.header}>{busy && <ActivityIndicator color={C.accentDark} />}{results.items.length < results.total && <Button title="Показать ещё" disabled={busy} onPress={() => void more()} />}</View>} /></View>;
}
const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 40 }, header: { gap: 16, marginBottom: 16 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  eyebrow: { fontSize: 11, letterSpacing: 1.7, color: '#756D60', marginBottom: 8 },
  title: { fontSize: 32, lineHeight: 36, fontWeight: '700', color: C.text, letterSpacing: -0.5 },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600', color: C.text },
  body: { fontSize: 17, lineHeight: 25, color: C.text }, meta: { fontSize: 14, lineHeight: 21, color: '#68635B' },
  panel: { backgroundColor: C.neutral100, padding: 18, borderRadius: 14, gap: 14 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  searchWrap: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: C.divider, backgroundColor: C.surface },
  input: { flex: 1, minWidth: 0, color: C.text, paddingVertical: 8, fontSize: 17 },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, minHeight: 44, justifyContent: 'center', borderRadius: 999, backgroundColor: C.neutral100 },
  chipText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: C.text }, inverse: { color: C.white },
  tag: { flexShrink: 1, backgroundColor: C.sageSoft, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { color: C.sageDark, fontSize: 11, lineHeight: 15 }, date: { fontSize: 11, lineHeight: 16, color: '#756D60' },
  summary: { fontSize: 13, lineHeight: 19, color: '#68635B' },
  button: { paddingHorizontal: 12, paddingVertical: 12, minHeight: 44, maxWidth: '100%', justifyContent: 'center', borderRadius: 12, backgroundColor: '#EEE4D4' },
  selected: { backgroundColor: C.sageDeep }, link: { color: C.accentDark, fontSize: 15, fontWeight: '500' },
  row: { padding: 16, gap: 6, borderRadius: 20, backgroundColor: C.neutral100, marginBottom: 10 },
  chips: { gap: 8 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, notice: { padding: 14, gap: 8, borderRadius: 12, backgroundColor: '#F0DFC9' },
});
