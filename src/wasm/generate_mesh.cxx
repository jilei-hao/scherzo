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

vtkSmartPointer<vtkImageData> createImageData(int16_t *buffer, size_t bufferSize) {
  vtkNew<vtkImageData> imageData;
  imageData->SetDimensions(256, 256, 256);
  imageData->SetSpacing(1.0, 1.0, 1.0);
  imageData->SetOrigin(0.0, 0.0, 0.0);

  // Set scalar type and allocate scalars
  imageData->AllocateScalars(VTK_DOUBLE, 1); // Single-component double data
  double *imageDataPtr = static_cast<double*>(imageData->GetScalarPointer());

  for (size_t i = 0; i < bufferSize; ++i) {
    imageDataPtr[i] = static_cast<double>(buffer[i]);
  }

  return imageData;
}

class ModelGenerator
{
public:
  ModelGenerator() {}
  ~ModelGenerator() {}

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

  void SetImageSmoothingSigmaInVox(double sigma) { m_ImageSmoothingSigmaInVox = sigma; }
  void SetTaubinSmoothingIterations(uint32_t iterations) { m_TaubinSmoothingIterations = iterations; }
  void SetTaubinSmoothingPassband(double passband) { m_TaubinSmoothingPassband = passband; }
  void SetTaubinSmoothingFeatureAngle(double angle) { m_TaubinSmoothingFeatureAngle = angle; }
  void SetDecimationTargetReduction(double reduction) { m_DecimationTargetReduction = reduction; }
  void SetPrintDebugInfo(bool print) { m_PrintDebugInfo = print; }

private:
  vtkSmartPointer<vtkImageData> m_ImageData;


  double m_ImageSmoothingSigmaInVox = 0.5;
  uint32_t m_TaubinSmoothingIterations = 15;
  double m_TaubinSmoothingPassband = 0.01;
  double m_TaubinSmoothingFeatureAngle = 120;
  double m_DecimationTargetReduction = 0.9;
  bool m_PrintDebugInfo = false;
};



// Export the function so it can be called from JavaScript
extern "C" {
  EMSCRIPTEN_KEEPALIVE
  int processImage(int16_t* buffer, size_t bufferSize) {
    std::cout << "Processing image data..., length: " << bufferSize << std::endl;
    // print the first 10 elements of the array
    for (int i = 0; i < 10; i++) {
      std::cout << buffer[i] << std::endl;
    }

    // create a new vtkImageData
    vtkSmartPointer<vtkImageData> imageData = createImageData(buffer, bufferSize);

    imageData->Print(std::cout);


    return 0;
  }

  EMSCRIPTEN_KEEPALIVE
  ModelGenerator* createModelGenerator() {
    return new ModelGenerator();
  }

  EMSCRIPTEN_KEEPALIVE
  int setImage(ModelGenerator *modelGenerator, int16_t *buffer, size_t bufferSize, 
    uint16_t *dim3, double *spacing3, double *origin3, double *direction9) {
    return modelGenerator->setImage(buffer, bufferSize, dim3, spacing3, origin3, direction9);
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
  int setPrintDebugInfo(ModelGenerator *modelGenerator, bool print) {
    modelGenerator->SetPrintDebugInfo(print);
    return 0;
  }

  EMSCRIPTEN_KEEPALIVE
  void destroyModelGenerator(ModelGenerator *modelGenerator) {
    delete modelGenerator;
  }
}