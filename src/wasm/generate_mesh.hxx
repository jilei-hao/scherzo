#include <stdint.h>    // For uint8_t
#include <emscripten.h> // For Emscripten compatibility
#include <cstddef>      // For size_t
#include <iostream>


#include <vtkImageData.h>
#include <vtkSmartPointer.h>
#include <vtkNew.h>

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
}