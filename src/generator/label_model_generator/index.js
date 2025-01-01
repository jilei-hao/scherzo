import { convertItkToVtkImage } from '@kitware/vtk.js/Common/DataModel/ITKHelper'

import { Image } from 'itk-wasm';

function GenerateLabelBinaryImage(itkImage, labelValue) {
  const dimension = itkImage.imageType.dimension;
  const pixelType = itkImage.imageType.pixelType;
  const componentType = itkImage.imageType.componentType;
  const size = itkImage.size;
  const spacing = itkImage.spacing;
  const origin = itkImage.origin;
  const direction = itkImage.direction;


  const binaryImage = new Image(itkImage.imageType);
  binaryImage.size = size;
  binaryImage.spacing = spacing;
  binaryImage.origin = origin;
  binaryImage.direction = direction;
  binaryImage.data = new itkImage.data.constructor(itkImage.data.length);

  for (let i = 0; i < itkImage.data.length; i++) {
    binaryImage.data[i] = itkImage.data[i] == labelValue ? 1 : 0;
  }

  return binaryImage;
}

async function GenerateModelForOneLabel(binaryImage, config) {
  console.log("[GenerateModelForOneLabel] binaryImage", binaryImage);
  console.log("[GenerateModelForOneLabel] config", config);

  return;
}

export default async function GenerateLabelModel(itkImage, config) {
  console.log("[GenerateLabelModel] itkImage", itkImage);
  console.log("[GenerateLabelModel] config", config);

  // get unique labels in the file
  const pixelData = itkImage.data;
  const uniqueValues = Array.from(new Set(pixelData));

  uniqueValues.sort((a, b) => a - b);
  const index = uniqueValues.indexOf(0); // remove 0 (background) from the unique values
  if (index > -1) {
    uniqueValues.splice(index, 1);
  }

  console.log("[GenerateLabelModel] uniqueValues", uniqueValues);

  // for each unique label, generate a label model
  for (let i = 0; i < uniqueValues.length; i++) {
    const labelValue = uniqueValues[i];

    const itkBinaryImage = GenerateLabelBinaryImage(itkImage, labelValue);

    const vtkBinaryImage = convertItkToVtkImage(itkBinaryImage);

    console.log("[GenerateLabelModel] vtkBinaryImage", vtkBinaryImage);

    // generate the label model
    await GenerateModelForOneLabel(vtkBinaryImage, config);
  }

  return;
}