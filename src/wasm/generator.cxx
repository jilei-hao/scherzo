#include <iostream>
#include <vector>
#include <vtkNew.h>
#include <vtkMatrix3x3.h>
#include <vtkMatrix4x4.h>
#include <vtkMarchingCubes.h>
#include <vtkImageGaussianSmooth.h>
#include <vtkStripper.h>
#include <vtkNIFTIImageReader.h>
#include <vtkTriangleFilter.h>
#include <vtkPoints.h>
#include <vtkCellArray.h>
#include <vtkIdList.h>
#include <vtkWindowedSincPolyDataFilter.h>
#include <vtkQuadricDecimation.h>
#include <vtkCleanPolyData.h>
#include <vtkPolyDataNormals.h>
#include <vtkTransform.h>
#include <vtkTransformPolyDataFilter.h>

#include "generator.h"
#include "generate_mesh.hxx"


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



static vtkSmartPointer<vtkMatrix4x4> constructNiftiSform(
  vtkMatrix3x3* m_dir, double* v_origin, double* v_spacing)
{
  // Set the NIFTI/RAS transform
  vtkNew<vtkMatrix4x4> m_sform;
  vtkNew<vtkMatrix4x4> m_ras_matrix;
  vtkNew<vtkMatrix4x4> m_scale;
  vtkNew<vtkMatrix4x4> m_lps_to_ras;

  // Initialize matrices
  m_sform->Identity();
  m_ras_matrix->Identity();
  m_scale->Identity();
  m_lps_to_ras->Identity();

  // Compute the scale matrix
  for (int i = 0; i < 3; ++i)
  {
    m_scale->SetElement(i, i, v_spacing[i]);
  }

  // Compute the LPS to RAS matrix
  m_lps_to_ras->SetElement(0, 0, -1);
  m_lps_to_ras->SetElement(1, 1, -1);

  // Compute the RAS matrix
  vtkNew<vtkMatrix4x4> tempMatrix;
  vtkMatrix4x4::Multiply4x4(m_lps_to_ras, m_scale, tempMatrix);
  for (int i = 0; i < 3; ++i)
  {
    for (int j = 0; j < 3; ++j)
    {
      m_ras_matrix->SetElement(i, j, tempMatrix->GetElement(i, j) * m_dir->GetElement(i, j));
    }
  }

  // Compute the RAS offset vector
  double v_ras_offset[3];
  for (int i = 0; i < 3; ++i)
  {
    v_ras_offset[i] = 0;
    for (int j = 0; j < 3; ++j)
    {
      v_ras_offset[i] += m_lps_to_ras->GetElement(i, j) * v_origin[j];
    }
  }

  // Set the RAS matrix and offset in the sform matrix
  for (int i = 0; i < 3; ++i)
  {
    for (int j = 0; j < 3; ++j)
    {
      m_sform->SetElement(i, j, m_ras_matrix->GetElement(i, j));
    }
    m_sform->SetElement(i, 3, v_ras_offset[i]);
  }

  return m_sform;
}

static vtkSmartPointer<vtkTransform> getVTKToNiftiTransform(vtkImageData* image)
{
  vtkNew<vtkTransform> vtk2niiTransform;
  double *spacing = image->GetSpacing();
  double *origin = image->GetOrigin();
  vtkSmartPointer<vtkMatrix3x3> direction = image->GetDirectionMatrix();

  vtkSmartPointer<vtkMatrix4x4>vox2nii = constructNiftiSform(direction, origin, spacing);
  
  std::cout << "VOX to Nifti transform: " << std::endl;
  vox2nii->Print(std::cout);

  vtkNew<vtkMatrix4x4> vtk2vox;
  vtk2vox->Identity();
  for (int i = 0; i < 3; ++i)
  {
    vtk2vox->SetElement(i, i, 1.0 / spacing[i]);
    vtk2vox->SetElement(i, 3, -origin[i] / spacing[i]);
  }

  vtkNew<vtkMatrix4x4> vtk2nii;
  vtkMatrix4x4::Multiply4x4(vox2nii, vtk2vox, vtk2nii);

  vtk2niiTransform->SetMatrix(vtk2nii);
  vtk2niiTransform->Update();

  return vtk2niiTransform;
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
    const std::vector<double>& direction, int16_t* buffer, size_t bufferSize)
{
  if (m_PrintDebugInfo)
  {
    std::cout << "Reading image... dim = [" << dims[0] << ", " << dims[1] << ", " << dims[2] << "]" << std::endl;
    std::cout << "Spacing = [" << spacing[0] << ", " << spacing[1] << ", " << spacing[2] << "]" << std::endl;
    std::cout << "Origin = [" << origin[0] << ", " << origin[1] << ", " << origin[2] << "]" << std::endl;
    std::cout << "Direction1 = [" << direction[0] << ", " << direction[1] << ", " << direction[2] << "]" << std::endl;
    std::cout << "Direction2 = [" << direction[3] << ", " << direction[4] << ", " << direction[5] << "]" << std::endl;
    std::cout << "Direction3 = [" << direction[6] << ", " << direction[7] << ", " << direction[8] << "]" << std::endl;
  }

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
      directionMatrix->SetElement(i, j, direction[i * 3 + j]);
    }

  if (m_PrintDebugInfo)
  {
    std::cout << "Direction matrix: " << std::endl;
    directionMatrix->Print(std::cout);
  }

  imageData->SetDirectionMatrix(directionMatrix);

  // Set scalar type and allocate scalars
  imageData->AllocateScalars(VTK_DOUBLE, 1); // Single-component double data
  double *imageDataPtr = static_cast<double*>(imageData->GetScalarPointer());

  for (size_t i = 0; i < bufferSize; ++i)
  {
    imageDataPtr[i] = static_cast<double>(buffer[i]);
  }

  m_ImageData = imageData;
}


