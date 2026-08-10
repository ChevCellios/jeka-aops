import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import type { Session } from '../models/session';

const SESSIONS_KEY = '@jeka-aops/sessions';
export const RECORDINGS_DIRECTORY = `${FileSystem.documentDirectory}jeka-aops/`;
export const EVIDENCE_DIRECTORY = `${RECORDINGS_DIRECTORY}evidence/`;

export async function loadStoredSessions(): Promise<Session[]> {
  const raw = await AsyncStorage.getItem(SESSIONS_KEY);
  if (!raw) return [];
  const stored = (JSON.parse(raw) as Session[]).map(session => session.analysis?.status === 'running'
    ? {
        ...session,
        analysis: {
          status: 'queued' as const,
          updatedAt: new Date().toISOString(),
          note: 'Prethodna obrada prekinuta je zatvaranjem aplikacije; pokrenite je ponovno.',
        },
      }
    : session);
  return Promise.all(stored.map(async session => {
    if (session.sizeBytes) return session;
    const info = await FileSystem.getInfoAsync(session.uri);
    return { ...session, sizeBytes: info.exists ? info.size : 0 };
  }));
}

export async function persistSessions(sessions: Session[]) {
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

function assertManagedSession(session: Session) {
  if (!/^\d+$/.test(session.id)) throw new Error('Neispravan identifikator sesije.');
  if (!session.uri.startsWith(RECORDINGS_DIRECTORY)) throw new Error('Snimka nije u upravljanoj mapi aplikacije.');
  if (session.audioUri && !session.audioUri.startsWith(RECORDINGS_DIRECTORY)) throw new Error('Zvuk nije u upravljanoj mapi aplikacije.');
}

export async function deleteSessionFiles(session: Session) {
  assertManagedSession(session);
  await FileSystem.deleteAsync(session.uri, { idempotent: true });
  if (session.audioUri) await FileSystem.deleteAsync(session.audioUri, { idempotent: true });
  const evidenceDirectory = `${EVIDENCE_DIRECTORY}${session.id}/`;
  const evidenceFiles = await FileSystem.readDirectoryAsync(evidenceDirectory).catch(() => [] as string[]);
  await Promise.all(evidenceFiles.map(file => FileSystem.deleteAsync(`${evidenceDirectory}${file}`, { idempotent: true })));
  await FileSystem.deleteAsync(evidenceDirectory, { idempotent: true }).catch(() => undefined);
  await FileSystem.deleteAsync(`${RECORDINGS_DIRECTORY}report-${session.id}.txt`, { idempotent: true }).catch(() => undefined);
}
