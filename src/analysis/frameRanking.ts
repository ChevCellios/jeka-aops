import { decode } from 'jpeg-js';
import { toByteArray } from 'base64-js';
import * as FileSystem from 'expo-file-system/legacy';
import type { EvidenceFrame, VehicleDetection } from './types';

const clamp = (value: number) => Math.max(0, Math.min(1, value));

function scorePixels(data: Uint8Array, width: number, height: number) {
  // Downsample so scoring remains bounded on a phone even for a 720p frame.
  const stride = Math.max(1, Math.floor(Math.min(width, height) / 160));
  const rows: number[][] = [];
  let sum = 0;
  let count = 0;

  for (let y = 0; y < height; y += stride) {
    const row: number[] = [];
    for (let x = 0; x < width; x += stride) {
      const offset = (y * width + x) * 4;
      const luminance = data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
      row.push(luminance);
      sum += luminance;
      count += 1;
    }
    rows.push(row);
  }

  const mean = sum / Math.max(1, count);
  let variance = 0;
  let laplacianVariance = 0;
  let laplacianCount = 0;
  for (let y = 0; y < rows.length; y += 1) {
    for (let x = 0; x < rows[y].length; x += 1) {
      const value = rows[y][x];
      variance += (value - mean) ** 2;
      if (y > 0 && y < rows.length - 1 && x > 0 && x < rows[y].length - 1) {
        const laplacian = 4 * value - rows[y - 1][x] - rows[y + 1][x] - rows[y][x - 1] - rows[y][x + 1];
        laplacianVariance += laplacian ** 2;
        laplacianCount += 1;
      }
    }
  }

  const contrast = clamp(Math.sqrt(variance / Math.max(1, count)) / 64);
  const exposure = clamp(1 - Math.abs(mean - 128) / 128);
  const visibilityScore = 0.7 * contrast + 0.3 * exposure;
  const sharpnessScore = clamp((laplacianVariance / Math.max(1, laplacianCount)) / 1_200);
  return { sharpnessScore, visibilityScore, overallScore: 0.65 * sharpnessScore + 0.35 * visibilityScore };
}

function cropVehiclePixels(data: Uint8Array, imageWidth: number, imageHeight: number, box: VehicleDetection['boundingBox']) {
  const left = Math.max(0, Math.floor(box.x * imageWidth));
  const top = Math.max(0, Math.floor(box.y * imageHeight));
  const right = Math.min(imageWidth, Math.ceil((box.x + box.width) * imageWidth));
  const bottom = Math.min(imageHeight, Math.ceil((box.y + box.height) * imageHeight));
  const width = right - left;
  const height = bottom - top;
  if (width < 16 || height < 16) return undefined;
  const output = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    output.set(data.subarray(((top + row) * imageWidth + left) * 4, ((top + row) * imageWidth + right) * 4), row * width * 4);
  }
  return { data: output, width, height };
}

async function scoreFrame(frame: EvidenceFrame): Promise<EvidenceFrame> {
  if (!frame.uri) return frame;
  try {
    const base64 = await FileSystem.readAsStringAsync(frame.uri, { encoding: FileSystem.EncodingType.Base64 });
    const image = decode(toByteArray(base64), { useTArray: true });
    return { ...frame, ...scorePixels(image.data, image.width, image.height) };
  } catch {
    return frame;
  }
}

/** Returns the highest-quality evidence candidates first; scoreless frames stay last. */
export async function rankEvidenceFrames(frames: EvidenceFrame[]): Promise<EvidenceFrame[]> {
  const scored = await Promise.all(frames.map(scoreFrame));
  return scored.sort((left, right) => (right.overallScore ?? -1) - (left.overallScore ?? -1));
}

/**
 * Scores only the detected vehicle region. This prevents a sharp road sign or
 * bright sky from outranking a frame where the vehicle itself is readable.
 */
export async function rankVehicleEvidenceFrames(frames: EvidenceFrame[], detections: VehicleDetection[]): Promise<EvidenceFrame[]> {
  const detectionsByTime = new Map<number, VehicleDetection[]>();
  for (const detection of detections) {
    detectionsByTime.set(detection.frameTimeMs, [...(detectionsByTime.get(detection.frameTimeMs) ?? []), detection]);
  }
  const scored = await Promise.all(frames.map(async frame => {
    if (!frame.uri) return frame;
    const frameDetections = detectionsByTime.get(frame.frameTimeMs) ?? [];
    if (!frameDetections.length) return frame;
    try {
      const base64 = await FileSystem.readAsStringAsync(frame.uri, { encoding: FileSystem.EncodingType.Base64 });
      const image = decode(toByteArray(base64), { useTArray: true });
      const best = frameDetections.flatMap(detection => {
        const crop = cropVehiclePixels(image.data, image.width, image.height, detection.boundingBox);
        if (!crop) return [];
        const quality = scorePixels(crop.data, crop.width, crop.height);
        const area = Math.min(1, detection.boundingBox.width * detection.boundingBox.height * 4);
        // Evidence must favour readable vehicle pixels, not merely a sharp
        // background. Size and detector confidence help reject tiny/partial
        // appearances while sharpness remains the strongest signal.
        return [{
          ...quality,
          overallScore:
            0.45 * quality.sharpnessScore
            + 0.15 * quality.visibilityScore
            + 0.25 * Math.sqrt(area)
            + 0.15 * detection.confidence,
        }];
      }).sort((left, right) => right.overallScore - left.overallScore)[0];
      return best ? { ...frame, ...best } : frame;
    } catch {
      return frame;
    }
  }));
  return scored.sort((left, right) => (right.overallScore ?? -1) - (left.overallScore ?? -1));
}
