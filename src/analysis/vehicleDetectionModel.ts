import { toByteArray } from 'base64-js';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'jpeg-js';
import type { TfliteModel } from 'react-native-fast-tflite';
import type { EvidenceFrame, VehicleDetection } from './types';
import { letterboxRgbaToRgb, parseEfficientDetOutputs } from './tfliteImage';

export const vehicleDetectionAvailable = true;
const MODEL_ASSET = require('../../assets/models/efficientdet-lite0-int8-v1.tflite');
let modelPromise: Promise<TfliteModel> | undefined;

async function loadModel() {
  modelPromise ??= import('react-native-fast-tflite').then(({ loadTensorflowModel }) =>
    loadTensorflowModel(MODEL_ASSET, []),
  );
  const model = await modelPromise;
  const input = model.inputs[0];
  if (!input || input.dataType !== 'uint8' || input.shape.join('x') !== '1x320x320x3') {
    throw new Error(`Neočekivani ulaz detektora: ${input?.dataType ?? 'nepoznat'} ${input?.shape.join('x') ?? ''}`.trim());
  }
  return model;
}

/** Runs the fixed, locally bundled EfficientDet-Lite0 model on extracted JPEG evidence frames. */
export async function detectVehiclesInFrames(frames: EvidenceFrame[]): Promise<VehicleDetection[]> {
  if (!frames.length) return [];
  const model = await loadModel();
  const detections: VehicleDetection[] = [];
  for (const frame of frames) {
    if (!frame.uri) continue;
    const base64 = await FileSystem.readAsStringAsync(frame.uri, { encoding: FileSystem.EncodingType.Base64 });
    const image = decode(toByteArray(base64), { useTArray: true });
    const { rgb, transform } = letterboxRgbaToRgb(image.data, image.width, image.height);
    const input = rgb.buffer.slice(rgb.byteOffset, rgb.byteOffset + rgb.byteLength) as ArrayBuffer;
    const outputs = await model.run([input]);
    detections.push(...parseEfficientDetOutputs(outputs, transform, frame.frameTimeMs));
  }
  return detections;
}
