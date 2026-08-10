import { describe, expect, it } from 'vitest';
import { associatePlatesToTracks } from '../src/analysis/plateAssociation';
import type { EvidenceFrame, PlateObservation, VehicleTrack } from '../src/analysis/types';

const frames: EvidenceFrame[] = [{ id: 'f1', frameTimeMs: 100 }, { id: 'f2', frameTimeMs: 200 }];
const track: VehicleTrack = {
  id: 'track-1',
  detections: [{ label: 'vehicle', confidence: 0.9, frameTimeMs: 100, boundingBox: { x: 0.1, y: 0.1, width: 0.4, height: 0.4 } }],
  evidenceFrameIds: ['f1'],
  plateCandidates: [],
  identityCandidates: [],
};

describe('associatePlatesToTracks', () => {
  it('pridružuje tablicu samo vozilu koje je sadrži u istom kadru', () => {
    const observations: PlateObservation[] = [
      { frameId: 'f1', confidence: 0.9, text: 'ZG1234AB', boundingBox: { x: 0.2, y: 0.3, width: 0.1, height: 0.05 } },
      { frameId: 'f2', confidence: 0.8, text: 'ST5678C', boundingBox: { x: 0.2, y: 0.3, width: 0.1, height: 0.05 } },
    ];
    const result = associatePlatesToTracks([track], frames, observations);
    expect(result.tracks[0].plateCandidates.map(item => item.normalizedText)).toEqual(['ZG1234AB']);
    expect(result.unassigned.map(item => item.normalizedText)).toEqual(['ST5678C']);
  });

  it('ostavlja prostorno udaljeno opažanje nepridruženim', () => {
    const result = associatePlatesToTracks([track], frames, [
      { frameId: 'f1', confidence: 0.9, text: 'RI123AA', boundingBox: { x: 0.8, y: 0.8, width: 0.1, height: 0.05 } },
    ]);
    expect(result.tracks[0].plateCandidates).toEqual([]);
    expect(result.unassigned).toHaveLength(1);
  });
});
