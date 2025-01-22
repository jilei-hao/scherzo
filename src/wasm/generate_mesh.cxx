#include <stdint.h>
#include <cstddef> 
#include <iostream>
#include <emscripten.h>


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
#include <vtkImageData.h>
#include <vtkPolyData.h>
#include <vtkSmartPointer.h>


class ModelGenerator
{
public:
  ModelGenerator() {}
  ~ModelGenerator() {}


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

  int setImage(int16_t *buffer, size_t bufferSize, uint16_t *dim3,
    double *spacing3, double *origin3, double *direction9) 
  {
    std::cout << "Setting image data..., length: " << bufferSize << std::endl;

    if (!buffer || !dim3 || !spacing3 || !origin3 || !direction9) {
      std::cerr << "Invalid input data!" << std::endl;
      return 1;
    }

    const size_t numPixel = dim3[0] * dim3[1] * dim3[2];
    if (bufferSize != numPixel) {
      std::cerr << "Buffer size and # of pixels are different!" << std::endl;
      return 1;
    }

    // set metadata
    vtkNew<vtkImageData> imageData;
    imageData->SetDimensions(dim3[0], dim3[1], dim3[2]);
    imageData->SetSpacing(spacing3[0], spacing3[1], spacing3[2]);
    imageData->SetOrigin(origin3[0], origin3[1], origin3[2]);
    vtkNew<vtkMatrix3x3> directionMatrix;
    directionMatrix->Identity();
    for (int i = 0; i < 3; ++i)
      for (int j = 0; j < 3; ++j)
      {
        directionMatrix->SetElement(i, j, direction9[i * 3 + j]);
      }

    imageData->SetDirectionMatrix(directionMatrix);

    // allocate voxel data
    imageData->AllocateScalars(VTK_FLOAT, 1); // Single-component float data
    float *imageDataPtr = static_cast<float*>(imageData->GetScalarPointer());

    for (size_t i = 0; i < bufferSize; ++i) {
      imageDataPtr[i] = static_cast<float>(buffer[i]);
    }

    m_ImageData = imageData;

    if (m_PrintDebugInfo)
      m_ImageData->Print(std::cout);

    return 0;
  }

