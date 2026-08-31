import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Session } from '../models/session';
import { analysisLabel, formatDbfs, formatDuration, formatFileSize, formatLocation, noiseLabel } from '../utils/formatters';

type Props = {
  sessions: Session[];
  activeSessionIds: string[];
  analysisProgress: Record<string, string>;
  onAnalyze: (session: Session) => void;
  onDelete: (session: Session) => void;
  onPlay: (session: Session) => void;
  onReport: (session: Session) => void;
  onShare: (session: Session) => void;
};

export function SessionList({ sessions, activeSessionIds, analysisProgress, onAnalyze, onDelete, onPlay, onReport, onShare }: Props) {
  const activeIds = new Set(activeSessionIds);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Lokalne sesije ({sessions.length})</Text>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {sessions.length === 0 ? <Text style={styles.empty}>Još nema snimljenih sesija.</Text> : sessions.map(session => {
          const analysisActive = activeIds.has(session.id);
          return (
          <View key={session.id} style={styles.card}>
            <View style={styles.info}>
              <Text style={styles.title}>Prometna sesija</Text>
              <Text style={styles.date}>{new Date(session.createdAt).toLocaleString('hr-HR')}</Text>
              <Text style={styles.meta}>{formatDuration(session.durationSeconds)} · {formatFileSize(session.sizeBytes)}</Text>
              <Text style={styles.secondary}>Buka: {noiseLabel(session.noiseAverageDbfs)} · prosjek {formatDbfs(session.noiseAverageDbfs)} · vrh {formatDbfs(session.noisePeakDbfs)}</Text>
              <Text style={styles.secondary}>{formatLocation(session.location)}</Text>
              <Text style={styles.analysis}>{analysisLabel(session.analysis, analysisProgress[session.id])}</Text>
            </View>
            <View style={styles.actions}>
              <Action label="Pregledaj" onPress={() => onPlay(session)} style={styles.play} />
              <Action disabled={analysisActive} label={analysisActive ? 'Obrada…' : 'Analiziraj'} onPress={() => onAnalyze(session)} style={styles.analyze} />
              <Action label="Podijeli" onPress={() => onShare(session)} style={styles.share} />
              <Action label="Izvješće" onPress={() => onReport(session)} style={styles.report} />
              <Action disabled={analysisActive} label="Obriši" onPress={() => onDelete(session)} style={styles.delete} textStyle={styles.deleteText} />
            </View>
          </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Action({ disabled = false, label, onPress, style, textStyle }: { disabled?: boolean; label: string; onPress: () => void; style: object; textStyle?: object }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.action, style, disabled && styles.actionDisabled]}><Text style={[styles.actionText, textStyle]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  section: { flex: 0.5, paddingHorizontal: 20 }, sectionTitle: { color: '#DCE9EB', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  list: { gap: 8, paddingBottom: 12 }, empty: { color: '#80989F', fontSize: 14, paddingVertical: 10 },
  card: { alignItems: 'flex-start', backgroundColor: '#10252D', borderRadius: 12, flexDirection: 'row', gap: 10, padding: 13 },
  info: { flex: 1, flexShrink: 1, minWidth: 0 }, title: { color: '#DCE9EB', fontSize: 14, fontWeight: '700' },
  date: { color: '#80989F', fontSize: 12, marginTop: 3 }, meta: { color: '#57D9C3', fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '700', marginTop: 5 },
  secondary: { color: '#A9C4CA', fontSize: 10, fontVariant: ['tabular-nums'], marginTop: 4 }, analysis: { color: '#C8D8FF', fontSize: 10, marginTop: 4 },
  actions: { alignItems: 'stretch', flexShrink: 0, gap: 7, width: 92 }, action: { alignItems: 'center', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 7 },
  actionText: { color: '#DCE9EB', fontSize: 12, fontWeight: '800' }, play: { backgroundColor: '#1A4750' }, analyze: { backgroundColor: '#263E70' },
  actionDisabled: { opacity: 0.45 },
  share: { backgroundColor: '#1B5D55' }, report: { backgroundColor: '#3A3158' }, delete: { backgroundColor: 'transparent', paddingVertical: 4 }, deleteText: { color: '#FF8E9D' },
});
