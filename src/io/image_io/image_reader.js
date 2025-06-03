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

import { readImage } from '@itk-wasm/image-io'

// following image reading code from the itk-viewer project
// https://github.com/InsightSoftwareConsortium/itk-viewer/blob/main/packages/element/examples/image-io-read-image.ts

function sanitizeFileName(name) {
  return name.replace(/\//g, '_');
}

function sanitizeFile(file) {
  return new File([file], sanitizeFileName(file.name));
}

export default async function readImageFromFile (files) {
  const cleanFiles = files.map(sanitizeFile);

  if (cleanFiles.length !== 1) {
    return;
  }
    
  if (cleanFiles.length === 1) {
    const { image } = await readImage(cleanFiles[0]);
    return image;
  }

  // const { outputImage } = await readImageDicomFileSeries({
  //   inputImages: cleanFiles,
  //   singleSortedSeries: false,
  // });

  return outputImage;
};