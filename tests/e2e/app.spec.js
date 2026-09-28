import { test, expect } from './fixtures.js';
import { makeLabelData, makeNifti } from './label_images.js';

const N = 24;

async function chooseFile(page, buffer) {
  await page.locator('input[type=file]').setInputFiles({
    name: 'labels.nii', mimeType: 'application/octet-stream', buffer,
  });
}

test('keeps Generate disabled until a file is chosen', async ({ page }) => {
  await page.goto('./');
  const generate = page.getByRole('button', { name: 'Generate Model' });

  await expect(generate).toBeDisabled();
  await chooseFile(page, makeNifti({ n: N, pixelType: 'uint8', data: makeLabelData(N) }));
  await expect(generate).toBeEnabled();
});

test('opens the viewer for a uint8 NIfTI label map', async ({ page, pageErrors }) => {
  await page.goto('./');
  await chooseFile(page, makeNifti({ n: N, pixelType: 'uint8', data: makeLabelData(N) }));
  await page.getByRole('button', { name: 'Generate Model' }).click();

  await expect(page.locator('canvas')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('steps through a 4D series whose labels change over time', async ({ page, pageErrors }) => {
  const labelsAt = (tp) => [[1], [1, 2], [2]][tp];
  const data = makeLabelData(N, 3, labelsAt);

  await page.goto('./');
  await chooseFile(page, makeNifti({ n: N, numTimePoints: 3, pixelType: 'int16', data }));
  await page.getByRole('button', { name: 'Generate Model' }).click();
  await expect(page.locator('canvas')).toBeVisible();

  // label 2 first appears at time point 2; indexing actors by position used to throw here
  const slider = page.locator('input[type=range]');
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');

  await expect(slider).toHaveValue('3');
  expect(pageErrors).toEqual([]);
});

test('reports an image without labels and allows a retry', async ({ page }) => {
  await page.goto('./');
  await chooseFile(page, makeNifti({ n: N, pixelType: 'uint8', data: new Array(N * N * N).fill(0) }));
  const generate = page.getByRole('button', { name: 'Generate Model' });
  await generate.click();

  await expect(page.getByRole('alert')).toContainText('no labels');
  await expect(generate).toBeEnabled();
});
