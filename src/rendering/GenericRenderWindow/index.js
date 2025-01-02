import macro from '@kitware/vtk.js/macros';
import vtkRenderer from '@kitware/vtk.js/Rendering/Core/Renderer';
import vtkRenderWindow from '@kitware/vtk.js/Rendering/Core/RenderWindow';
import vtkInteractorStyleTrackballCamera from '@kitware/vtk.js/Interaction/Style/InteractorStyleTrackballCamera';

// Load basic classes for vtk() factory
import '@kitware/vtk.js/Common/Core/Points';
import '@kitware/vtk.js/Common/Core/DataArray';
import '@kitware/vtk.js/Common/DataModel/PolyData';
import '@kitware/vtk.js/Rendering/Core/Actor';
import '@kitware/vtk.js/Rendering/Core/Mapper';
import '@kitware/vtk.js/Rendering/Misc/RenderingAPIs';


import GenericRenderWindowInteractor from '../GenericRenderWindowInteractor';

let instanceCounter = 0;


function GenericRenderWindow(publicAPI, model) {
  model.classHierarchy.push('GenericRenderWindow');
  model.instanceId = instanceCounter++;

  console.log(`[GenericRenderWindow(${model.instanceId})]: constructor`);

  // VTK renderWindow/renderer
  model.renderWindow = vtkRenderWindow.newInstance();
  model.renderer = vtkRenderer.newInstance();
  model.renderWindow.addRenderer(model.renderer);

  //apiSpecificRenderWindow
  model.apiSpecificRenderWindow = model.renderWindow.newAPISpecificView('WebGL');
  model.renderWindow.addView(model.apiSpecificRenderWindow);

  // Interactor
  model.interactor = GenericRenderWindowInteractor.newInstance();
  model.interactor.setInteractorStyle(
    vtkInteractorStyleTrackballCamera.newInstance()
  );
  model.interactor.setView(model.apiSpecificRenderWindow);
  model.interactor.initialize();

  // Expose background
  publicAPI.setBackground = model.renderer.setBackground;

  // Update BG color
  publicAPI.setBackground(...model.background);

  // Expose render
  publicAPI.render = model.renderWindow.render;

  publicAPI.getInstanceId = () => model.instanceId;

  // Representation API
  publicAPI.addRepresentation = (representation) => {
    representation.getActors().forEach((actor) => {
      model.renderer.addActor(actor);
    });
  };

  publicAPI.removeRepresentation = (representation) => {
    representation
      .getActors()
      .forEach((actor) => model.renderer.removeActor(actor));
  };

  publicAPI.setContainer = (container) => {
    // console.log(`[GenericRenderWindow(${model.instanceId})]: setContainer: `, container);

    model.container = container;
    model.apiSpecificRenderWindow.setContainer(model.container);
    model.interactor.setContainer(model.container);
    model.interactor.bindEvents(model.container);
    publicAPI.resizeObserver.observe(model.container);
    publicAPI.resize()
  }

  publicAPI.dispose = () => {
    console.log(`[GenericRenderWindow(${model.instanceId})]: dispose`);
    model.interactor.setContainer(null);
    model.interactor.dispose();

    model.apiSpecificRenderWindow.delete();
    window.removeEventListener('resize', publicAPI.resize);
    publicAPI.delete();
  }

  // Handle window resize
  publicAPI.resize = () => {
    const dims = model.container.getBoundingClientRect();
    const devicePixelRatio = window.devicePixelRatio || 1;
    model.apiSpecificRenderWindow.setSize(
      Math.floor(dims.width * devicePixelRatio),
      Math.floor(dims.height * devicePixelRatio)
    );
    if (model.resizeCallback) {
      model.resizeCallback(dims);
    }
    model.renderWindow.render();
  };

  publicAPI.setResizeCallback = (cb) => {
    model.resizeCallback = cb;
    publicAPI.resize();
  };

  publicAPI.resizeObserver = new ResizeObserver(() => {
    publicAPI.resize();
  });

  if (model.container)
    publicAPI.resizeObserver.observe(model.container);

  if (model.listenWindowResize) {
    window.addEventListener('resize', publicAPI.resize);
  }
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {
  background: [0.32, 0.34, 0.43],
  containerStyle: null,
  controlPanelStyle: null,
  listenWindowResize: true,
  resizeCallback: null,
  controllerVisibility: true,
};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  // Object methods
  macro.obj(publicAPI, model);
  macro.get(publicAPI, model, [
    'renderWindow',
    'renderer',
    'apiSpecificRenderWindow',
    'interactor',
    'container',
  ]);

  // Object specific methods
  GenericRenderWindow(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(extend);

// ----------------------------------------------------------------------------

export default { newInstance, extend };
