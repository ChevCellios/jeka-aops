import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { Session } from '../models/session';
import { analysisLabel, formatDbfs, formatDuration, formatLocation } from '../utils/formatters';
import { RECORDINGS_DIRECTORY } from './sessionStorage';

async function ensureSharingAvailable() {
  if (!await Sharing.isAvailableAsync()) throw new Error('Ovaj uređaj trenutačno ne podržava dijeljenje datoteka.');
}

export async function shareRecording(session: Session) {
  await ensureSharingAvailable();
  await Sharing.shareAsync(session.uri, { mimeType: 'video/mp4', dialogTitle: 'Izvezi snimku' });
}

export async function shareSessionReport(session: Session, progress?: string) {
  await ensureSharingAvailable();
  const report = session.analysis?.report;
  const lines = [
    'JEKA AOPS — izvještaj prometne sesije',
    `Vrijeme snimanja: ${new Date(session.createdAt).toLocaleString('hr-HR')}`,
    `Trajanje: ${formatDuration(session.durationSeconds)}`,
    `Lokacija: ${formatLocation(session.location)}`,
    `Buka: prosjek ${formatDbfs(session.noiseAverageDbfs)}, vrh ${formatDbfs(session.noisePeakDbfs)} (dBFS)`,
    `Status obrade: ${analysisLabel(session.analysis, progress)}`,
    `Dokazni kadrovi: ${report?.evidenceFrames.length ?? 0}`,
    `Tragovi vozila: ${report?.vehicleTracks.length ?? 0}`,
    '',
    'Ograničenja i upozorenja:',
    ...(report?.limitations ?? ['Automatska analiza još nije pripremljena.']).map(item => `- ${item}`),
    '',
    'Ovaj izvještaj sadrži procjene i ne predstavlja certificirano mjerenje niti automatski zaključak.',
  ];
  await FileSystem.makeDirectoryAsync(RECORDINGS_DIRECTORY, { intermediates: true });
  const uri = `${RECORDINGS_DIRECTORY}report-${session.id}.txt`;
  await FileSystem.writeAsStringAsync(uri, lines.join('\n'));
  await Sharing.shareAsync(uri, { mimeType: 'text/plain', dialogTitle: 'Izvezi izvještaj' });
}
