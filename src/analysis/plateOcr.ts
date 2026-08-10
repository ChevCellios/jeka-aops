import { recognizeText } from '@dariyd/react-native-text-recognition';
import { toByteArray } from 'base64-js';
import { decode } from 'jpeg-js';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync } from 'expo-image-manipulator';
import { createEnhancedOcrImage } from './imageEnhancement';
import { extractPlateCandidates } from './plateParsing';
import type { BoundingBox, EvidenceFrame, PlateObservation, VehicleDetection } from './types';

type OcrTarget = {
  uri: string;
  frame: EvidenceFrame;
  confidence: number;
  // Crop bounds expressed in source-image pixels. Undefined means full frame.
  crop?: { x: number; y: number; width: number; height: number; sourceWidth: number; sourceHeight: number };
};

const FULL_VEHICLE_OCR_WIDTH = 960;
const PLATE_ZONE_OCR_WIDTH = 1280;

async function readImageSize(uri: string) {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const image = decode(toByteArray(base64), { useTArray: true });
  return { width: image.width, height: image.height };
}

function paddedCrop(box: BoundingBox, sourceWidth: number, sourceHeight: number) {
  const paddingX = box.width * 0.08;
  const paddingY = box.height * 0.08;
  const x = Math.max(0, Math.floor((box.x - paddingX) * sourceWidth));
  const y = Math.max(0, Math.floor((box.y - paddingY) * sourceHeight));
  const right = Math.min(sourceWidth, Math.ceil((box.x + box.width + paddingX) * sourceWidth));
  const bottom = Math.min(sourceHeight, Math.ceil((box.y + box.height + paddingY) * sourceHeight));
  return { x, y, width: right - x, height: bottom - y, sourceWidth, sourceHeight };
}

function plateZoneCrop(box: BoundingBox, sourceWidth: number, sourceHeight: number) {
  const paddingX = box.width * 0.06;
  const paddingBottom = box.height * 0.06;
  const x = Math.max(0, Math.floor((box.x - paddingX) * sourceWidth));
  const y = Math.max(0, Math.floor((box.y + box.height * 0.36) * sourceHeight));
  const right = Math.min(sourceWidth, Math.ceil((box.x + box.width + paddingX) * sourceWidth));
  const bottom = Math.min(sourceHeight, Math.ceil((box.y + box.height + paddingBottom) * sourceHeight));
  return { x, y, width: right - x, height: bottom - y, sourceWidth, sourceHeight };
}

async function createTarget(frame: EvidenceFrame & { uri: string }, confidence: number, crop: NonNullable<OcrTarget['crop']>, targetWidth: number) {
  const actions: Parameters<typeof manipulateAsync>[1] = [
    { crop: { originX: crop.x, originY: crop.y, width: crop.width, height: crop.height } },
  ];
  // Upscaling cannot restore missing detail, but gives the on-device OCR
  // enough character pixels to segment a small plate more reliably.
  if (crop.width < targetWidth) actions.push({ resize: { width: targetWidth } });
  const result = await manipulateAsync(frame.uri, actions, { compress: 0.98 });
  return { uri: result.uri, frame, confidence, crop } satisfies OcrTarget;
}

function toFrameBox(box: BoundingBox, crop?: OcrTarget['crop']): BoundingBox {
  if (!crop) return box;
  return {
    x: crop.x / crop.sourceWidth + box.x * crop.width / crop.sourceWidth,
    y: crop.y / crop.sourceHeight + box.y * crop.height / crop.sourceHeight,
    width: box.width * crop.width / crop.sourceWidth,
    height: box.height * crop.height / crop.sourceHeight,
  };
}

async function createOcrTargets(frames: EvidenceFrame[], detections: VehicleDetection[]): Promise<OcrTarget[]> {
  const targets: OcrTarget[] = [];
  for (const frame of frames) {
    if (!frame.uri) continue;
    const vehicles = detections.filter(detection => detection.frameTimeMs === frame.frameTimeMs);
    if (!vehicles.length) {
      targets.push({ uri: frame.uri, frame, confidence: 1 });
      continue;
    }
    try {
      const { width, height } = await readImageSize(frame.uri);
      let createdCrop = false;
      for (const vehicle of vehicles) {
        const fullCrop = paddedCrop(vehicle.boundingBox, width, height);
        if (fullCrop.width < 32 || fullCrop.height < 24) continue;
        targets.push(await createTarget(frame as EvidenceFrame & { uri: string }, vehicle.confidence, fullCrop, FULL_VEHICLE_OCR_WIDTH));
        const plateCrop = plateZoneCrop(vehicle.boundingBox, width, height);
        if (plateCrop.width >= 32 && plateCrop.height >= 16) {
          targets.push(await createTarget(frame as EvidenceFrame & { uri: string }, vehicle.confidence, plateCrop, PLATE_ZONE_OCR_WIDTH));
        }
        createdCrop = true;
      }
      if (!createdCrop) targets.push({ uri: frame.uri, frame, confidence: 1 });
    } catch {
      // A crop is an optimisation only; retain a local full-frame OCR fallback.
      targets.push({ uri: frame.uri, frame, confidence: 1 });
    }
  }
  return targets;
}

/**
 * Runs on-device OCR on evidence frames.  OCR candidates keep the element's
 * rectangle, allowing later association only to a vehicle visible in that
 * exact frame.  Promotion still depends on repetition across distinct frames.
 */
export async function recognizePlateObservations(frames: EvidenceFrame[], detections: VehicleDetection[] = []): Promise<PlateObservation[]> {
  const observations: PlateObservation[] = [];
  const targets = await createOcrTargets(frames, detections);
  let recognizedElements = 0;
  const appendRecognizedText = async (target: OcrTarget, uri: string) => {
    const result = await recognizeText(uri, { languages: ['hr', 'en'], recognitionLevel: 'line' });
    if (!result.success) throw new Error(result.errorMessage ?? 'OCR nije uspio obraditi kadar.');
    const qualityProxy = Math.max(0.1, target.frame.overallScore ?? 0.1);
    for (const element of result.pages?.flatMap(page => page.elements) ?? []) {
      recognizedElements += 1;
      const ocrConfidence = typeof element.confidence === 'number' ? element.confidence : 0.5;
      const confidence = Math.max(0.1, Math.min(1, 0.6 * ocrConfidence + 0.25 * qualityProxy + 0.15 * target.confidence));
      for (const candidate of extractPlateCandidates(element.text)) {
        observations.push({ frameId: target.frame.id, confidence, text: candidate, boundingBox: toFrameBox(element.boundingBox, target.crop) });
      }
    }
  };
  try {
    for (const target of targets) {
      await appendRecognizedText(target, target.uri);
      let enhancedUri: string | undefined;
      if (target.crop) {
        try {
          enhancedUri = await createEnhancedOcrImage(target.uri);
          await appendRecognizedText(target, enhancedUri);
        } catch {
          // Enhancement is supplementary; the original OCR result remains valid.
        } finally {
          if (enhancedUri) await FileSystem.deleteAsync(enhancedUri, { idempotent: true }).catch(() => undefined);
        }
      }
    }
  } finally {
    // Every crop is temporary. Clean all of them even when OCR aborts halfway
    // through the target list; full evidence frames are retained by the report.
    await Promise.all(targets.filter(target => target.crop).map(target =>
      FileSystem.deleteAsync(target.uri, { idempotent: true }).catch(() => undefined),
    ));
  }
  console.log('[JEKA AOPS] OCR tablica', {
    targets: targets.length,
    recognizedElements,
    plateObservations: observations.length,
  });
  return observations;
}
