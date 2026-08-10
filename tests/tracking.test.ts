import { describe, expect, it } from 'vitest';
import { trackVehicles } from '../src/analysis/tracking';
import type { VehicleDetection } from '../src/analysis/types';

function detection(frameTimeMs: number, x: number): VehicleDetection {
  return { label: 'vehicle', confidence: 0.8, frameTimeMs, boundingBox: { x, y: 0.2, width: 0.2, height: 0.2 } };
}

describe('trackVehicles', () => {
  it('povezuje prostorno bliske detekcije kroz uzastopne kadrove', () => {
    const tracks = trackVehicles(
      [detection(400, 0.2), detection(0, 0.1), detection(800, 0.3)],
      [{ id: 'f0', frameTimeMs: 0 }, { id: 'f1', frameTimeMs: 400 }, { id: 'f2', frameTimeMs: 800 }],
    );
    expect(tracks).toHaveLength(1);
    expect(tracks[0].detections.map(item => item.frameTimeMs)).toEqual([0, 400, 800]);
    expect(tracks[0].evidenceFrameIds).toEqual(['f0', 'f1', 'f2']);
  });

  it('ne spaja dva vozila iz istog kadra ni detekcije s prevelikim vremenskim razmakom', () => {
    expect(trackVehicles([detection(0, 0.1), detection(0, 0.12)])).toHaveLength(2);
    expect(trackVehicles([detection(0, 0.1), detection(1_201, 0.1)])).toHaveLength(2);
  });
});
