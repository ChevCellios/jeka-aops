import { extractEvidenceFrames, extractEvidenceFramesAtTimes } from './evidenceFrames';
import * as FileSystem from 'expo-file-system/legacy';
import { rankEvidenceFrames, rankVehicleEvidenceFrames } from './frameRanking';
import { trackVehicles } from './tracking';
import { detectVehiclesInFrames, vehicleDetectionAvailable } from './vehicleDetectionModel';
import type { AnalysisReport, NoiseSample, NoiseSource } from './types';
import { prepareVehicleAnalysis } from './vehicleAnalysis';
import { decodeAudioReadings } from './audioDecoder';

export type CaptureLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  capturedAt: string;
};

export type SessionAnalysis = {
  status: 'queued' | 'running' | 'ready-for-model' | 'completed' | 'failed';
  updatedAt: string;
  note: string;
  error?: string;
  report?: AnalysisReport;
};

export type AnalysisProgress = 'Dekodiram zvuk' | 'Izdvajam kadrove' | 'Tražim vozila' | 'Izdvajam guste kadrove' | 'Rangiram dokaze' | 'Čitam oznake';

const DENSE_SAMPLE_INTERVAL_MS = 200;
const VEHICLE_WINDOW_PADDING_MS = 1_000;
const EVIDENCE_TIME_SEPARATION_MS = 400;

async function removeUnusedFrames(frames: AnalysisReport['evidenceFrames'], retainedFrames: AnalysisReport['evidenceFrames']) {
  const retainedUris = new Set(retainedFrames.map(frame => frame.uri).filter((uri): uri is string => Boolean(uri)));
  await Promise.all(frames.map(frame =>
    frame.uri && !retainedUris.has(frame.uri)
      ? FileSystem.deleteAsync(frame.uri, { idempotent: true }).catch(() => undefined)
      : Promise.resolve(),
  ));
}

function denseVehicleTimes(detections: Awaited<ReturnType<typeof detectVehiclesInFrames>>, durationSeconds: number) {
  const times = [...new Set(detections.map(detection => detection.frameTimeMs))].sort((left, right) => left - right);
  const windows: { start: number; end: number }[] = [];
  for (const time of times) {
    const previous = windows.at(-1);
    if (previous && time - previous.end <= 1_500) previous.end = time;
    else windows.push({ start: time, end: time });
  }
  const durationMs = durationSeconds * 1_000;
  const selected = new Set<number>();
  for (const window of windows) {
    const start = Math.max(0, window.start - VEHICLE_WINDOW_PADDING_MS);
    const end = Math.min(durationMs - 1, window.end + VEHICLE_WINDOW_PADDING_MS);
    for (let time = start; time <= end; time += DENSE_SAMPLE_INTERVAL_MS) selected.add(time);
  }
  return [...selected].sort((left, right) => left - right);
}

