import { aggregatePlateCandidates } from './candidateAggregation';
import type { EvidenceFrame, PlateObservation, VehicleTrack } from './types';

type AssociationResult = { tracks: VehicleTrack[]; unassigned: ReturnType<typeof aggregatePlateCandidates> };

function containsPlateCenter(vehicle: { x: number; y: number; width: number; height: number }, plate: PlateObservation['boundingBox']) {
  const centerX = plate.x + plate.width / 2;
  const centerY = plate.y + plate.height / 2;
  const paddingX = vehicle.width * 0.1;
  const paddingY = vehicle.height * 0.1;
  return centerX >= vehicle.x - paddingX && centerX <= vehicle.x + vehicle.width + paddingX
    && centerY >= vehicle.y - paddingY && centerY <= vehicle.y + vehicle.height + paddingY;
}

/** Associates OCR only when its text rectangle belongs to a vehicle box in that exact frame. */
export function associatePlatesToTracks(tracks: VehicleTrack[], frames: EvidenceFrame[], observations: PlateObservation[]): AssociationResult {
  const timeByFrameId = new Map(frames.map(frame => [frame.id, frame.frameTimeMs]));
  const assigned = new Set<PlateObservation>();
  const nextTracks = tracks.map(track => {
    const matching = observations.filter(observation => {
      if (assigned.has(observation)) return false;
      const time = timeByFrameId.get(observation.frameId);
      const detection = track.detections.find(item => item.frameTimeMs === time);
      if (!detection || !containsPlateCenter(detection.boundingBox, observation.boundingBox)) return false;
      assigned.add(observation);
      return true;
    });
    return {
      ...track,
      plateCandidates: aggregatePlateCandidates(matching.map(item => ({ frameId: item.frameId, confidence: item.confidence, text: item.text }))),
    };
  });
  const unassigned = aggregatePlateCandidates(
    observations.filter(observation => !assigned.has(observation)).map(item => ({ frameId: item.frameId, confidence: item.confidence, text: item.text })),
  );
  return { tracks: nextTracks, unassigned };
}
