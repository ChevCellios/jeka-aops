import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import type { Session } from '../models/session';

const SESSIONS_KEY = '@jeka-aops/sessions';
const CORRUPT_SESSIONS_KEY = '@jeka-aops/sessions-corrupt';
export const RECORDINGS_DIRECTORY = `${FileSystem.documentDirectory}jeka-aops/`;
export const EVIDENCE_DIRECTORY = `${RECORDINGS_DIRECTORY}evidence/`;

function isStoredSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<Session>;
  return typeof session.id === 'string'
    && /^\d+$/.test(session.id)
    && typeof session.uri === 'string'
    && session.uri.startsWith(RECORDINGS_DIRECTORY)
    && typeof session.createdAt === 'string'
    && Number.isFinite(Date.parse(session.createdAt))
    && typeof session.durationSeconds === 'number'
    && Number.isFinite(session.durationSeconds)
    && session.durationSeconds > 0;
}

async function quarantineCorruptSessions(raw: string) {
  await AsyncStorage.setItem(CORRUPT_SESSIONS_KEY, raw);
  await AsyncStorage.removeItem(SESSIONS_KEY);
}

export async function loadStoredSessions(): Promise<Session[]> {
  const raw = await AsyncStorage.getItem(SESSIONS_KEY);
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await quarantineCorruptSessions(raw);
    return [];
  }
  if (!Array.isArray(parsed)) {
    await quarantineCorruptSessions(raw);
    return [];
  }
  const stored = parsed.filter(isStoredSession).map(session => session.analysis?.status === 'running'
    ? {
        ...session,
        analysis: {
          status: 'queued' as const,
          updatedAt: new Date().toISOString(),
          note: 'Prethodna obrada prekinuta je zatvaranjem aplikacije; pokrenite je ponovno.',
        },
      }
    : session);
  const checked: (Session | null)[] = await Promise.all(stored.map(async (session): Promise<Session | null> => {
    const info = await FileSystem.getInfoAsync(session.uri).catch(() => null);
    if (!info) return null;
    return info.exists ? { ...session, sizeBytes: info.size } : null;
  }));
  return checked.filter((session): session is Session => session !== null);
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
