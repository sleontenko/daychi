import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getMaterials, getTopics, Material, Topic } from '@/lib/api';

const kindLabels: Record<string, string> = {
  youtube_url: 'YouTube',
  gdrive_url: 'Google Drive',
  telegram_media: 'Telegram',
};

export default function LibraryScreen() {
  const params = useLocalSearchParams<{ topic?: string }>();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 720;
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topic, setTopic] = useState(params.topic || '');
  const [query, setQuery] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTopics().then(setTopics).catch((reason) => setError(reason.message));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      getMaterials({ query, topic, limit: 40 })
        .then((page) => {
          setMaterials(page.items);
          setTotal(page.total);
        })
        .catch((reason) => setError(reason.message))
        .finally(() => setLoading(false));
    }, 220);
    return () => clearTimeout(timer);
  }, [query, topic]);

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <SafeAreaView style={styles.safeArea}>
          <View style={[styles.header, compact && styles.headerCompact]}>
            <View style={styles.headerCopy}>
              <ThemedText type="smallBold" style={{ color: theme.accent }}>
                БИБЛИОТЕКА
              </ThemedText>
              <ThemedText style={[styles.title, { fontFamily: Fonts.serif }]}>Найти материал</ThemedText>
              <ThemedText style={styles.subtitle} themeColor="textSecondary">
                Поиск по названиям, темам и метаданным уже собранного корпуса.
              </ThemedText>
            </View>
            <View
              style={[
                styles.countBlock,
                compact && styles.countBlockCompact,
                { borderColor: theme.line },
              ]}> 
              <ThemedText style={[styles.count, { fontFamily: Fonts.serif }]}>
                {total.toLocaleString('ru-RU')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">найдено</ThemedText>
            </View>
          </View>

          <TextInput
            accessibilityLabel="Поиск материалов"
            onChangeText={setQuery}
            placeholder="Поиск: медитация, веер, дыхание…"
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.search,
              { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.line },
            ]}
            value={query}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            <FilterChip active={!topic} label="Все темы" onPress={() => setTopic('')} />
            {topics.map((item) => (
              <FilterChip
                active={topic === item.slug}
                key={item.slug}
                label={item.title}
                onPress={() => setTopic(item.slug)}
              />
            ))}
          </ScrollView>

          {loading ? (
            <ActivityIndicator color={theme.accent} style={styles.loader} />
          ) : error ? (
            <View style={[styles.empty, { borderColor: theme.line }]}> 
              <ThemedText style={{ color: theme.accent }}>API недоступен</ThemedText>
              <ThemedText themeColor="textSecondary">{error}</ThemedText>
            </View>
          ) : materials.length === 0 ? (
            <View style={[styles.empty, { borderColor: theme.line }]}> 
              <ThemedText style={[styles.emptyTitle, { fontFamily: Fonts.serif }]}>Ничего не найдено</ThemedText>
              <ThemedText themeColor="textSecondary">Попробуйте более короткий запрос.</ThemedText>
            </View>
          ) : (
            <View style={styles.list}>
              {materials.map((material, index) => (
                <MaterialCard index={index} key={material.id} material={material} />
              ))}
            </View>
          )}
        </SafeAreaView>
      </ScrollView>
    </ThemedView>
  );
}

function FilterChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? theme.moss : theme.backgroundElement,
          borderColor: active ? theme.moss : theme.line,
          opacity: pressed ? 0.72 : 1,
        },
      ]}>
      <ThemedText type="smallBold" style={{ color: active ? '#FFFDF8' : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function MaterialCard({ index, material }: { index: number; material: Material }) {
  const theme = useTheme();
  const canOpen = Boolean(material.source_url?.startsWith('http'));
  return (
    <Pressable
      disabled={!canOpen}
      onPress={() => material.source_url && Linking.openURL(material.source_url)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.backgroundElement, borderColor: theme.line, opacity: pressed ? 0.72 : 1 },
      ]}>
      <View style={styles.cardNumber}>
        <ThemedText type="code" themeColor="textSecondary">
          {String(index + 1).padStart(2, '0')}
        </ThemedText>
      </View>
      <View style={styles.cardBody}>
        <ThemedText style={styles.cardTitle}>{material.title}</ThemedText>
        <View style={styles.metaRow}>
          <ThemedText type="small" style={{ color: theme.accent }}>
            {kindLabels[material.kind] || material.kind}
          </ThemedText>
          {material.date && (
            <ThemedText type="small" themeColor="textSecondary">
              {material.date.slice(0, 10)}
            </ThemedText>
          )}
          {material.duration_minutes ? (
            <ThemedText type="small" themeColor="textSecondary">
              {Math.round(material.duration_minutes)} мин
            </ThemedText>
          ) : null}
        </View>
      </View>
      <ThemedText style={{ color: canOpen ? theme.accent : theme.line }}>↗</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { alignItems: 'center' },
  safeArea: {
    width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: Spacing.four,
    paddingTop: Platform.select({ web: 104, default: Spacing.five }),
    paddingBottom: BottomTabInset + Spacing.six, gap: Spacing.four,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: Spacing.four },
  headerCompact: { flexDirection: 'column', alignItems: 'stretch' },
  headerCopy: { flex: 1, gap: 8 },
  title: { fontSize: 48, lineHeight: 56 },
  subtitle: { fontSize: 17, lineHeight: 26 },
  countBlock: { borderLeftWidth: 1, paddingLeft: Spacing.four, alignItems: 'flex-end' },
  countBlockCompact: {
    borderLeftWidth: 0, borderTopWidth: 1, paddingLeft: 0, paddingTop: Spacing.three,
    alignItems: 'flex-start',
  },
  count: { fontSize: 36, lineHeight: 40 },
  search: { minHeight: 58, borderWidth: 1, borderRadius: 18, paddingHorizontal: 20, fontSize: 17 },
  filters: { gap: 8, paddingRight: Spacing.four },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  loader: { paddingVertical: 80 },
  empty: { borderWidth: 1, borderRadius: 24, padding: Spacing.five, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 28, lineHeight: 34 },
  list: { gap: 10 },
  card: {
    minHeight: 110, borderWidth: 1, borderRadius: 20, padding: Spacing.three,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.three,
  },
  cardNumber: { width: 30, alignSelf: 'flex-start', paddingTop: 3 },
  cardBody: { flex: 1, gap: 12 },
  cardTitle: { fontSize: 17, lineHeight: 25 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