int wasmModelGenerator::generateModel()
{
  std::cout << "[wasmModelGenerator::generateModel] Generating..." << std::endl;
  if (!m_ImageData) 
  {
    std::cerr << "No image data!" << std::endl;
    return 1;
  }

  auto vtk2niiTransform = getVTKToNiftiTransform(m_ImageData);

  if (m_ApplyTransformForNifti)
  {
    std::cout << "[wasmModelGenerator::generateModel] Setting Direction for Nifti Transform" << std::endl;
  
    // for the transform to work, set the direction matrix to identity
    vtkNew<vtkMatrix3x3> directionMatrix;
    directionMatrix->Identity();
    m_ImageData->SetDirectionMatrix(directionMatrix);

    if (m_PrintDebugInfo)
    {
      std::cout << "Image: " << std::endl;
      m_ImageData->Print(std::cout);
      
    }
  }

  vtkNew<vtkImageGaussianSmooth> fltSmooth;
  fltSmooth->SetInputData(m_ImageData);
  fltSmooth->SetStandardDeviations(m_GaussianSigma, m_GaussianSigma, m_GaussianSigma);
  fltSmooth->SetRadiusFactors(1.5, 1.5, 1.5);

  vtkNew<vtkMarchingCubes> fltMC;
  fltMC->SetInputConnection(fltSmooth->GetOutputPort());
  fltMC->SetValue(0, 0);

  vtkNew<vtkTriangleFilter> fltTriangle;
  fltTriangle->SetInputConnection(fltMC->GetOutputPort());

  vtkNew<vtkPolyDataNormals> fltNormals;
  fltNormals->SetInputConnection(fltTriangle->GetOutputPort());
  fltNormals->ConsistencyOn();
  fltNormals->AutoOrientNormalsOn();
  fltNormals->FlipNormalsOn();

  vtkNew<vtkCleanPolyData> fltClean;
  fltClean->SetInputConnection(fltNormals->GetOutputPort());

  vtkNew<vtkWindowedSincPolyDataFilter> fltSmoothing;
  fltSmoothing->SetInputConnection(fltClean->GetOutputPort());
  fltSmoothing->SetNumberOfIterations(m_SmoothingIteration);
  fltSmoothing->BoundarySmoothingOff();
  fltSmoothing->FeatureEdgeSmoothingOff();
  fltSmoothing->SetFeatureAngle(120.0);
  fltSmoothing->SetPassBand(m_SmoothingPassband);
  fltSmoothing->NonManifoldSmoothingOn();
  fltSmoothing->NormalizeCoordinatesOn();

  vtkNew<vtkQuadricDecimation> fltDecimate;
  fltDecimate->SetInputConnection(fltSmoothing->GetOutputPort());
  fltDecimate->SetTargetReduction(m_DecimationTargetRate);


  vtkNew<vtkWindowedSincPolyDataFilter> fltSmoothing2;
  fltSmoothing2->SetInputConnection(fltDecimate->GetOutputPort());
  fltSmoothing2->SetNumberOfIterations(m_SmoothingIteration);
  fltSmoothing2->BoundarySmoothingOff();
  fltSmoothing2->FeatureEdgeSmoothingOff();
  fltSmoothing2->SetFeatureAngle(120.0);
  fltSmoothing2->SetPassBand(m_SmoothingPassband);
  fltSmoothing2->NonManifoldSmoothingOn();
  fltSmoothing2->NormalizeCoordinatesOn();

  fltSmoothing2->Update();


  m_Model = fltSmoothing2->GetOutput();
  
  if (m_ApplyTransformForNifti)
  {
    std::cout << "[wasmModelGenerator::generateModel] Applying transform for Nifti..." << std::endl;
    
    vtkNew<vtkTransformPolyDataFilter> fltTransform;
    fltTransform->SetTransform(vtk2niiTransform);
    fltTransform->SetInputData(m_Model);
    fltTransform->Update();
    m_Model = fltTransform->GetOutput();

    if (m_PrintDebugInfo)
    {
      std::cout << "Transform: " << std::endl;
      vtk2niiTransform->Print(std::cout);
    }
  }

  if (m_PrintDebugInfo)
  {
    std::cout << "Model: " << std::endl;
    m_Model->Print(std::cout);
  }

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
  std::cout << "[wasmModelGenerator::readImageFromFile] Reading: " << filename << std::endl;

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