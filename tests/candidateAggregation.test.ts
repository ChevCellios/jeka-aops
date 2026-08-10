import { describe, expect, it } from 'vitest';
import { aggregateIdentityCandidates, aggregatePlateCandidates } from '../src/analysis/candidateAggregation';

describe('candidate aggregation', () => {
  it('spaja jednaku tablicu neovisno o formatiranju i deduplicira kadrove', () => {
    const [candidate] = aggregatePlateCandidates([
      { frameId: 'f1', confidence: 0.7, text: 'zg-1234-ab' },
      { frameId: 'f1', confidence: 0.9, text: 'ZG 1234 AB' },
      { frameId: 'f2', confidence: 0.8, text: 'ZG1234AB' },
      { frameId: 'f3', confidence: 1, text: 'x' },
    ]);
    expect(candidate.normalizedText).toBe('ZG1234AB');
    expect(candidate.supportingFrameIds).toEqual(['f1', 'f2']);
    expect(candidate.confirmationCount).toBe(2);
    expect(candidate.confidence).toBeCloseTo(0.85);
  });

  it('grupira identitet vozila i preskače prazna opažanja', () => {
    const candidates = aggregateIdentityCandidates([
      { frameId: 'f1', confidence: 0.8, make: 'Toyota', model: 'Corolla' },
      { frameId: 'f2', confidence: 0.7, make: 'Toyota', model: 'Corolla' },
      { frameId: 'f3', confidence: 1 },
    ]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ make: 'Toyota', model: 'Corolla', confidenceLevel: 'likely' });
  });
});
