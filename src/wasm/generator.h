#include <iostream>
#include <vector>
#include <ctype.h>

#include <vtkSmartPointer.h>
#include <vtkImageData.h>
#include <vtkPolyData.h>
#include <vtkJSONDataSetWriter.h>

using MeshPointer = vtkSmartPointer<vtkPolyData>;
using vtkImagePointer = vtkSmartPointer<vtkImageData>;

class wasmModelGenerator
{
public:
  wasmModelGenerator();
  ~wasmModelGenerator();

  void readImage(const std::vector<uint16_t>& dims, 
    const std::vector<double>& spacing, const std::vector<double>& origin,
    const std::vector<double>& direction, const std::vector<uint16_t>& buffer);

  void readImageFromFile(std::string filename);

  void setGaussianSigma(double sigma) { m_GaussianSigma = sigma; }
  void setSmoothingIteration(uint16_t iteration) { m_SmoothingIteration = iteration; }
  void setSmoothingPassband(double passband) { m_SmoothingPassband = passband; }
  void setDecimationTargetRate(double rate) { m_DecimationTargetRate = rate; }
  void setApplyTransformForNifti(bool apply) { m_ApplyTransformForNifti = apply; }
  void setPrintDebugInfo(bool print) { m_PrintDebugInfo = print; }

  int generateModel();

  std::vector<double> getPoints();
  std::vector<int> getCells();

private:
  vtkImagePointer m_ImageData;
  MeshPointer m_Model;
  double m_GaussianSigma = 0.8;
  uint16_t m_SmoothingIteration = 15;
  double m_SmoothingPassband = 0.01;
  double m_DecimationTargetRate = 0.3;
  bool m_ApplyTransformForNifti = false;
  bool m_PrintDebugInfo = false;

};

#ifdef __EMSCRIPTEN__
#include <emscripten/bind.h>
EMSCRIPTEN_BINDINGS(wasmModelGeneratorJSBinding) 
{
  emscripten::class_<wasmModelGenerator>("wasmModelGenerator")
    .constructor<>()
    .function("readImage", &wasmModelGenerator::readImage)
    .function("generateModel", &wasmModelGenerator::generateModel)
    .function("getPoints", &wasmModelGenerator::getPoints)
    .function("getCells", &wasmModelGenerator::getCells)
    .function("setGaussianSigma", &wasmModelGenerator::setGaussianSigma)
    .function("setSmoothingIteration", &wasmModelGenerator::setSmoothingIteration)
    .function("setSmoothingPassband", &wasmModelGenerator::setSmoothingPassband)
    .function("setDecimationTargetRate", &wasmModelGenerator::setDecimationTargetRate)
    .function("setApplyTransformForNifti", &wasmModelGenerator::setApplyTransformForNifti)
    .function("setPrintDebugInfo", &wasmModelGenerator::setPrintDebugInfo);

  emscripten::register_vector<double>("DoubleVector");
  emscripten::register_vector<uint16_t>("Uint16Vector");
  emscripten::register_vector<int>("IntVector");
}


#endif // __EMSCRIPTEN__