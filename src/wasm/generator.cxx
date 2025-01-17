#include <iostream>
#include <vector>
#include <vtkNew.h>
#include <vtkMatrix3x3.h>
#include <vtkMarchingCubes.h>
#include <vtkImageGaussianSmooth.h>
#include <vtkStripper.h>
#include <vtkNIFTIImageReader.h>
#include <vtkTriangleFilter.h>
#include <vtkPoints.h>
#include <vtkCellArray.h>
#include <vtkIdList.h>

#include "generator.h"


// ============================================================================
// Helper functions

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
}

wasmModelGenerator::~wasmModelGenerator()
{
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


  vtkNew<vtkTriangleFilter> fltTriangle;
  fltTriangle->SetInputData(m_Model);
  fltTriangle->Update();
  m_Model = fltTriangle->GetOutput();

  std::cout << "Model: " << std::endl;
  m_Model->Print(std::cout);


  m_ImageData = imageData;
}


int wasmModelGenerator::generateModel()
{
  std::cout << "Generating model..." << std::endl;
  if (!m_ImageData) 
  {
    std::cerr << "No image data!" << std::endl;
    return 1;
  }

  if (!m_Model)
  {
    std::cerr << "No model data!" << std::endl;
    return 1;
  }

  std::cout << "Model: " << std::endl;
  m_Model->Print(std::cout);

  return 0;
}

std::vector<double> wasmModelGenerator::getPoints()
{
  std::vector<double> points;
  if (!m_Model)
  {
    std::cerr << "No model data!" << std::endl;
    return points;
  }

  vtkPoints* vtkPoints = m_Model->GetPoints();
  for (vtkIdType i = 0; i < vtkPoints->GetNumberOfPoints(); ++i)
  {
    double p[3];
    vtkPoints->GetPoint(i, p);
    points.push_back(p[0]);
    points.push_back(p[1]);
    points.push_back(p[2]);
  }

  return points;
}

std::vector<int> wasmModelGenerator::getCells()
{
  std::vector<int> cells;
  if (!m_Model)
  {
    std::cerr << "No model data!" << std::endl;
    return cells;
  }

  vtkCellArray* vtkCells = m_Model->GetPolys();
  vtkIdType npts;
  const vtkIdType *pts;
  for (vtkCells->InitTraversal(); vtkCells->GetNextCell(npts, pts); )
  {
    cells.push_back(npts);
    for (vtkIdType i = 0; i < npts; ++i)
    {
      cells.push_back(pts[i]);
    }
  }

  return cells;
}




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