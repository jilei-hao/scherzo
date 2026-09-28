// This file is part of the Scherzo project.
// Copyright (C) 2025 Jilei Hao
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.


import createGeneratorModule from './Generator';
import { allocateMemoryForArray } from '../wasm_helpers';
import { binarizeLabel, collectLabels, getTimePointImages } from '../image_helper';
import vtk from '@kitware/vtk.js/vtk';

// Mesh pipeline parameters; each can be overridden through the `config` argument.
const DEFAULT_CONFIG = {
  gaussianSigma: 0.8,
  meshSmoothingIterations: 15,
  meshSmoothingPassband: 0.01,
  meshDecimationTargetReduction: 0.7,
};

// Returns the vtkPolyData for one label, or null when the label yields no
// surface (e.g. a few stray voxels that the Gaussian smoothing removes).
async function GenerateModelForOneLabel(geometryImage, binaryData, config) {
  const wasmModule = await createGeneratorModule();
  const pGenerator = wasmModule._createModelGenerator();
  const allocations = [];
  const allocate = async (array) => {
    const pArray = await allocateMemoryForArray(wasmModule, array);
    allocations.push(pArray);
    return pArray;
  };

  try {
    wasmModule._setPrintDebugInfo(pGenerator, false);
    wasmModule._setGaussianSigma(pGenerator, config.gaussianSigma);
    wasmModule._setMeshSmoothingIterations(pGenerator, config.meshSmoothingIterations);
    wasmModule._setMeshSmoothingPassband(pGenerator, config.meshSmoothingPassband);
    wasmModule._setMeshDecimationTargetReduction(pGenerator, config.meshDecimationTargetReduction);

    const { size, spacing, origin, direction } = geometryImage;
    const pDims = await allocate(new Uint16Array(size.slice(0, 3)));
    const pSpacing = await allocate(new Float64Array(spacing.slice(0, 3)));
    const pOrigin = await allocate(new Float64Array(origin.slice(0, 3)));
    const pDirection = await allocate(new Float64Array(direction.slice(0, 9)));
    const pBuffer = await allocate(binaryData);

    if (wasmModule._setImage(pGenerator, pBuffer, binaryData.length, pDims, pSpacing, pOrigin, pDirection) !== 0)
      throw new Error("The model generator rejected the image data.");
    if (wasmModule._generateModel(pGenerator) !== 0)
      throw new Error("The model generator failed.");

    // getPoints/getCells dereference the mesh without checking that it is empty
    const pointArraySize = wasmModule._getPointArraySize(pGenerator);
    if (pointArraySize === 0)
      return null;
    const cellArraySize = wasmModule._getCellArraySize(pGenerator);

    // copy each output right away: the next allocation can grow WASM memory,
    // which detaches every view created on the old buffer
    const pPoints = wasmModule._getPoints(pGenerator);
    allocations.push(pPoints);
    const pointsStart = pPoints / Float32Array.BYTES_PER_ELEMENT;
    const points = wasmModule.HEAPF32.slice(pointsStart, pointsStart + pointArraySize);

    const pCells = wasmModule._getCells(pGenerator);
    allocations.push(pCells);
    const cellsStart = pCells / Int32Array.BYTES_PER_ELEMENT;
    const cells = wasmModule.HEAP32.slice(cellsStart, cellsStart + cellArraySize);

    return vtk({
      vtkClass: 'vtkPolyData',
      points: {
        vtkClass: 'vtkPoints',
        dataType: 'Float32Array',
        numberOfComponents: 3,
        values: points,
      },
      polys: {
        vtkClass: 'vtkCellArray',
        dataType: 'Int32Array',
        values: cells,
      },
    });
  } finally {
    allocations.forEach((pArray) => wasmModule._free(pArray));
    wasmModule._destroyModelGenerator(pGenerator);
  }
}

// Generates one surface per label per time point: tpModels[tp] = [{ label, model }].
// Every time point lists every label found anywhere in the series, in the same
// order, so the viewer can keep one actor per label. `model` is null where the
// label is absent or yields no surface.
export default async function GenerateLabelModel(itkImage, config = {}) {
  const params = { ...DEFAULT_CONFIG, ...config };
  const tpImages = getTimePointImages(itkImage);
  const { labels, labelsPerTimePoint } = collectLabels(tpImages);
  console.log("[GenerateLabelModel] time points:", tpImages.length, "labels:", labels);

  if (labels.length === 0)
    throw new Error("The image contains no labels (every voxel is 0).");

  const tpModels = [];
  for (let tp = 0; tp < tpImages.length; tp++) {
    const tpImage = tpImages[tp];
    const labelModels = [];

    for (const label of labels) {
      const model = labelsPerTimePoint[tp].has(label)
        ? await GenerateModelForOneLabel(tpImage, binarizeLabel(tpImage.data, label), params)
        : null;
      labelModels.push({ label, model });
    }

    tpModels.push(labelModels);
  }

  return tpModels;
}
