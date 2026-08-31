import type { AnalysisReport, EvidenceFrame, NoiseSample, NoiseSource, VehicleAnalysisResult, VehicleTrack } from './types';
import { trackVehicles } from './tracking';
import { detectVehiclesInFrames } from './vehicleDetectionModel';
import { recognizePlateObservations } from './plateOcr';
import { associatePlatesToTracks } from './plateAssociation';
import { correlateNoiseToTrack } from './noiseCorrelation';
import { attachVehicleEvidenceCrops } from './vehicleEvidence';
import { summarizeNoiseSamples } from './audioMetering';

function createEmptyReport(sessionUri: string, evidenceFrames: EvidenceFrame[], tracks: AnalysisReport['vehicleTracks'] = [], plateCandidates: AnalysisReport['unassignedPlateCandidates'] = [], modelError?: string, ocrError?: string, noiseSamples: NoiseSample[] = [], noiseSource: NoiseSource = 'live-metering', audioSampleRateHz?: number, audioWarning?: string): AnalysisReport {
  return {
    version: 1,
    sessionUri,
    generatedAt: new Date().toISOString(),
    status: modelError ? 'ready-for-model' : 'completed',
    evidenceFrames,
    vehicleTracks: tracks,
    unassignedPlateCandidates: plateCandidates,
    audioSummary: summarizeNoiseSamples(noiseSamples, noiseSource, audioSampleRateHz),
    limitations: [
      ...(modelError ? [`Detekcija vozila nije pokrenuta: ${modelError}`] : ['Detekcija vozila koristi početni COCO model; rezultat nije konačna identifikacija vozila.']),
      ...(ocrError ? [`OCR nije pokrenut: ${ocrError}`] : ['OCR rezultat je samo kandidat dok se ne potvrdi kroz više kadrova i prostorno ne veže uz vozilo.']),
      'Lokalni model za identifikaciju marke/modela još nije ugrađen.',
      ...(plateCandidates.length ? ['OCR kandidati nisu prostorno pridruženi pojedinom vozilu; ne predstavljaju potvrđenu registracijsku oznaku.'] : []),
      'Bez potvrde kroz više kadrova ne prikazuje se očitana registracijska oznaka.',
      'Mjerenje zvuka u dBFS nije kalibrirano mjerenje zvučnog tlaka u dB(A).',
      ...(audioWarning ? [audioWarning] : []),
    ],
  };
}

/** Runs the local vehicle, OCR, and audio-correlation pipeline. */
export async function prepareVehicleAnalysis(
  sessionUri: string,
  evidenceFrames: EvidenceFrame[] = [],
  noiseSamples: NoiseSample[] = [],
  noVehicleFound = false,
  precomputedDetections?: VehicleAnalysisResult['detections'],
  precomputedTracks?: VehicleTrack[],
  noiseSource: NoiseSource = 'live-metering',
  audioSampleRateHz?: number,
  audioWarning?: string,
): Promise<VehicleAnalysisResult> {
  let detections: VehicleAnalysisResult['detections'] = [];
  let plateCandidates: AnalysisReport['unassignedPlateCandidates'] = [];
  let tracks: AnalysisReport['vehicleTracks'] = [];
  let modelError: string | undefined;
  let ocrError: string | undefined;

  if (evidenceFrames.length) {
    try {
      detections = precomputedDetections ?? await detectVehiclesInFrames(evidenceFrames);
      tracks = (precomputedTracks ?? trackVehicles(detections, evidenceFrames)).map(track => ({
        ...track,
        evidenceFrameIds: evidenceFrames
          .filter(frame => track.detections.some(detection => detection.frameTimeMs === frame.frameTimeMs))
          .map(frame => frame.id),
        noise: correlateNoiseToTrack(track, noiseSamples),
      }));
      tracks = await attachVehicleEvidenceCrops(tracks, evidenceFrames);
    } catch (error) {
      modelError = error instanceof Error ? error.message : 'Nepoznata pogreška modela.';
      console.error('[JEKA AOPS] Model vozila nije uspio', { sessionUri, error: modelError });
    }
    try {
      const observations = await recognizePlateObservations(evidenceFrames, detections);
      const association = associatePlatesToTracks(tracks, evidenceFrames, observations);
      tracks = association.tracks;
      plateCandidates = association.unassigned;
    } catch (error) {
      ocrError = error instanceof Error ? error.message : 'Nepoznata pogreška OCR-a.';
      console.error('[JEKA AOPS] OCR nije uspio', { sessionUri, error: ocrError });
    }
  } else {
    modelError = noVehicleFound ? undefined : 'Nema dostupnih dokaznih kadrova.';
  }

  const report = createEmptyReport(sessionUri, evidenceFrames, tracks, plateCandidates, modelError, ocrError, noiseSamples, noiseSource, audioSampleRateHz, audioWarning);
  if (noVehicleFound) {
    report.limitations = [
      'Model u odabranim kadrovima nije pronašao vozilo.',
      'OCR je svejedno pokrenut na najboljim cijelim kadrovima; kandidati bez okvira vozila ostaju nepridruženi.',
      ...report.limitations.filter(item => !item.startsWith('Detekcija vozila koristi')),
    ];
  }
  if (!noiseSamples.length) {
    report.limitations.push('Nema audio uzoraka za očitanje i vremensku korelaciju s vozilom.');
  }
  return {
    status: modelError ? 'ready-for-model' : 'completed',
    sessionUri,
    startedAt: new Date().toISOString(),
    detections,
    report,
  };
}
