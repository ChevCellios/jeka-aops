import { describe, expect, it } from 'vitest';
import { extractPlateCandidates } from '../src/analysis/plateParsing';

describe('extractPlateCandidates', () => {
  it('normalizira razmake, crtice i mala slova', () => {
    expect(extractPlateCandidates('registracija: zg-1234-ab')).toContain('ZG1234AB');
  });

  it('ispravlja tipične OCR zamjene samo u odgovarajućim dijelovima', () => {
    expect(extractPlateCandidates('ZG I23S A')).toContain('ZG1235A');
  });

  it('ne prihvaća tekst bez cjelovite tablice', () => {
    expect(extractPlateCandidates('ZG 12')).toEqual([]);
  });

  it('odbacuje nepostojeću hrvatsku područnu oznaku', () => {
    expect(extractPlateCandidates('XX 1234 AB')).toEqual([]);
  });

  it('zadržava najpotpuniju varijantu istog OCR čitanja', () => {
    expect(extractPlateCandidates('ZG 1234 AB')).toEqual(['ZG1234AB']);
  });
});
