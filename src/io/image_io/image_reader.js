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