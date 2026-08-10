import { describe, expect, it } from 'vitest';
import { assessMultiFrameConfidence } from '../src/analysis/confidence';

describe('assessMultiFrameConfidence', () => {
  it('broji samo najjače opažanje iz svakog kadra', () => {
    const result = assessMultiFrameConfidence([
      { frameId: 'f1', confidence: 0.4 },
      { frameId: 'f1', confidence: 0.9 },
      { frameId: 'f2', confidence: 0.7 },
    ]);
    expect(result.confirmationCount).toBe(2);
    expect(result.averageConfidence).toBeCloseTo(0.8);
    expect(result.confidenceLevel).toBe('likely');
  });

  it('za potvrdu zahtijeva tri jaka različita kadra', () => {
    expect(assessMultiFrameConfidence([
      { frameId: 'f1', confidence: 0.9 },
      { frameId: 'f2', confidence: 0.86 },
      { frameId: 'f3', confidence: 0.85 },
    ]).confidenceLevel).toBe('confirmed');
  });

  it('ignorira nevaljana opažanja i ograničava confidence na raspon 0–1', () => {
    const result = assessMultiFrameConfidence([
      { frameId: '', confidence: 0.9 },
      { frameId: 'bad', confidence: Number.NaN },
      { frameId: 'f1', confidence: 2 },
    ]);
    expect(result).toEqual({ confidenceLevel: 'unreliable', confirmationCount: 1, averageConfidence: 1 });
  });
});
