#! /bin/bash

emcmake cmake -G "Ninja" -S . -B ./build \
-DCMAKE_BUILD_TYPE=Release \
-DVTK_DIR=/Users/jileihao/tk/vtk-wasm/installed/lib/cmake/vtk-9.4