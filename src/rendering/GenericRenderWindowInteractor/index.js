import macro from "@kitware/vtk.js/macro";
import vtkRenderWindowInteractor from "@kitware/vtk.js/Rendering/Core/RenderWindowInteractor";

function GenericRenderWindowInteractor(publicAPI, model) {
  model.classHierarchy.push('GenericRenderWindowInteractor');

  console.log("[GenericRenderWindowInteractor]: constructor");

  publicAPI.dispose = () => {
    console.log("[GenericRenderWindowInteractor::dispose] ");
    publicAPI.delete();
  }

}

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  vtkRenderWindowInteractor.extend(publicAPI, model, initialValues);

  GenericRenderWindowInteractor(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(extend, 'GenericRenderWindowInteractor');

// ----------------------------------------------------------------------------

export default { newInstance, extend };