  int generateModel()
  {
    std::cout << "[ModelGenerator::generateModel] Generating..." << std::endl;
    if (!m_ImageData) 
    {
      std::cerr << "No image data!" << std::endl;
      return 1;
    }

    auto vtk2niiTransform = getVTKToNiftiTransform(m_ImageData);

    if (m_ApplyTransformForNifti)
    {
      std::cout << "[ModelGenerator::generateModel] Setting Direction for Nifti Transform" << std::endl;
    
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
    fltSmooth->SetStandardDeviations(m_ImageSmoothingSigmaInVox, m_ImageSmoothingSigmaInVox, m_ImageSmoothingSigmaInVox);
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
    fltSmoothing->SetNumberOfIterations(m_TaubinSmoothingIterations);
    fltSmoothing->BoundarySmoothingOff();
    fltSmoothing->FeatureEdgeSmoothingOff();
    fltSmoothing->SetFeatureAngle(m_TaubinSmoothingFeatureAngle);
    fltSmoothing->SetPassBand(m_TaubinSmoothingPassband);
    fltSmoothing->NonManifoldSmoothingOn();
    fltSmoothing->NormalizeCoordinatesOn();

    vtkNew<vtkQuadricDecimation> fltDecimate;
    fltDecimate->SetInputConnection(fltSmoothing->GetOutputPort());
    fltDecimate->SetTargetReduction(m_DecimationTargetReduction);


    vtkNew<vtkWindowedSincPolyDataFilter> fltSmoothing2;
    fltSmoothing2->SetInputConnection(fltDecimate->GetOutputPort());
    fltSmoothing2->SetNumberOfIterations(m_TaubinSmoothingIterations);
    fltSmoothing2->BoundarySmoothingOff();
    fltSmoothing2->FeatureEdgeSmoothingOff();
    fltSmoothing2->SetFeatureAngle(m_TaubinSmoothingFeatureAngle);
    fltSmoothing2->SetPassBand(m_TaubinSmoothingPassband);
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


  size_t getNumberOfPoints()
  {
    if (!m_Model)
    {
      std::cerr << "[ModelGenerator::getNumberOfPoints] No model data!" << std::endl;
      return 0;
    }

    return m_Model->GetPoints()->GetNumberOfPoints();
  }
  size_t getPoints(double *points)
  {
    if (!m_Model)
    {
      std::cerr << "[ModelGenerator::getPoints] No model data!" << std::endl;
      return nullptr;
    }

    vtkPoints* vtkPoints = m_Model->GetPoints();
    size_t numPoints = vtkPoints->GetNumberOfPoints();
    points = new double[numPoints * 3];

    for (vtkIdType i = 0; i < vtkPoints->GetNumberOfPoints(); ++i)
    {
      double p[3];
      vtkPoints->GetPoint(i, p);
      points[i * 3] = p[0];
      points[i * 3 + 1] = p[1];
      points[i * 3 + 2] = p[2];
    }

    return numPoints;
  }

  void SetImageSmoothingSigmaInVox(double sigma) { m_ImageSmoothingSigmaInVox = sigma; }
  void SetTaubinSmoothingIterations(uint32_t iterations) { m_TaubinSmoothingIterations = iterations; }
  void SetTaubinSmoothingPassband(double passband) { m_TaubinSmoothingPassband = passband; }
  void SetTaubinSmoothingFeatureAngle(double angle) { m_TaubinSmoothingFeatureAngle = angle; }
  void SetDecimationTargetReduction(double reduction) { m_DecimationTargetReduction = reduction; }
  void SetPrintDebugInfo(bool print) { m_PrintDebugInfo = print; }
  void SetApplyTransformForNifti(bool apply) { m_ApplyTransformForNifti = apply; }

private:
  vtkSmartPointer<vtkImageData> m_ImageData;
  vtkSmartPointer<vtkPolyData> m_Model;


  double m_ImageSmoothingSigmaInVox = 0.5;
  uint32_t m_TaubinSmoothingIterations = 15;
  double m_TaubinSmoothingPassband = 0.01;
  double m_TaubinSmoothingFeatureAngle = 120;
  double m_DecimationTargetReduction = 0.9;
  bool m_ApplyTransformForNifti = false;
  bool m_PrintDebugInfo = false;
};



// Export the function so it can be called from JavaScript
extern "C" {
  EMSCRIPTEN_KEEPALIVE
  ModelGenerator* createModelGenerator() {
    return new ModelGenerator();
  }

  EMSCRIPTEN_KEEPALIVE
  int setGaussianSigma(ModelGenerator *modelGenerator, double sigma) {
    modelGenerator->SetImageSmoothingSigmaInVox(sigma);
    return 0;
  }

  EMSCRIPTEN_KEEPALIVE
  int setMeshSmoothingIterations(ModelGenerator *modelGenerator, uint32_t iterations) {
    modelGenerator->SetTaubinSmoothingIterations(iterations);
    return 0;
  }

  EMSCRIPTEN_KEEPALIVE
  int setMeshSmoothingPassband(ModelGenerator *modelGenerator, double passband) {
    modelGenerator->SetTaubinSmoothingPassband(passband);
    return 0;
  }

  EMSCRIPTEN_KEEPALIVE
  int setMeshDecimationTargetReduction(ModelGenerator *modelGenerator, double reduction) {
    modelGenerator->SetDecimationTargetReduction(reduction);
    return 0;
  }

  EMSCRIPTEN_KEEPALIVE
  int setApplyTransformForNifti(ModelGenerator *modelGenerator, bool apply) {
    modelGenerator->SetApplyTransformForNifti(apply);
    return 0;
  }

  EMSCRIPTEN_KEEPALIVE
  int setPrintDebugInfo(ModelGenerator *modelGenerator, bool print) {
    modelGenerator->SetPrintDebugInfo(print);
    return 0;
  }

  EMSCRIPTEN_KEEPALIVE
  void destroyModelGenerator(ModelGenerator *modelGenerator) {
    delete modelGenerator;
  }

  // --- Core Methods
  EMSCRIPTEN_KEEPALIVE
  int setImage(ModelGenerator *modelGenerator, int16_t *buffer, size_t bufferSize, 
    uint16_t *dim3, double *spacing3, double *origin3, double *direction9) {
    return modelGenerator->setImage(buffer, bufferSize, dim3, spacing3, origin3, direction9);
  }

  EMSCRIPTEN_KEEPALIVE
  int generateModel(ModelGenerator *modelGenerator) {
    return modelGenerator->generateModel();
  }

  EMSCRIPTEN_KEEPALIVE
  int getModel(ModelGenerator *modelGenerator, double *points, int *cells) {
    double *pPoints = nullptr;
    size_t numPoints = modelGenerator->getPoints(pPoints);
    for (size_t i = 0; i < numPoints * 3; ++i) {
      points[i] = pPoints[i];
    }

    std::vector<int> cellsVec = modelGenerator->getCells();

    if (pointsVec.size() == 0 || cellsVec.size() == 0) {
      return 1;
    }

    for (size_t i = 0; i < pointsVec.size(); ++i) {
      points[i] = pointsVec[i];
    }

    for (size_t i = 0; i < cellsVec.size(); ++i) {
      cells[i] = cellsVec[i];
    }

    return 0;
  }
}