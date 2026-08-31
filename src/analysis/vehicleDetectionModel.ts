import type { EvidenceFrame, VehicleDetection } from './types';

export const vehicleDetectionAvailable = false;

/**
 * Public-source fallback.
 *
 * The previous repository snapshot bundled a TFLite binary whose exact source
 * and redistribution terms could not be proven. The binary and its loader are
 * intentionally excluded from the public distribution. Contributors can add a
 * detector through this stable function boundary after documenting the model's
 * source, license, checksum, input contract and output contract in docs/MODEL.md.
 */
export async function detectVehiclesInFrames(_frames: EvidenceFrame[]): Promise<VehicleDetection[]> {
  if (_frames.length) {
    throw new Error('Model detekcije vozila nije uključen u ovu javnu verziju aplikacije.');
  }
  return [];
}
