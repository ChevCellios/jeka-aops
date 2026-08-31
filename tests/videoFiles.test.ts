import { describe, expect, it } from 'vitest';
import { validateCopiedVideoSize, validateImportedVideo, videoExtension, videoMimeType } from '../src/services/videoFiles';

describe('video datoteke', () => {
  it('prihvaća podržane nastavke bez obzira na velika slova', () => {
    expect(videoExtension('PROMET.MOV')).toBe('mov');
    expect(videoExtension('snimka.3gp')).toBe('3gp');
  });

  it('nepoznati nastavak svodi na mp4', () => {
    expect(videoExtension('snimka.exe')).toBe('mp4');
    expect(videoExtension('snimka')).toBe('mp4');
  });

  it('odabire MIME tip prema spremljenom nastavku', () => {
    expect(videoMimeType('file:///session-1.mov')).toBe('video/quicktime');
    expect(videoMimeType('file:///session-1.m4v')).toBe('video/x-m4v');
  });

  it('odbija datoteke veće od 500 MB prije i nakon kopiranja', () => {
    const oversized = 500 * 1024 * 1024 + 1;
    expect(() => validateImportedVideo({ size: oversized })).toThrow('500 MB');
    expect(() => validateCopiedVideoSize(oversized)).toThrow('500 MB');
  });
});
