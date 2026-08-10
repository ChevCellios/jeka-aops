/**
 * Normalizes the few character substitutions that are common when OCR reads a
 * reflective licence plate.  Substitutions are applied only in the part where
 * that character is valid, so a value is never accepted solely because it was
 * "close" to a plate.
 */
const TO_DIGIT: Record<string, string> = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', G: '6', B: '8' };
const TO_LETTER: Record<string, string> = { '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '6': 'G', '8': 'B' };
const CROATIAN_AREA_CODES = new Set([
  'BJ', 'BM', 'CK', 'DA', 'DE', 'DJ', 'DU', 'GS', 'IM', 'KA', 'KC', 'KR', 'KT', 'KZ',
  'MA', 'NA', 'NG', 'OG', 'OS', 'PU', 'PZ', 'RI', 'SB', 'SK', 'SL', 'ST', 'SI', 'VK',
  'VT', 'VU', 'VZ', 'ZD', 'ZG', 'ZU',
]);

const compact = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');
const asDigits = (value: string) => [...value].map(character => TO_DIGIT[character] ?? character).join('');
const asLetters = (value: string) => [...value].map(character => TO_LETTER[character] ?? character).join('');

/**
 * Extracts Croatian/EU-style plates from a potentially noisy OCR string.
 * The result is deliberately unformatted so equal readings from different
 * frames aggregate under the same key (for example, "ZG-1234-A" and
 * "ZG 1234 A").
 */
export function extractPlateCandidates(value: string): string[] {
  const text = compact(value);
  const candidates = new Set<string>();

  for (let start = 0; start < text.length; start += 1) {
    for (const cityLength of [2]) {
      for (const numberLength of [3, 4]) {
        for (const suffixLength of [1, 2]) {
          const length = cityLength + numberLength + suffixLength;
          const raw = text.slice(start, start + length);
          if (raw.length !== length) continue;
          const city = asLetters(raw.slice(0, cityLength));
          const number = asDigits(raw.slice(cityLength, cityLength + numberLength));
          const suffix = asLetters(raw.slice(cityLength + numberLength));
          if (CROATIAN_AREA_CODES.has(city) && /^\d{3,4}$/.test(number) && /^[A-Z]{1,2}$/.test(suffix)) {
            candidates.add(`${city}${number}${suffix}`);
          }
        }
      }
    }
  }
  const ordered = [...candidates].sort((left, right) => right.length - left.length);
  return ordered.filter((candidate, index) => !ordered.slice(0, index).some(longer => longer.startsWith(candidate)));
}
