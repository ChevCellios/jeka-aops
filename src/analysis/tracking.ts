import type { EvidenceFrame, VehicleDetection, VehicleTrack } from './types';

function intersectionOverUnion(a: VehicleDetection['boundingBox'], b: VehicleDetection['boundingBox']) {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  const union = a.width * a.height + b.width * b.height - intersection;
  return union > 0 ? intersection / union : 0;
}

function centerDistance(a: VehicleDetection['boundingBox'], b: VehicleDetection['boundingBox']) {
  const centerAX = a.x + a.width / 2;
  const centerAY = a.y + a.height / 2;
  const centerBX = b.x + b.width / 2;
  const centerBY = b.y + b.height / 2;
  return Math.hypot(centerAX - centerBX, centerAY - centerBY);
}

function canContinueTrack(previous: VehicleDetection, next: VehicleDetection) {
  const elapsedMs = next.frameTimeMs - previous.frameTimeMs;
  // Two detections from the same frame must belong to separate tracks.
  if (elapsedMs <= 0 || elapsedMs > 1_200) return false;
  const overlap = intersectionOverUnion(previous.boundingBox, next.boundingBox);
  if (overlap >= 0.08) return true;
  // Fast vehicles may not overlap sparse frames at all. Permit a movement of
  // up to two vehicle widths/heights, with a small absolute floor.
  const movementLimit = Math.max(0.12, 2 * Math.max(
    previous.boundingBox.width,
    previous.boundingBox.height,
    next.boundingBox.width,
    next.boundingBox.height,
  ));
  return centerDistance(previous.boundingBox, next.boundingBox) <= movementLimit;
}

/** Greedy local tracker tolerant of a fast vehicle moving between frames. */
export function trackVehicles(detections: VehicleDetection[], frames: EvidenceFrame[] = []): VehicleTrack[] {
  const tracks: VehicleTrack[] = [];
  for (const detection of [...detections].sort((a, b) => a.frameTimeMs - b.frameTimeMs)) {
    const match = tracks
      .filter(track => {
        const previous = track.detections.at(-1);
        return previous && canContinueTrack(previous, detection);
      })
      .sort((a, b) => {
        const previousA = a.detections.at(-1)!;
        const previousB = b.detections.at(-1)!;
        const scoreA = intersectionOverUnion(previousA.boundingBox, detection.boundingBox) - centerDistance(previousA.boundingBox, detection.boundingBox);
        const scoreB = intersectionOverUnion(previousB.boundingBox, detection.boundingBox) - centerDistance(previousB.boundingBox, detection.boundingBox);
        return scoreB - scoreA;
      })[0];
    if (match) {
      match.detections.push(detection);
    } else {
      tracks.push({ id: `track-${tracks.length + 1}`, detections: [detection], evidenceFrameIds: [], plateCandidates: [], identityCandidates: [] });
    }
  }
  return tracks.map(track => ({
    ...track,
    evidenceFrameIds: frames.filter(frame => track.detections.some(detection => detection.frameTimeMs === frame.frameTimeMs)).map(frame => frame.id),
  }));
}
