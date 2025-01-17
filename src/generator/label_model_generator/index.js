import { convertItkToVtkImage } from '@kitware/vtk.js/Common/DataModel/ITKHelper'
import vtkImageMarchingCubes from '@kitware/vtk.js/Filters/General/ImageMarchingCubes';
import vtkWindowedSincPolyDataFilter from '@kitware/vtk.js/Filters/General/WindowedSincPolyDataFilter';
import { Image } from 'itk-wasm';
import createGeneratorModule from './Generator';
import vtk from '@kitware/vtk.js/vtk';

async function GenerateLabelBinaryImage(itkImage, labelValue) {
  const binaryImage = new Image(itkImage.imageType);
  binaryImage.size = itkImage.size;;
  binaryImage.spacing = itkImage.spacing;
  binaryImage.origin = itkImage.origin;
  binaryImage.direction = itkImage.direction;
  binaryImage.data = new itkImage.data.constructor(itkImage.data.length);

  for (let i = 0; i < itkImage.data.length; i++) {
    binaryImage.data[i] = itkImage.data[i] == labelValue ? 1 : 0;
  }

  return binaryImage;
}

async function GenerateModelForOneLabel(binaryImage, config) {
  const mc = vtkImageMarchingCubes.newInstance({ contourValue: 1.0 });
  mc.setInputData(binaryImage);

  const smoothFilter = vtkWindowedSincPolyDataFilter.newInstance({
    nonManifoldSmoothing: 1,
    numberOfIterations: 50,
    passBand: 0.01,
    featureEdgeSmoothing: 1,
    edgeAngle: 5,
    featureAngle: 10,
  });

  smoothFilter.setInputConnection(mc.getOutputPort());
  smoothFilter.update();
  

  return smoothFilter.getOutputData();
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

  let models = [];

  // for each unique label, generate a label model
  for (let i = 0; i < uniqueValues.length; i++) {
    const labelValue = uniqueValues[i];

    const itkBinaryImage = await GenerateLabelBinaryImage(itkImage, labelValue);
    const vtkBinaryImage = convertItkToVtkImage(itkBinaryImage);

    // generate the label model and add to models with label as key
    const labelModel = await GenerateModelForOneLabel(vtkBinaryImage, config);
    models.push({ label: labelValue, model: labelModel });
  }

  return models;
}

export default async function GenerateLabelModel(itkImage, config) {
  const tpImages = await getTimePointImages(itkImage);
  console.log("[GenerateLabelModel] tpImages", tpImages);

  const wasmModule = await createGeneratorModule();
  console.log("[GenerateLabelModel] wasmModule", wasmModule);

  const wasmModelGenerator = wasmModule.wasmModelGenerator;

  const generator = new wasmModelGenerator();

  const testTPImage = tpImages[0];

  const binaryImage = await GenerateLabelBinaryImage(testTPImage, 1);

  const dims = new wasmModule.Uint16Vector();
  for (let i = 0; i < 3; i++) {
    dims.push_back(binaryImage.size[i]);
  } 

  const spacing = new wasmModule.DoubleVector();
  for (let i = 0; i < 3; i++) {
    spacing.push_back(binaryImage.spacing[i]);
  }

  const origin = new wasmModule.DoubleVector();
  for (let i = 0; i < 3; i++) {
    origin.push_back(binaryImage.origin[i]);
  }

  const direction = new wasmModule.DoubleVector();
  for (let i = 0; i < 9; i++) {
    direction.push_back(binaryImage.direction[i]);
  }

  const data = new wasmModule.Uint16Vector();
  for (let i = 0; i < itkImage.data.length; i++) {
    data.push_back(binaryImage.data[i]);
  }


  generator.readImage(dims, spacing, origin, direction, data);
  generator.generateModel();

  // Get the points and cells
  const points = generator.getPoints();

  // Recreate vtkPolyData in JavaScript
  // const vtkPoints = vtk.Common.Core.vtkPoints.newInstance();
  // vtkPoints.setData(Float32Array.from(points), 3);

  const ptsArray = new Float32Array(points.size());
  for (let i = 0; i < points.size(); i++) {
    ptsArray[i] = points.get(i);
  }

  console.log("Points array:", ptsArray);

  const cells = generator.getCells();

  const cellArray = new Int32Array(cells.size());
  for (let i = 0; i < cells.size(); i++) {
    cellArray[i] = cells.get(i);
  }
  
  console.log("Cells array:", cellArray);

  const polydata = vtk({
    vtkClass: 'vtkPolyData',
    points: {
      vtkClass: 'vtkPoints',
      dataType: 'Float32Array',
      numberOfComponents: 3,
      values: ptsArray,
    },
    polys: {
      vtkClass: 'vtkCellArray',
      dataType: 'Uint16Array',
      values: cellArray,
    },
  });

  console.log("Recreated vtkPolyData:", polydata);
  

  const tpModels = [polydata];

  return tpModels;

  for (let i = 0; i < tpImages.length; i++) {
    const tpImage = tpImages[i];
    const tpModel = await GenerateLabelModelForOneTimePoint(tpImage, config);
    tpModels.push(tpModel);
  }

  return tpModels;
}