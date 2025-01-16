#include <iostream>
#include <vector>
#include <ctype.h>

#include <vtkSmartPointer.h>
#include <vtkImageData.h>
#include <vtkPolyData.h>

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

  int generateModel();

  std::string getModelAsJSON();

private:
  vtkImagePointer m_ImageData;
  MeshPointer m_Model;
};

#ifdef __EMSCRIPTEN__
#include <emscripten/bind.h>
EMSCRIPTEN_BINDINGS(wasmModelGeneratorJSBinding) 
{
  emscripten::class_<wasmModelGenerator>("wasmModelGenerator")
    .constructor<>()
    .function("readImage", &wasmModelGenerator::readImage)
    .function("generateModel", &wasmModelGenerator::generateModel)
    .function("getModelAsJSON"), &wasmModelGenerator::getModelAsJSON);

  emscripten::register_vector<double>("DoubleVector");
  emscripten::register_vector<uint16_t>("Uint16Vector");
}


#endif // __EMSCRIPTEN__