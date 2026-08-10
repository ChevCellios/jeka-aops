import type { ConfidenceLevel } from './types';

export type FrameObservation = {
  frameId: string;
  confidence: number;
};

export type ConfidenceAssessment = {
  confidenceLevel: ConfidenceLevel;
  confirmationCount: number;
  averageConfidence: number;
};

/**
 * Conservative policy shared by OCR, make/model and noise correlation.
 * Repeated observations must come from distinct frames; a single strong model
 * output is intentionally never promoted to "confirmed".
 */
export function assessMultiFrameConfidence(observations: FrameObservation[]): ConfidenceAssessment {
  const strongestByFrame = new Map<string, number>();
  for (const observation of observations) {
    if (!Number.isFinite(observation.confidence) || !observation.frameId) continue;
    const confidence = Math.max(0, Math.min(1, observation.confidence));
    strongestByFrame.set(observation.frameId, Math.max(strongestByFrame.get(observation.frameId) ?? 0, confidence));
  }

  const values = [...strongestByFrame.values()];
  const confirmationCount = values.length;
  const averageConfidence = confirmationCount ? values.reduce((sum, value) => sum + value, 0) / confirmationCount : 0;

  if (confirmationCount >= 3 && averageConfidence >= 0.85) {
    return { confidenceLevel: 'confirmed', confirmationCount, averageConfidence };
  }
  if (confirmationCount >= 2 && averageConfidence >= 0.65) {
    return { confidenceLevel: 'likely', confirmationCount, averageConfidence };
  }
  if (confirmationCount > 0) {
    return { confidenceLevel: 'unreliable', confirmationCount, averageConfidence };
  }
  return { confidenceLevel: 'not-determined', confirmationCount, averageConfidence };
}
