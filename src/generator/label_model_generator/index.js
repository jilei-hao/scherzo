import { convertItkToVtkImage } from '@kitware/vtk.js/Common/DataModel/ITKHelper'
import vtkImageMarchingCubes from '@kitware/vtk.js/Filters/General/ImageMarchingCubes';
import vtkWindowedSincPolyDataFilter from '@kitware/vtk.js/Filters/General/WindowedSincPolyDataFilter';
import { Image } from 'itk-wasm';
import createGeneratorModule from './Generator';
import { allocateMemoryForArray } from '../wasm_helpers';
import vtk from '@kitware/vtk.js/vtk';

async function GenerateLabelBinaryImage(itkImage, labelValue) {
  const binaryImage = new Image(itkImage.imageType);
  binaryImage.size = itkImage.size;;
  binaryImage.spacing = itkImage.spacing;
  binaryImage.origin = itkImage.origin;
  binaryImage.direction = itkImage.direction;
  binaryImage.data = new itkImage.data.constructor(itkImage.data.length);

  for (let i = 0; i < itkImage.data.length; i++) {
    binaryImage.data[i] = itkImage.data[i] == labelValue ? 1 : -1;
  }

  return binaryImage;
}

async function GenerateModelForOneLabel(binaryImage, config) {
  const wasmModule = await createGeneratorModule();
  console.log("[GenerateLabelModel] wasmModule", wasmModule);

  const pGenerator = wasmModule._createModelGenerator();
  wasmModule._setPrintDebugInfo(pGenerator, false);
  wasmModule._setGaussianSigma(pGenerator, 0.8);
  wasmModule._setMeshSmoothingPassband(pGenerator, 0.01);
  wasmModule._setMeshDecimationTargetReduction(pGenerator, 0.7);


  // dimension array
  const dims = new Int16Array([binaryImage.size[0], binaryImage.size[1], binaryImage.size[2]]);
  const pDims = await allocateMemoryForArray(wasmModule, dims);

  // spacing
  const spacing = new Float64Array([binaryImage.spacing[0], binaryImage.spacing[1], binaryImage.spacing[2]]);
  const pSpacing = await allocateMemoryForArray(wasmModule, spacing);

  // origin
  const origin = new Float64Array([binaryImage.origin[0], binaryImage.origin[1], binaryImage.origin[2]]);
  const pOrigin = await allocateMemoryForArray(wasmModule, origin);

  // direction
  const direction = new Float64Array([binaryImage.direction[0], binaryImage.direction[1], binaryImage.direction[2],
    binaryImage.direction[3], binaryImage.direction[4], binaryImage.direction[5],
    binaryImage.direction[6], binaryImage.direction[7], binaryImage.direction[8]]);
  const pDirection = await allocateMemoryForArray(wasmModule, direction);


  // write the data to the allocated memory
  console.log("binaryImage.data", binaryImage.data);
  const dataArray = new Int16Array(binaryImage.data);
  const pBuffer = await allocateMemoryForArray(wasmModule, dataArray);
  wasmModule._setImage(pGenerator, pBuffer, dataArray.length, pDims, pSpacing, pOrigin, pDirection);
  wasmModule._generateModel(pGenerator);
  const pointArraySize = wasmModule._getPointArraySize(pGenerator);
  const cellArraySize = wasmModule._getCellArraySize(pGenerator);

  // console.log("nPoints", pointArraySize);
  // console.log("nCells", cellArraySize);

  // get the model
  const pPoints = wasmModule._getPoints(pGenerator);
  const points = new Float32Array(wasmModule.HEAPF32.buffer, pPoints, pointArraySize);
  const pCells = wasmModule._getCells(pGenerator);
  const cells = new Int32Array(wasmModule.HEAP32.buffer, pCells, cellArraySize);

  // copy the points and cells array
  const pointsCopy = new Float32Array(points);
  const cellsCopy = new Int32Array(cells);


  const polydata = vtk({
    vtkClass: 'vtkPolyData',
    points: {
      vtkClass: 'vtkPoints',
      dataType: 'Float32Array',
      numberOfComponents: 3,
      values: pointsCopy,
    },
    polys: {
      vtkClass: 'vtkCellArray',
      dataType: 'Int32Array',
      values: cellsCopy,
    },
  });

  wasmModule._free(pBuffer);
  wasmModule._free(pDims);
  wasmModule._free(pSpacing);
  wasmModule._free(pOrigin);
  wasmModule._free(pDirection);
  wasmModule._free(pPoints);
  wasmModule._free(pCells);

  wasmModule._free(pGenerator);


  return polydata;
}

