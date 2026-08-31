import { describe, expect, it } from 'vitest';
import { formatLocation } from '../src/utils/formatters';

describe('formatiranje lokacije', () => {
  it('ne prikazuje preciznost veću od spremljene približne lokacije', () => {
    expect(formatLocation({
      latitude: 45.815,
      longitude: 15.982,
      accuracyMeters: 110,
      capturedAt: '2026-08-31T12:00:00.000Z',
    })).toBe('45.815, 15.982 ±110 m');
  });

  it('jasno označava da lokacija nije prikupljena', () => {
    expect(formatLocation()).toBe('Lokacija nije dostupna');
  });
});
