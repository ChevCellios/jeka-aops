import * as FileSystem from 'expo-file-system/legacy';
import { createVideoPlayer } from 'expo-video';
import type { NoiseSample } from '../analysis/types';
import type { CaptureLocation } from '../analysis/sessionAnalysis';
import type { Session } from '../models/session';
import { RECORDINGS_DIRECTORY } from './sessionStorage';

export async function readVideoDuration(uri: string): Promise<number> {
  const player = createVideoPlayer({ uri });
  try {
    if (Number.isFinite(player.duration) && player.duration > 0) return player.duration;
    return await new Promise<number>((resolve, reject) => {
      let completed = false;
      let sourceSubscription: { remove: () => void } | undefined;
      let statusSubscription: { remove: () => void } | undefined;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const finish = (callback: () => void) => {
        if (completed) return;
        completed = true;
        sourceSubscription?.remove();
        statusSubscription?.remove();
        if (timeout) clearTimeout(timeout);
        callback();
      };
      sourceSubscription = player.addListener('sourceLoad', event => finish(() => resolve(event.duration)));
      statusSubscription = player.addListener('statusChange', event => {
        if (event.status === 'error') finish(() => reject(new Error('Video nije moguće učitati.')));
      });
      timeout = setTimeout(() => finish(() => reject(new Error('Isteklo je vrijeme učitavanja videa.'))), 15_000);
    });
  } finally {
    player.release();
  }
}

export async function persistImportedVideo(asset: { uri: string; name: string; size?: number }): Promise<Session> {
  const extension = asset.name.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
  const safeExtension = extension && ['mp4', 'mov', 'm4v', '3gp'].includes(extension) ? extension : 'mp4';
  await FileSystem.makeDirectoryAsync(RECORDINGS_DIRECTORY, { intermediates: true });
  const id = `${Date.now()}`;
  const destination = `${RECORDINGS_DIRECTORY}session-${id}.${safeExtension}`;
  try {
    await FileSystem.copyAsync({ from: asset.uri, to: destination });
    const durationSeconds = Math.max(1, Math.round(await readVideoDuration(destination)));
    const info = await FileSystem.getInfoAsync(destination);
    return { id, createdAt: new Date().toISOString(), durationSeconds, uri: destination, sizeBytes: info.exists ? info.size : asset.size, analysis: { status: 'queued', updatedAt: new Date().toISOString(), note: 'Čeka lokalnu analizu uvezene snimke.' } };
  } catch (error) {
    await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => undefined);
    throw error;
  }
}

export async function persistCameraRecording(input: {
  videoUri: string;
  audioUri?: string | null;
  startedAt: number;
  noiseAverageDbfs?: number;
  noisePeakDbfs?: number;
  noiseSamples: NoiseSample[];
  location?: CaptureLocation;
}): Promise<Session> {
  await FileSystem.makeDirectoryAsync(RECORDINGS_DIRECTORY, { intermediates: true });
  const id = `${Date.now()}`;
  const destination = `${RECORDINGS_DIRECTORY}session-${id}.mp4`;
  const audioDestination = `${RECORDINGS_DIRECTORY}session-${id}.m4a`;
  try {
    await FileSystem.copyAsync({ from: input.videoUri, to: destination });
    if (input.audioUri) await FileSystem.copyAsync({ from: input.audioUri, to: audioDestination });
    const info = await FileSystem.getInfoAsync(destination);
    return {
    id,
    createdAt: new Date().toISOString(),
    durationSeconds: Math.max(1, Math.floor((Date.now() - input.startedAt) / 1000)),
    uri: destination,
    sizeBytes: info.exists ? info.size : 0,
    noiseAverageDbfs: input.noiseAverageDbfs,
    noisePeakDbfs: input.noisePeakDbfs,
    noiseSamples: input.noiseSamples,
    audioUri: input.audioUri ? audioDestination : undefined,
    location: input.location,
    analysis: { status: 'queued', updatedAt: new Date().toISOString(), note: 'Čeka automatsku obradu.' },
    };
  } catch (error) {
    await Promise.all([
      FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => undefined),
      FileSystem.deleteAsync(audioDestination, { idempotent: true }).catch(() => undefined),
    ]);
    throw error;
  }
}
