import { describe, expect, it } from 'vitest';
import { letterboxRgbaToRgb, modelBoxToSourceBox, parseEfficientDetOutputs } from '../src/analysis/tfliteImage';

const buffer = (values: number[]) => new Float32Array(values).buffer;

describe('TFLite predobrada kadra', () => {
  it('zadržava omjer slike i dodaje rubove bez rastezanja', () => {
    const rgba = new Uint8Array(4 * 2 * 4).fill(255);
    const { rgb, transform } = letterboxRgbaToRgb(rgba, 4, 2, 8);
    expect(rgb).toHaveLength(8 * 8 * 3);
    expect(transform).toEqual({ inputSize: 8, scaledWidth: 8, scaledHeight: 4, padX: 0, padY: 2 });
    expect([...rgb.slice(0, 3)]).toEqual([114, 114, 114]);
    expect([...rgb.slice((2 * 8) * 3, (2 * 8) * 3 + 3)]).toEqual([255, 255, 255]);
  });

  it('vraća okvir iz letterbox koordinata u izvorni kadar', () => {
    const box = modelBoxToSourceBox([0.25, 0.25, 0.75, 0.75], {
      inputSize: 320,
      scaledWidth: 320,
      scaledHeight: 180,
      padX: 0,
      padY: 70,
    });
    expect(box?.x).toBeCloseTo(0.25);
    expect(box?.width).toBeCloseTo(0.5);
    expect(box?.y).toBeCloseTo(1 / 18);
    expect(box?.height).toBeCloseTo(8 / 9);
  });
});

describe('EfficientDet izlazi', () => {
  it('zadržava cestovna vozila i odbacuje druge COCO klase', () => {
    const outputs = [
      buffer([0.1, 0.2, 0.8, 0.7, 0.2, 0.2, 0.6, 0.6]),
      buffer([2, 0]), // car, person
      buffer([0.91, 0.99]),
      buffer([2]),
    ];
    const detections = parseEfficientDetOutputs(outputs, {
      inputSize: 320,
      scaledWidth: 320,
      scaledHeight: 320,
      padX: 0,
      padY: 0,
    }, 1_500);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({ label: 'vehicle', frameTimeMs: 1_500, confidence: expect.closeTo(0.91) });
    expect(detections[0].boundingBox).toMatchObject({ x: expect.closeTo(0.2), y: expect.closeTo(0.1) });
  });

  it('odbacuje slabe detekcije', () => {
    const detections = parseEfficientDetOutputs([
      buffer([0.1, 0.1, 0.8, 0.8]), buffer([2]), buffer([0.2]), buffer([1]),
    ], { inputSize: 320, scaledWidth: 320, scaledHeight: 320, padX: 0, padY: 0 }, 0);
    expect(detections).toEqual([]);
  });
});
