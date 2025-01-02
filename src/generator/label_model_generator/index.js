import { convertItkToVtkImage } from '@kitware/vtk.js/Common/DataModel/ITKHelper'
import vtkImageMarchingCubes from '@kitware/vtk.js/Filters/General/ImageMarchingCubes';

import { Image } from 'itk-wasm';

function GenerateLabelBinaryImage(itkImage, labelValue) {
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


  return mc.getOutputData();
}

export default async function GenerateLabelModel(itkImage, config) {
  // get unique labels in the file
  const pixelData = itkImage.data;
  const uniqueValues = Array.from(new Set(pixelData));

  uniqueValues.sort((a, b) => a - b);
  const index = uniqueValues.indexOf(0); // remove 0 (background) from the unique values
  if (index > -1) {
    uniqueValues.splice(index, 1);
  }

  console.log("[GenerateLabelModel] uniqueValues", uniqueValues);

  let models = {};

  // for each unique label, generate a label model
  for (let i = 0; i < uniqueValues.length; i++) {
    const labelValue = uniqueValues[i];

    const itkBinaryImage = GenerateLabelBinaryImage(itkImage, labelValue);
    const vtkBinaryImage = convertItkToVtkImage(itkBinaryImage);

    console.log("[GenerateLabelModel] vtkBinaryImage", vtkBinaryImage);

    // generate the label model and add to models with label as key
    models[labelValue] = await GenerateModelForOneLabel(vtkBinaryImage, config);
  }

  return models;
}