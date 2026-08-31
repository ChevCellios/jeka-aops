export type AnalysisStatus = 'ready-for-model' | 'running' | 'completed' | 'failed';

export type ConfidenceLevel = 'confirmed' | 'likely' | 'unreliable' | 'not-determined';

export type BoundingBox = { x: number; y: number; width: number; height: number };

/** A still chosen by the pipeline; its URI becomes report evidence once extracted. */
export type EvidenceFrame = {
  id: string;
  frameTimeMs: number;
  width?: number;
  height?: number;
  sharpnessScore?: number;
  visibilityScore?: number;
  overallScore?: number;
  uri?: string;
};

export type VehicleDetection = {
  label: 'vehicle';
  confidence: number;
  frameTimeMs: number;
  boundingBox: BoundingBox;
};

export type PlateCandidate = {
  normalizedText: string;
  confidence: number;
  supportingFrameIds: string[];
  confirmationCount: number;
  confidenceLevel: ConfidenceLevel;
};

export type PlateObservation = {
  text: string;
  frameId: string;
  confidence: number;
  boundingBox: BoundingBox;
};

export type VehicleIdentityCandidate = {
  make?: string;
  model?: string;
  confidence: number;
  supportingFrameIds: string[];
  confidenceLevel: ConfidenceLevel;
};

export type NoiseAssociation = {
  startTimeMs: number;
  endTimeMs: number;
  averageDbfs: number;
  peakDbfs: number;
  confidenceLevel: ConfidenceLevel;
  note: string;
};

export type NoiseSample = {
  timeMs: number;
  dbfs: number;
};

export type NoiseSource = 'embedded-video' | 'live-metering';

export type AudioAnalysisSummary = {
  source: NoiseSource;
  sampleCount: number;
  sampleRateHz?: number;
  windowMs: number;
  averageDbfs: number;
  peakDbfs: number;
  note: string;
};

export type VehicleTrack = {
  id: string;
  detections: VehicleDetection[];
  evidenceFrameIds: string[];
  evidenceCropUri?: string;
  evidenceFrameTimeMs?: number;
  plateCandidates: PlateCandidate[];
  identityCandidates: VehicleIdentityCandidate[];
  noise?: NoiseAssociation;
};

export type AnalysisReport = {
  version: 1;
  sessionUri: string;
  generatedAt: string;
  status: AnalysisStatus;
  evidenceFrames: EvidenceFrame[];
  vehicleTracks: VehicleTrack[];
  unassignedPlateCandidates: PlateCandidate[];
  audioSummary?: AudioAnalysisSummary;
  limitations: string[];
};

export type VehicleAnalysisResult = {
  status: AnalysisStatus;
  sessionUri: string;
  startedAt: string;
  detections: VehicleDetection[];
  report: AnalysisReport;
};
