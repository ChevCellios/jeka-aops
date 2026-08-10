import { fromByteArray, toByteArray } from 'base64-js';
import { decode, encode } from 'jpeg-js';
import * as FileSystem from 'expo-file-system/legacy';

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

/**
 * Creates a local OCR-only variant of a vehicle crop. It uses grayscale,
 * contrast expansion and a mild unsharp mask; it never replaces the source.
 */
export async function createEnhancedOcrImage(uri: string): Promise<string> {
  const source = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const image = decode(toByteArray(source), { useTArray: true });
  const luminance = new Uint8Array(image.width * image.height);
  for (let index = 0; index < luminance.length; index += 1) {
    const offset = index * 4;
    luminance[index] = clampByte(image.data[offset] * 0.2126 + image.data[offset + 1] * 0.7152 + image.data[offset + 2] * 0.0722);
  }

  const output = new Uint8Array(image.data.length);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const index = y * image.width + x;
      const center = luminance[index];
      const left = luminance[y * image.width + Math.max(0, x - 1)];
      const right = luminance[y * image.width + Math.min(image.width - 1, x + 1)];
      const top = luminance[Math.max(0, y - 1) * image.width + x];
      const bottom = luminance[Math.min(image.height - 1, y + 1) * image.width + x];
      const sharpened = center + 0.35 * (4 * center - left - right - top - bottom);
      const value = clampByte(128 + (sharpened - 128) * 1.45);
      const offset = index * 4;
      output[offset] = value;
      output[offset + 1] = value;
      output[offset + 2] = value;
      output[offset + 3] = 255;
    }
  }

  const encoded = encode({ data: output, width: image.width, height: image.height }, 95);
  const enhancedUri = uri.replace(/\.jpg$/i, '-enhanced.jpg');
  await FileSystem.writeAsStringAsync(enhancedUri, fromByteArray(encoded.data), { encoding: FileSystem.EncodingType.Base64 });
  return enhancedUri;
}
