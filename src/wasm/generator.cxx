#include <iostream>
#include <vector>
#include <vtkImageData.h>
#include <vtkNew.h>
#include <vtkMatrix3x3.h>
#include <vtkMarchingCubes.h>
#include <vtkPolyData.h>
#include <vtkSmartPointer.h>
#include <vtkImageGaussianSmooth.h>
#include <vtkStripper.h>

#include "generator.h"


// ============================================================================
// Helper functions

using MeshPointer = vtkSmartPointer<vtkPolyData>;
using vtkImagePointer = vtkSmartPointer<vtkImageData>;

static MeshPointer GetMeshFromBinaryImage(vtkImagePointer bImage)
{
  std::cout << "-- getting mesh from binary image. " << std::endl;

  // VTKImagePointer vtkImg = GetVTKImage<LabelImage3DType>(bImage);
  // auto vtk2niiTransform = getVTKToNiftiTransform(bImage);

  vtkNew<vtkMarchingCubes> fltMC;
  fltMC->SetInputData(bImage);
  fltMC->SetValue(0, 1.0);
  fltMC->Update();

  return fltMC->GetOutput();
}


// ============================================================================
wasmModelGenerator::wasmModelGenerator()
{
  m_ImageData = vtkImageData::New();
}

wasmModelGenerator::~wasmModelGenerator()
{
  m_ImageData->Delete();
}

void wasmModelGenerator::readImage(const std::vector<uint16_t>& dims, 
    const std::vector<double>& spacing, const std::vector<double>& origin,
    const std::vector<double>& direction, const std::vector<uint16_t>& buffer)
{
  std::cout << "Reading image... dim = [" << dims[0] << ", " << dims[1] << ", " << dims[2] << "]" << std::endl;
  std::cout << "Spacing = [" << spacing[0] << ", " << spacing[1] << ", " << spacing[2] << "]" << std::endl;
  std::cout << "Origin = [" << origin[0] << ", " << origin[1] << ", " << origin[2] << "]" << std::endl;
  std::cout << "Direction1 = [" << direction[0] << ", " << direction[1] << ", " << direction[2] << "]" << std::endl;
  std::cout << "Direction2 = [" << direction[3] << ", " << direction[4] << ", " << direction[5] << "]" << std::endl;
  std::cout << "Direction3 = [" << direction[6] << ", " << direction[7] << ", " << direction[8] << "]" << std::endl;
  const int length = dims[0] * dims[1] * dims[2] * sizeof(uint16_t);
  std::cout << "Buffer length: " << length << std::endl;

  // create a new vtkImageData
  vtkNew<vtkImageData> imageData;
  imageData->SetDimensions(dims[0], dims[1], dims[2]);
  imageData->SetSpacing(spacing[0], spacing[1], spacing[2]);
  imageData->SetOrigin(origin[0], origin[1], origin[2]);

  vtkNew<vtkMatrix3x3> directionMatrix;
  directionMatrix->Identity();
  for (int i = 0; i < 3; ++i)
    for (int j = 0; j < 3; ++j)
    {
      directionMatrix->SetElement(i, j, direction[i*3+j]);
    }

  imageData->SetDirectionMatrix(directionMatrix);

  // Set scalar type and allocate scalars
  imageData->AllocateScalars(VTK_UNSIGNED_SHORT, 1); // Single-component uint16_t data
  uint16_t* imageDataPtr = static_cast<uint16_t*>(imageData->GetScalarPointer());
  const size_t numPixels = dims[0] * dims[1] * dims[2];

  // copy data from buffer to imagedata
  for (size_t i = 0; i < numPixels; ++i)
  {
    imageDataPtr[i] = buffer[i];
  }

  vtkNew<vtkImageGaussianSmooth> fltSmooth;
  fltSmooth->SetInputData(imageData);
  fltSmooth->SetStandardDeviations(0.8, 0.8, 0.8);
  fltSmooth->SetRadiusFactors(1.5, 1.5, 1.5);
  fltSmooth->Update();
  auto vtkImg_sm = fltSmooth->GetOutput();

  vtkNew<vtkMarchingCubes> fltMC;
  fltMC->SetInputData(vtkImg_sm);
  fltMC->SetValue(0, 1.0);
  fltMC->Update();
  m_Model = fltMC->GetOutput();
  std::cout << "Model: " << std::endl;
  m_Model->Print(std::cout);

  // m_ImageData = imageData;

  // std::cout << "vtkImageData: " << std::endl;
  // m_ImageData->Print(std::cout);
}



int wasmModelGenerator::generateModel()
{
  std::cout << "Generating model..." << std::endl;
  if (!m_ImageData) 
  {
    std::cerr << "No image data!" << std::endl;
    return 1;
  }

  // // Create a dummy vtkImageData for testing
  // vtkNew<vtkImageData> dummyImageData;
  // dummyImageData->SetDimensions(10, 10, 10);
  // dummyImageData->SetSpacing(1.0, 1.0, 1.0);
  // dummyImageData->SetOrigin(0.0, 0.0, 0.0);
  // dummyImageData->AllocateScalars(VTK_UNSIGNED_SHORT, 1);

  // uint16_t* dummyImageDataPtr = static_cast<uint16_t*>(dummyImageData->GetScalarPointer());
  // for (int i = 0; i < 10 * 10 * 10; ++i)
  // {
  //   dummyImageDataPtr[i] = (i % 2 == 0) ? 1 : 0; // Create a simple pattern
  // }

  // m_ImageData = dummyImageData;

  // std::cout << "vtkImageData: " << std::endl;
  // m_ImageData->Print(std::cout);
    

  

  // m_Model = fltMC->GetOutput();

  return 0;
}

#include <vtkNIFTIImageReader.h>

void wasmModelGenerator::readImageFromFile(std::string filename)
{
  std::cout << "Reading image from file: " << filename << std::endl;

  vtkNew<vtkNIFTIImageReader> reader;
  reader->SetFileName(filename.c_str());
  reader->Update();

  m_ImageData = reader->GetOutput();

}


// ============================================================================

int main (int argc, char** argv)
{
  std::cout << "Generator" << std::endl;

  // read file name from first argument
  const std::string fnImage = argv[1];


  wasmModelGenerator generator;
  generator.readImageFromFile(fnImage);

  generator.generateModel();


  return 0;
}