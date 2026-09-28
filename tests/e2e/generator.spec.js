import { test, expect } from './fixtures.js';
import { makeLabelData } from './label_images.js';

const N = 32;

const identity = (dimension) =>
  Array.from({ length: dimension * dimension }, (_, i) => (i % (dimension + 1) === 0 ? 1 : 0));

// Runs GenerateLabelModel in the browser on a synthetic image and summarizes each
// model by point count and bounding-box center (null where there is no model).
async function generate(page, image) {
  await page.goto('./');
  return page.evaluate(async (image) => {
    const { GenerateLabelModel } = await import('/scherzo/src/generator/index.js');
    const PixelArrays = {
      uint8: Uint8Array, int8: Int8Array, uint16: Uint16Array, int16: Int16Array, float32: Float32Array,
    };
    const itkImage = {
      imageType: {
        dimension: image.size.length, componentType: image.pixelType, pixelType: 'Scalar', components: 1,
      },
      size: image.size,
      spacing: image.spacing,
      origin: image.origin,
      direction: new Float64Array(image.direction),
      data: PixelArrays[image.pixelType].from(image.data),
    };
    const dataBefore = itkImage.data.slice();

    const tpModels = await GenerateLabelModel(itkImage, {});

    const center = (b) => [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2, (b[4] + b[5]) / 2];
    return {
      models: tpModels.map((labelModels) => labelModels.map(({ label, model }) => ({
        label,
        numPoints: model ? model.getNumberOfPoints() : null,
        center: model ? center(model.getBounds()) : null,
      }))),
      inputDimension: itkImage.imageType.dimension,
      inputDataUnchanged: itkImage.data !== null && itkImage.data.every((v, i) => v === dataBefore[i]),
    };
  }, image);
}

const image3D = (pixelType, data) => ({
  pixelType, data, size: [N, N, N], spacing: [1, 1, 1], origin: [0, 0, 0], direction: identity(3),
});

// label 1 at time points 1-2, label 2 at time points 2-3
const image4D = () => ({
  pixelType: 'int16',
  data: makeLabelData(N, 3, (tp) => [[1], [1, 2], [2]][tp]),
  size: [N, N, N, 3],
  spacing: [1, 1, 1, 1],
  origin: [0, 0, 0, 0],
  direction: identity(4),
});

for (const pixelType of ['uint8', 'int8', 'uint16', 'int16', 'float32']) {
  test(`creates a surface for every label of a ${pixelType} label map`, async ({ page }) => {
    const { models } = await generate(page, image3D(pixelType, makeLabelData(N)));

    expect(models).toHaveLength(1);
    expect(models[0].map((m) => m.label)).toEqual([1, 2]);
    for (const model of models[0])
      expect(model.numPoints).toBeGreaterThan(0);
  });
}

test('returns no model for a label too small to form a surface', async ({ page }) => {
  const data = makeLabelData(N);
  data[2 + N * (2 + N * 2)] = 3; // one stray voxel, removed by the Gaussian smoothing

  const { models } = await generate(page, image3D('int16', data));

  expect(models[0].map((m) => m.label)).toEqual([1, 2, 3]);
  expect(models[0][0].numPoints).toBeGreaterThan(0);
  expect(models[0][1].numPoints).toBeGreaterThan(0);
  expect(models[0][2].numPoints).toBeNull();
});

test('lists every label at every time point of a 4D series', async ({ page }) => {
  const result = await generate(page, image4D());

  const present = result.models.map((labelModels) =>
    labelModels.map((m) => [m.label, m.numPoints > 0]));
  expect(present).toEqual([
    [[1, true], [2, false]],
    [[1, true], [2, true]],
    [[1, false], [2, true]],
  ]);
});

test('leaves the input image unchanged', async ({ page }) => {
  const result3D = await generate(page, image3D('int16', makeLabelData(N)));
  expect(result3D.inputDataUnchanged).toBe(true);

  const result4D = await generate(page, image4D());
  expect(result4D.inputDimension).toBe(4);
  expect(result4D.inputDataUnchanged).toBe(true);
});

test('places meshes in ITK (LPS) physical space', async ({ page }) => {
  // NIfTI files typically load with this direction (RAS on disk, LPS in ITK)
  const { models } = await generate(page, {
    ...image3D('int16', makeLabelData(N)),
    spacing: [2, 1, 1],
    origin: [100, 50, 0],
    direction: [-1, 0, 0, 0, -1, 0, 0, 0, 1],
  });

  // label 1 is a sphere centered on voxel (8, 16, 16)
  const [x, y, z] = models[0][0].center;
  expect(x).toBeCloseTo(100 - 2 * 8, 0);
  expect(y).toBeCloseTo(50 - 16, 0);
  expect(z).toBeCloseTo(16, 0);
});
