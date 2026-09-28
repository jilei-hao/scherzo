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

// Pure helpers for splitting and binarizing label images. They have no WASM or
// DOM dependencies so they can be unit tested in Node.

import { Image } from 'itk-wasm';

// Returns 1 inside the label and -1 outside as an Int16Array, whatever the input
// pixel type. The generator extracts the 0 iso-surface, so the output must be
// signed: in the input's own type a Uint8Array would store -1 as 255 and no
// surface would be found.
export function binarizeLabel(labelData, labelValue) {
  const binary = new Int16Array(labelData.length);
  for (let i = 0; i < labelData.length; i++) {
    binary[i] = labelData[i] === labelValue ? 1 : -1;
  }
  return binary;
}

// Sorted non-zero values present in the label data (0 is background).
export function getUniqueLabels(labelData) {
  const labels = Array.from(new Set(labelData)).filter((value) => value !== 0);
  return labels.sort((a, b) => a - b);
}

function extractTimePoint(itkImage, tp) {
  const tpImage = new Image({ ...itkImage.imageType, dimension: 3 });

  tpImage.size = itkImage.size.slice(0, 3);
  // top-left 3x3 block of the 4x4 direction matrix
  const d = itkImage.direction;
  tpImage.direction = [d[0], d[1], d[2], d[4], d[5], d[6], d[8], d[9], d[10]];
  tpImage.origin = itkImage.origin.slice(0, 3);
  tpImage.spacing = itkImage.spacing.slice(0, 3);

  const numVoxelsPerTP = tpImage.size[0] * tpImage.size[1] * tpImage.size[2];
  const tpOffset = numVoxelsPerTP * tp;
  tpImage.data = itkImage.data.slice(tpOffset, tpOffset + numVoxelsPerTP);

  return tpImage;
}

// Splits a 4D image into one 3D image per time point; a 3D image is returned as
// the only time point. The input image is not modified.
export function getTimePointImages(itkImage) {
  const dimension = itkImage.size.length;
  if (dimension !== 3 && dimension !== 4) {
    throw new Error(`Expected a 3D or 4D label image, got a ${dimension}D image.`);
  }
  if (itkImage.imageType.components !== 1) {
    throw new Error(
      `Expected a single-component label image, got ${itkImage.imageType.components} components.`);
  }

  if (dimension === 3) {
    return [itkImage];
  }

  const tpImages = [];
  for (let tp = 0; tp < itkImage.size[3]; tp++) {
    tpImages.push(extractTimePoint(itkImage, tp));
  }
  return tpImages;
}

// Labels present in each time point, and their sorted union over the series.
export function collectLabels(tpImages) {
  const labelsPerTimePoint = tpImages.map((tpImage) => new Set(getUniqueLabels(tpImage.data)));

  const allLabels = new Set();
  labelsPerTimePoint.forEach((labels) => labels.forEach((label) => allLabels.add(label)));

  return {
    labels: Array.from(allLabels).sort((a, b) => a - b),
    labelsPerTimePoint,
  };
}
