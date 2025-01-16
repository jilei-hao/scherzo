cmake_minimum_required(VERSION 3.13)
project(scherzo-wasm)

# -----------------------------------------------------------------------------
# Handle VTK dependency
# -----------------------------------------------------------------------------

find_package(VTK
  COMPONENTS
    CommonColor
    FiltersGeometry
    InteractionStyle
    InteractionWidgets
    IOPLY
    IOGeometry
    IOXML
    RenderingOpenGL2
    RenderingUI
)

if (NOT VTK_FOUND)
  message("Skipping example: ${VTK_NOT_FOUND_MESSAGE}")
  return ()
endif ()


# -----------------------------------------------------------------------------
# Compile code
# -----------------------------------------------------------------------------

add_executable(Generator generator.h generator.cxx)
target_link_libraries(Generator PRIVATE ${VTK_LIBRARIES})

# -----------------------------------------------------------------------------
# WebAssembly build options
# -----------------------------------------------------------------------------
set(emscripten_link_options)
set(emscripten_compile_options)

list(APPEND emscripten_link_options
  "-lembind"
  "-sASYNCIFY=1" # for webgpu async APIs
  "-sASYNCIFY_STACK_SIZE=81920" #~297 nesting levels
  "-sMODULARIZE=1"
  "-sEXPORT_ES6=1"
  "-sEXPORT_NAME=createGeneratorModule"
  "-sENVIRONMENT=web"
  "-sALLOW_MEMORY_GROWTH=1"
  "-sMAXIMUM_MEMORY=4GB"
  "-sSINGLE_FILE=1"
  #"--memoryprofiler"
  #"--cpuprofiler"
  "-sEXPORTED_FUNCTIONS=['_malloc', '_free']"
  "-sEXPORTED_RUNTIME_METHODS=['ENV', 'UTF8ToString']"
)
if (CMAKE_SIZEOF_VOID_P EQUAL 8)
  list(APPEND emscripten_link_options
  "-sWASM_BIGINT=1"
  "-sMAXIMUM_MEMORY=16GB")
endif ()

# -----------------------------------------------------------------------------
# Optimizations
# -----------------------------------------------------------------------------
set(emscripten_optimizations)
set(emscripten_debug_options)

# Set a default build type if none was specified
if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
  message(STATUS "Setting build type to 'Debug' as none was specified.")
  set(CMAKE_BUILD_TYPE Debug CACHE STRING "Choose the type of build." FORCE)
  # Set the possible values of build type for cmake-gui
  set_property(CACHE CMAKE_BUILD_TYPE PROPERTY STRINGS "Debug" "Release"
    "MinSizeRel" "RelWithDebInfo")
endif()

if (CMAKE_BUILD_TYPE STREQUAL "Release")
  set(generator_wasm_optimize "BEST")
  set(generator_wasm_debuginfo "NONE")
elseif (CMAKE_BUILD_TYPE STREQUAL "MinSizeRel")
  set(generator_wasm_optimize "SMALLEST_WITH_CLOSURE")
  set(generator_wasm_debuginfo "NONE")
elseif (CMAKE_BUILD_TYPE STREQUAL "RelWithDebInfo")
  set(generator_wasm_optimize "MORE")
  set(generator_wasm_debuginfo "PROFILE")
elseif (CMAKE_BUILD_TYPE STREQUAL "Debug")
  set(generator_wasm_optimize "NO_OPTIMIZATION")
  set(generator_wasm_debuginfo "DEBUG_NATIVE")
endif ()
set(generator_wasm_optimize_NO_OPTIMIZATION "-O0")
set(generator_wasm_optimize_LITTLE "-O1")
set(generator_wasm_optimize_MORE "-O2")
set(generator_wasm_optimize_BEST "-O3")
set(generator_wasm_optimize_SMALLEST "-Os")
set(generator_wasm_optimize_SMALLEST_WITH_CLOSURE "-Oz")
set(generator_wasm_optimize_SMALLEST_WITH_CLOSURE_link "--closure=1")

if (DEFINED "generator_wasm_optimize_${generator_wasm_optimize}")
  list(APPEND emscripten_optimizations
    ${generator_wasm_optimize_${generator_wasm_optimize}})
  list(APPEND emscripten_link_options
    ${generator_wasm_optimize_${generator_wasm_optimize}_link})
else ()
  message (FATAL_ERROR "Unrecognized value for generator_wasm_optimize=${generator_wasm_optimize}")
endif ()

set(generator_wasm_debuginfo_NONE "-g0")
set(generator_wasm_debuginfo_READABLE_JS "-g1")
set(generator_wasm_debuginfo_PROFILE "-g2")
set(generator_wasm_debuginfo_DEBUG_NATIVE "-g3")
set(generator_wasm_debuginfo_DEBUG_NATIVE_link "-sASSERTIONS=1")
if (DEFINED "generator_wasm_debuginfo_${generator_wasm_debuginfo}")
  list(APPEND emscripten_debug_options
    ${generator_wasm_debuginfo_${generator_wasm_debuginfo}})
  list(APPEND emscripten_link_options
    ${generator_wasm_debuginfo_${generator_wasm_debuginfo}_link})
else ()
  message (FATAL_ERROR "Unrecognized value for generator_wasm_debuginfo=${generator_wasm_debuginfo}")
endif ()

target_compile_options(Generator
  PRIVATE
    ${emscripten_compile_options}
    ${emscripten_optimizations}
    ${emscripten_debug_options})
target_link_options(Generator
  PRIVATE
    ${emscripten_link_options}
    ${emscripten_optimizations}
    ${emscripten_debug_options})


# -----------------------------------------------------------------------------
# VTK modules initialization
# -----------------------------------------------------------------------------

vtk_module_autoinit(
  TARGETS  Generator
  MODULES  ${VTK_LIBRARIES}
)

set_target_properties(Generator
PROPERTIES
  RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}
)
