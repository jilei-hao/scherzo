
async function allocateMemoryForArray(wasmModule, inputArray) {
  const numBytes = inputArray.length * inputArray.BYTES_PER_ELEMENT;
  const pBuffer = wasmModule._malloc(numBytes);

  if (inputArray instanceof Int8Array) {
    wasmModule.HEAP8.set(inputArray, pBuffer);
  } else if (inputArray instanceof Uint8Array) {
    wasmModule.HEAPU8.set(inputArray, pBuffer);
  } else if (inputArray instanceof Int16Array) {
    wasmModule.HEAP16.set(inputArray, pBuffer / inputArray.BYTES_PER_ELEMENT);
  } else if (inputArray instanceof Uint16Array) {
    wasmModule.HEAPU16.set(inputArray, pBuffer / inputArray.BYTES_PER_ELEMENT);
  } else if (inputArray instanceof Int32Array) {
    wasmModule.HEAP32.set(inputArray, pBuffer / inputArray.BYTES_PER_ELEMENT);
  } else if (inputArray instanceof Uint32Array) {
    wasmModule.HEAPU32.set(inputArray, pBuffer / inputArray.BYTES_PER_ELEMENT);
  } else if (inputArray instanceof Float32Array) {
    wasmModule.HEAPF32.set(inputArray, pBuffer / inputArray.BYTES_PER_ELEMENT);
  } else if (inputArray instanceof Float64Array) {
    wasmModule.HEAPF64.set(inputArray, pBuffer / inputArray.BYTES_PER_ELEMENT);
  } else {
    throw new Error("Unsupported array type");
  }

  return pBuffer;
}


export {
  allocateMemoryForArray
}