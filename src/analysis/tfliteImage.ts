import type { BoundingBox, VehicleDetection } from './types';

export const DETECTOR_INPUT_SIZE = 320;
export const VEHICLE_CLASS_IDS = new Set([1, 2, 3, 5, 7]);

export type LetterboxTransform = {
  inputSize: number;
  scaledWidth: number;
  scaledHeight: number;
  padX: number;
  padY: number;
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Converts decoded RGBA pixels to a square RGB tensor without stretching the scene. */
export function letterboxRgbaToRgb(
  rgba: Uint8Array,
  width: number,
  height: number,
  inputSize = DETECTOR_INPUT_SIZE,
) {
  if (width <= 0 || height <= 0 || rgba.length < width * height * 4) {
    throw new Error('Kadar nema valjane dimenzije za detekciju.');
  }
  const scale = Math.min(inputSize / width, inputSize / height);
  const scaledWidth = Math.max(1, Math.round(width * scale));
  const scaledHeight = Math.max(1, Math.round(height * scale));
  const padX = Math.floor((inputSize - scaledWidth) / 2);
  const padY = Math.floor((inputSize - scaledHeight) / 2);
  const rgb = new Uint8Array(inputSize * inputSize * 3);
  rgb.fill(114);

  for (let targetY = 0; targetY < scaledHeight; targetY += 1) {
    const sourceY = Math.min(height - 1, Math.floor((targetY + 0.5) / scale));
    for (let targetX = 0; targetX < scaledWidth; targetX += 1) {
      const sourceX = Math.min(width - 1, Math.floor((targetX + 0.5) / scale));
      const sourceOffset = (sourceY * width + sourceX) * 4;
      const targetOffset = ((targetY + padY) * inputSize + targetX + padX) * 3;
      rgb[targetOffset] = rgba[sourceOffset];
      rgb[targetOffset + 1] = rgba[sourceOffset + 1];
      rgb[targetOffset + 2] = rgba[sourceOffset + 2];
    }
  }
  return { rgb, transform: { inputSize, scaledWidth, scaledHeight, padX, padY } satisfies LetterboxTransform };
}

/** Maps a model [top,left,bottom,right] box back to normalized source-frame coordinates. */
export function modelBoxToSourceBox(box: ArrayLike<number>, transform: LetterboxTransform): BoundingBox | undefined {
  if (box.length < 4) return undefined;
  const [top, left, bottom, right] = [Number(box[0]), Number(box[1]), Number(box[2]), Number(box[3])];
  if (![top, left, bottom, right].every(Number.isFinite)) return undefined;
  const x1 = clamp((left * transform.inputSize - transform.padX) / transform.scaledWidth);
  const y1 = clamp((top * transform.inputSize - transform.padY) / transform.scaledHeight);
  const x2 = clamp((right * transform.inputSize - transform.padX) / transform.scaledWidth);
  const y2 = clamp((bottom * transform.inputSize - transform.padY) / transform.scaledHeight);
  const width = x2 - x1;
  const height = y2 - y1;
  if (width < 0.015 || height < 0.015 || width * height < 0.0008) return undefined;
  return { x: x1, y: y1, width, height };
}

export function parseEfficientDetOutputs(
  outputs: ArrayBuffer[],
  transform: LetterboxTransform,
  frameTimeMs: number,
  threshold = 0.32,
): VehicleDetection[] {
  if (outputs.length < 4) throw new Error(`Model je vratio ${outputs.length} izlaza umjesto očekivana 4.`);
  const boxes = new Float32Array(outputs[0]);
  const classes = new Float32Array(outputs[1]);
  const scores = new Float32Array(outputs[2]);
  const detectedCount = new Float32Array(outputs[3]);
  const count = Math.min(
    Math.max(0, Math.round(detectedCount[0] ?? 0)),
    classes.length,
    scores.length,
    Math.floor(boxes.length / 4),
  );
  const detections: VehicleDetection[] = [];
  for (let index = 0; index < count; index += 1) {
    const confidence = scores[index];
    const classId = Math.round(classes[index]);
    if (!Number.isFinite(confidence) || confidence < threshold || !VEHICLE_CLASS_IDS.has(classId)) continue;
    const boundingBox = modelBoxToSourceBox(boxes.subarray(index * 4, index * 4 + 4), transform);
    if (!boundingBox) continue;
    detections.push({ label: 'vehicle', confidence, frameTimeMs, boundingBox });
  }
  return detections;
}