/** Entry point for post-recording processing; later AI stages live here. */
export async function beginAutomaticAnalysis(sessionUri: string, sessionId: string, durationSeconds: number, noiseSamples: NoiseSample[] = [], onProgress?: (progress: AnalysisProgress) => void): Promise<SessionAnalysis> {
  let effectiveNoiseSamples = noiseSamples;
  let noiseSource: NoiseSource = 'live-metering';
  let audioSampleRateHz: number | undefined;
  let audioWarning: string | undefined;
  if (!effectiveNoiseSamples.length) {
    onProgress?.('Dekodiram zvuk');
    try {
      const decoded = await decodeAudioReadings(sessionUri);
      effectiveNoiseSamples = decoded.samples;
      noiseSource = 'embedded-video';
      audioSampleRateHz = decoded.sampleRateHz;
      console.log('[JEKA AOPS] Audio je dekodiran', { sessionId, samples: decoded.samples.length, channels: decoded.channelCount, sampleRateHz: decoded.sampleRateHz, durationSeconds: decoded.durationSeconds });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      audioWarning = 'Audio zapis nije dostupan ili ga ovaj uređaj ne može dekodirati.';
      console.warn('[JEKA AOPS] Audio nije dekodiran', { sessionId, error: message });
    }
  }
  if (!vehicleDetectionAvailable) {
    const result = await prepareVehicleAnalysis(sessionUri, [], effectiveNoiseSamples, false, undefined, undefined, noiseSource, audioSampleRateHz, audioWarning);
    return {
      status: 'ready-for-model',
      updatedAt: new Date().toISOString(),
      note: 'Snimka je spremljena. Model detekcije nije uključen u ovu javnu verziju aplikacije.',
      report: result.report,
    };
  }
  let generatedFrames: AnalysisReport['evidenceFrames'] = [];
  let retainedFrames: AnalysisReport['evidenceFrames'] = [];
  try {
    console.log('[JEKA AOPS] Početak analize', { sessionId, sessionUri, durationSeconds, noiseSamples: noiseSamples.length });
    onProgress?.('Izdvajam kadrove');
    const candidates = await extractEvidenceFrames(sessionUri, sessionId, durationSeconds);
    generatedFrames.push(...candidates);
    console.log('[JEKA AOPS] Početni kadrovi', { sessionId, count: candidates.length, frameTimesMs: candidates.map(frame => frame.frameTimeMs) });
    // A sharp empty road is not useful evidence. Detect first, then rank only
    // frames which actually contain at least one vehicle.
    onProgress?.('Tražim vozila');
    const candidateDetections = await detectVehiclesInFrames(candidates);
    const frameTimesWithVehicles = new Set(candidateDetections.map(detection => detection.frameTimeMs));
    const vehicleCandidates = candidates.filter(frame => frameTimesWithVehicles.has(frame.frameTimeMs));
    const denseTimes = denseVehicleTimes(candidateDetections, durationSeconds);
    onProgress?.('Izdvajam guste kadrove');
    const denseCandidates = await extractEvidenceFramesAtTimes(sessionUri, sessionId, denseTimes, 'vehicle');
    generatedFrames.push(...denseCandidates);
    console.log('[JEKA AOPS] Gusti kadrovi', { sessionId, requestedTimesMs: denseTimes, extractedTimesMs: denseCandidates.map(frame => frame.frameTimeMs) });
    const denseDetections = await detectVehiclesInFrames(denseCandidates);
    const denseFrameTimesWithVehicles = new Set(denseDetections.map(detection => detection.frameTimeMs));
    const denseVehicleCandidates = denseCandidates.filter(frame => denseFrameTimesWithVehicles.has(frame.frameTimeMs));
    // If the detector misses every vehicle, retain the best full frames and run
    // OCR as an explicitly unassigned fallback instead of returning no evidence.
    const evidencePool = denseVehicleCandidates.length
      ? denseVehicleCandidates
      : vehicleCandidates.length
        ? vehicleCandidates
        : candidates;
    const detectionPool = denseVehicleCandidates.length ? denseDetections : candidateDetections;
    onProgress?.('Rangiram dokaze');
    const rankedFrames = detectionPool.length
      ? await rankVehicleEvidenceFrames(evidencePool, detectionPool)
      : await rankEvidenceFrames(evidencePool);
    const tracks = trackVehicles(detectionPool, evidencePool);
    const selectedIds = new Set<string>();
    for (const track of tracks) {
      const bestForTrack = rankedFrames.find(frame => track.evidenceFrameIds.includes(frame.id));
      if (bestForTrack) selectedIds.add(bestForTrack.id);
      if (selectedIds.size === 3) break;
    }
    // Prefer distinct moments of the pass. Three adjacent thumbnails often
    // contain the same blur, while a short separation captures approach,
    // closest point and departure and improves multi-frame OCR consensus.
    for (const frame of rankedFrames) {
      if (selectedIds.size === 3) break;
      const tooClose = rankedFrames.some(selected =>
        selectedIds.has(selected.id)
        && Math.abs(selected.frameTimeMs - frame.frameTimeMs) < EVIDENCE_TIME_SEPARATION_MS,
      );
      if (tooClose) continue;
      selectedIds.add(frame.id);
    }
    // If the vehicle was visible for less than the preferred separation,
    // still return up to three real vehicle frames instead of empty slots.
    for (const frame of rankedFrames) {
      if (selectedIds.size === 3) break;
      selectedIds.add(frame.id);
    }
    const evidenceFrames = rankedFrames.filter(frame => selectedIds.has(frame.id));
    retainedFrames = evidenceFrames;
    const selectedFrameTimes = new Set(evidenceFrames.map(frame => frame.frameTimeMs));
    const selectedDetections = detectionPool.filter(detection => selectedFrameTimes.has(detection.frameTimeMs));
    console.log('[JEKA AOPS] Analitički tok', {
      sessionId,
      durationSeconds,
      candidateDetections: candidateDetections.length,
      denseDetections: denseDetections.length,
      evidenceFrames: evidenceFrames.length,
      preliminaryTracks: tracks.length,
      selectedDetections: selectedDetections.length,
    });
    onProgress?.('Čitam oznake');
    const result = await prepareVehicleAnalysis(
      sessionUri,
      evidenceFrames,
      effectiveNoiseSamples,
      vehicleCandidates.length === 0,
      selectedDetections,
      tracks,
      noiseSource,
      audioSampleRateHz,
      audioWarning,
    );
    console.log('[JEKA AOPS] Izvještaj analize', {
      sessionId,
      status: result.report.status,
      tracks: result.report.vehicleTracks.length,
      evidenceFrames: result.report.evidenceFrames.length,
      plateCandidates: result.report.vehicleTracks.reduce((sum, track) => sum + track.plateCandidates.length, 0),
    });
    return {
      status: result.status === 'completed' ? 'completed' : result.status === 'ready-for-model' ? 'ready-for-model' : 'failed',
      updatedAt: new Date().toISOString(),
      note: vehicleCandidates.length === 0
        ? `Detektor nije pronašao vozilo; OCR je ipak provjeren na ${evidenceFrames.length} najbolja kadra.`
        : result.status === 'completed'
        ? `Analiza je dovršena na ${evidenceFrames.length} rangiranih dokaznih kadrova.`
        : result.status === 'ready-for-model'
          ? `Izdvojena su i rangirana ${evidenceFrames.length} dokazna kadra; detekcija nije dostupna u ovom buildu.`
          : 'Automatska obrada nije dostupna.',
      report: result.report,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[JEKA AOPS] Automatska analiza nije uspjela', {
      sessionId,
      sessionUri,
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
    });
    retainedFrames = [];
    return {
      status: 'failed',
      updatedAt: new Date().toISOString(),
      note: `Priprema automatske obrade nije uspjela: ${message}`,
      error: message,
    };
  } finally {
    await removeUnusedFrames(generatedFrames, retainedFrames);
  }
}
