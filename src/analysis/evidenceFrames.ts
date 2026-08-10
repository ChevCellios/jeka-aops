import * as FileSystem from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';
import type { EvidenceFrame } from './types';

const EVIDENCE_DIRECTORY = `${FileSystem.documentDirectory}jeka-aops/evidence/`;
const SAMPLE_INTERVAL_MS = 500;
// Recording is capped at five minutes, so this still covers the whole session.
const MAX_CANDIDATE_FRAMES = 600;

/**
 * Produces one local candidate per half-second. This keeps short appearances
 * and faster passing vehicles eligible for analysis.
 * The cap bounds device work on unusually long recordings.
 */
export async function extractEvidenceFrames(sessionUri: string, sessionId: string, durationSeconds: number): Promise<EvidenceFrame[]> {
  const durationMs = Math.max(1_000, durationSeconds * 1_000);
  const candidateCount = Math.min(MAX_CANDIDATE_FRAMES, Math.ceil(durationMs / SAMPLE_INTERVAL_MS));
  const frameTimes = Array.from({ length: candidateCount }, (_, index) => Math.min(durationMs - 1, index * SAMPLE_INTERVAL_MS));
  return extractEvidenceFramesAtTimes(sessionUri, sessionId, frameTimes, 'sample');
}

/** Extracts local evidence at explicit timestamps, used for dense vehicle windows. */
export async function extractEvidenceFramesAtTimes(sessionUri: string, sessionId: string, frameTimes: number[], prefix: string): Promise<EvidenceFrame[]> {
  const directory = `${EVIDENCE_DIRECTORY}${sessionId}/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

  const frames: EvidenceFrame[] = [];
  // Generate sequentially: several hundred concurrent thumbnail requests can
  // exhaust memory on a phone.
  for (const [index, frameTimeMs] of frameTimes.entries()) {
    try {
      const thumbnail = await VideoThumbnails.getThumbnailAsync(sessionUri, { quality: 0.8, time: frameTimeMs });
      const uri = `${directory}${prefix}-${index + 1}.jpg`;
      await FileSystem.copyAsync({ from: thumbnail.uri, to: uri });
      frames.push({ id: `${prefix}-${index + 1}`, frameTimeMs, uri, width: thumbnail.width, height: thumbnail.height });
    } catch (error) {
      // Continue with the remaining timestamps when an individual thumbnail fails.
      console.warn('[JEKA AOPS] Izdvajanje kadra nije uspjelo', { sessionId, frameTimeMs, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return frames;
}
