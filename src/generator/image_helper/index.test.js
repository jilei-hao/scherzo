import { describe, it, expect } from 'vitest';
import { binarizeLabel, collectLabels, getTimePointImages, getUniqueLabels } from '.';

function makeImage({ size, data, components = 1 }) {
  const dimension = size.length;
  const direction = Array.from({ length: dimension * dimension }, (_, i) => i);
  return {
    imageType: { dimension, componentType: 'int16', pixelType: 'Scalar', components },
    size,
    spacing: Array.from({ length: dimension }, (_, i) => i + 1),
    origin: Array.from({ length: dimension }, (_, i) => 10 * (i + 1)),
    direction,
    data,
  };
}

describe('binarizeLabel', () => {
  const pixelTypes = [
    Uint8Array, Int8Array, Uint16Array, Int16Array,
    Uint32Array, Int32Array, Float32Array, Float64Array,
  ].map((PixelArray) => [PixelArray.name, PixelArray]);

  it.each(pixelTypes)('returns signed +1/-1 for %s input', (_name, PixelArray) => {
    const binary = binarizeLabel(new PixelArray([0, 3, 3, 0, 5]), 3);

    // unsigned input types used to store -1 as 255 (uint8), so no surface was found
    expect(binary).toBeInstanceOf(Int16Array);
    expect(Array.from(binary)).toEqual([-1, 1, 1, -1, -1]);
  });
});

describe('getUniqueLabels', () => {
  it('drops the background and sorts numerically', () => {
    expect(getUniqueLabels(new Uint16Array([0, 5, 2, 5, 0, 10]))).toEqual([2, 5, 10]);
  });

  it('returns no labels for an all-background image', () => {
    expect(getUniqueLabels(new Uint8Array(8))).toEqual([]);
  });
});

describe('getTimePointImages', () => {
  it('returns a 3D image as its only time point', () => {
    const image = makeImage({ size: [2, 2, 2], data: new Int16Array(8) });
    expect(getTimePointImages(image)).toEqual([image]);
  });

  it('splits a 4D image into 3D time points with 3D geometry', () => {
    const data = Int16Array.from({ length: 2 * 2 * 1 * 3 }, (_, i) => i);
    const tpImages = getTimePointImages(makeImage({ size: [2, 2, 1, 3], data }));

    expect(tpImages).toHaveLength(3);
    for (const tpImage of tpImages) {
      expect(tpImage.imageType.dimension).toBe(3);
      expect(tpImage.size).toEqual([2, 2, 1]);
      expect(tpImage.spacing).toEqual([1, 2, 3]);
      expect(tpImage.origin).toEqual([10, 20, 30]);
      // top-left 3x3 block of the row-major 4x4 matrix [0..15]
      expect(tpImage.direction).toEqual([0, 1, 2, 4, 5, 6, 8, 9, 10]);
    }
    expect(Array.from(tpImages[0].data)).toEqual([0, 1, 2, 3]);
    expect(Array.from(tpImages[2].data)).toEqual([8, 9, 10, 11]);
  });

  it('does not modify the input image', () => {
    const data = Int16Array.from({ length: 12 }, (_, i) => i);
    const image = makeImage({ size: [2, 2, 1, 3], data });
    const before = structuredClone(image);

    getTimePointImages(image);

    expect(image).toEqual(before);
  });

  it('rejects images that are not 3D or 4D', () => {
    expect(() => getTimePointImages(makeImage({ size: [4, 4], data: new Int16Array(16) })))
      .toThrow('Expected a 3D or 4D label image, got a 2D image.');
  });

  it('rejects multi-component images', () => {
    const image = makeImage({ size: [2, 2, 2], data: new Int16Array(24), components: 3 });
    expect(() => getTimePointImages(image)).toThrow('got 3 components');
  });
});

describe('collectLabels', () => {
  it('returns the union over time points and the labels present in each', () => {
    const tpImages = [
      { data: new Uint8Array([0, 1, 2]) },
      { data: new Uint8Array([0, 1, 1]) },
      { data: new Uint8Array([3, 1, 0]) },
    ];

    const { labels, labelsPerTimePoint } = collectLabels(tpImages);

    expect(labels).toEqual([1, 2, 3]);
    expect(labelsPerTimePoint.map((set) => Array.from(set))).toEqual([[1, 2], [1], [1, 3]]);
  });
});