async function createNewITKImageFrom4DImage(itkImage, tp) {
  let tpImageType = itkImage.imageType;
  tpImageType.dimension = 3;
  const tpImage = new Image(tpImageType);

  tpImage.size = itkImage.size.slice(0, 3);
  tpImage.direction = [
    itkImage.direction[0], itkImage.direction[1], itkImage.direction[2],
    itkImage.direction[4], itkImage.direction[5], itkImage.direction[6],
    itkImage.direction[8], itkImage.direction[9], itkImage.direction[10]
  ];
  tpImage.origin = itkImage.origin.slice(0, 3);
  tpImage.spacing = itkImage.spacing.slice(0, 3);

  // copy the data for the time point
  const numVoxelsPerTP = tpImage.size[0] * tpImage.size[1] * tpImage.size[2];
  tpImage.data = new itkImage.data.constructor(numVoxelsPerTP);
  const tpOffset = numVoxelsPerTP * tp;

  for (let i = 0; i < numVoxelsPerTP; i++) {
    tpImage.data[i] = itkImage.data[i + tpOffset];
  }

  return tpImage;

}

async function getTimePointImages(itkImage) {
  const tpImages = [];

  // if itkImage is 3D, return the image
  if (itkImage.size.length === 3) {
    console.log("[getTimePointImages] 3D Image Detected");
    tpImages.push(itkImage);
    return tpImages;
  }

  // if itkImage is 4D, return the images for each time point
  const numTimePoints = itkImage.size[3];
  console.log("[getTimePointImages] numTimePoints", numTimePoints);
  for (let i = 0; i < numTimePoints; i++) {
    const tpImage = await createNewITKImageFrom4DImage(itkImage, i);
    tpImages.push(tpImage);
  }

  return tpImages;
}

async function GenerateLabelModelForOneTimePoint(itkImage, config) {
  // get unique labels in the file
  const pixelData = itkImage.data;
  const uniqueValues = Array.from(new Set(pixelData));

  uniqueValues.sort((a, b) => a - b);
  const index = uniqueValues.indexOf(0); // remove 0 (background) from the unique values
  if (index > -1) {
    uniqueValues.splice(index, 1);
  }

  console.log("[GenerateLabelModel] uniqueValues", uniqueValues);

  let labelModels = [];

  // for each unique label, generate a label model
  for (let i = 0; i < uniqueValues.length; i++) {
    const labelValue = uniqueValues[i];

    const itkBinaryImage = await GenerateLabelBinaryImage(itkImage, labelValue);

    // generate the label model and add to models with label as key
    const labelModel = await GenerateModelForOneLabel(itkBinaryImage, config);
    itkBinaryImage.data = null;
    labelModels.push({ label: labelValue, model: labelModel });
  }

  return labelModels;
}

export default async function GenerateLabelModel(itkImage, config) {
  const tpImages = await getTimePointImages(itkImage);
  console.log("[GenerateLabelModel] tpImages", tpImages);

  const tpModels = [];

  // generate a label model for each time point
  for (let i = 0; i < tpImages.length; i++) {
    const tpImage = tpImages[i];
    const tpModel = await GenerateLabelModelForOneTimePoint(tpImage, config);
    tpModels.push(tpModel);
  }

  // clean up tpImages
  for (let i = 0; i < tpImages.length; i++) {
    tpImages[i].data = null;
  }

  return tpModels;
}