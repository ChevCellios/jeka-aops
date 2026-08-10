import type { NoiseSample } from '../analysis/types';
import type { CaptureLocation, SessionAnalysis } from '../analysis/sessionAnalysis';

export type Session = {
  id: string;
  createdAt: string;
  durationSeconds: number;
  uri: string;
  sizeBytes?: number;
  noiseAverageDbfs?: number;
  noisePeakDbfs?: number;
  noiseSamples?: NoiseSample[];
  audioUri?: string;
  location?: CaptureLocation;
  analysis?: SessionAnalysis;
};
