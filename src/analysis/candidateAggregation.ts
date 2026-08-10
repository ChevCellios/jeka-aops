import { assessMultiFrameConfidence, type FrameObservation } from './confidence';
import type { PlateCandidate, VehicleIdentityCandidate } from './types';

export type TextObservation = FrameObservation & { text: string };
export type IdentityObservation = FrameObservation & { make?: string; model?: string };

const normalizePlate = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

export function aggregatePlateCandidates(observations: TextObservation[]): PlateCandidate[] {
  const grouped = new Map<string, TextObservation[]>();
  for (const observation of observations) {
    const text = normalizePlate(observation.text);
    if (text.length < 4) continue;
    grouped.set(text, [...(grouped.get(text) ?? []), { ...observation, text }]);
  }
  return [...grouped.entries()].map(([normalizedText, items]) => {
    const assessment = assessMultiFrameConfidence(items);
    return { normalizedText, confidence: assessment.averageConfidence, supportingFrameIds: [...new Set(items.map(item => item.frameId))], ...assessment };
  }).sort((a, b) => b.confidence - a.confidence);
}

export function aggregateIdentityCandidates(observations: IdentityObservation[]): VehicleIdentityCandidate[] {
  const grouped = new Map<string, IdentityObservation[]>();
  for (const observation of observations) {
    const key = `${observation.make ?? ''}|${observation.model ?? ''}`;
    if (key === '|') continue;
    grouped.set(key, [...(grouped.get(key) ?? []), observation]);
  }
  return [...grouped.values()].map(items => {
    const assessment = assessMultiFrameConfidence(items);
    return { make: items[0].make, model: items[0].model, confidence: assessment.averageConfidence, supportingFrameIds: [...new Set(items.map(item => item.frameId))], confidenceLevel: assessment.confidenceLevel };
  }).sort((a, b) => b.confidence - a.confidence);
}
