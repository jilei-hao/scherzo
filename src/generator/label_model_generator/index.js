import { convertItkToVtkImage } from '@kitware/vtk.js/Common/DataModel/ITKHelper'

async function GenerateModelForOneLabel (binaryImage, config) {
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

    const labelModel = {
      label: labelValue,
      model: null
    };

    // generate the label model
    // labelModel.model = generateLabelModel(itkImage, labelValue, config);

    console.log("[GenerateLabelModel] labelModel", labelModel);
  }


  const vtkImage = convertItkToVtkImage(itkImage);

  console.log("[GenerateLabelModel] vtkImage", vtkImage);



  return;
}