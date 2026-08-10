import { toByteArray } from 'base64-js';
import { decode } from 'jpeg-js';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync } from 'expo-image-manipulator';
import type { EvidenceFrame, VehicleTrack } from './types';

function largestDetectionWithEvidence(track: VehicleTrack, frames: EvidenceFrame[]) {
  const availableTimes = new Set(frames.filter(frame => frame.uri).map(frame => frame.frameTimeMs));
  return track.detections.filter(detection => availableTimes.has(detection.frameTimeMs)).sort((left, right) =>
    right.boundingBox.width * right.boundingBox.height - left.boundingBox.width * left.boundingBox.height,
  )[0];
}

/** Saves one local, reviewable crop for every vehicle track. */
export async function attachVehicleEvidenceCrops(tracks: VehicleTrack[], frames: EvidenceFrame[]): Promise<VehicleTrack[]> {
  const nextTracks = await Promise.all(tracks.map(async track => {
    const detection = largestDetectionWithEvidence(track, frames);
    const frame = detection && frames.find(item => item.frameTimeMs === detection.frameTimeMs && item.uri);
    if (!detection || !frame?.uri) return track;
    try {
      const base64 = await FileSystem.readAsStringAsync(frame.uri, { encoding: FileSystem.EncodingType.Base64 });
      const image = decode(toByteArray(base64), { useTArray: true });
      const paddingX = detection.boundingBox.width * 0.08;
      const paddingY = detection.boundingBox.height * 0.08;
      const originX = Math.max(0, Math.floor((detection.boundingBox.x - paddingX) * image.width));
      const originY = Math.max(0, Math.floor((detection.boundingBox.y - paddingY) * image.height));
      const right = Math.min(image.width, Math.ceil((detection.boundingBox.x + detection.boundingBox.width + paddingX) * image.width));
      const bottom = Math.min(image.height, Math.ceil((detection.boundingBox.y + detection.boundingBox.height + paddingY) * image.height));
      const crop = await manipulateAsync(frame.uri, [{ crop: { originX, originY, width: right - originX, height: bottom - originY } }], { compress: 0.95 });
      const destination = frame.uri.replace(/\.jpg$/i, `-vehicle-${track.id}.jpg`);
      await FileSystem.copyAsync({ from: crop.uri, to: destination });
      await FileSystem.deleteAsync(crop.uri, { idempotent: true }).catch(() => undefined);
      return { ...track, evidenceCropUri: destination, evidenceFrameTimeMs: detection.frameTimeMs };
    } catch {
      return track;
    }
  }));
  return nextTracks;
}
