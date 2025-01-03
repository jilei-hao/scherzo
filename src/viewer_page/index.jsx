import React, {useRef, useEffect} from "react";
import styles from "./styles.module.css";

// Load the rendering pieces we want to use (for both WebGL and WebGPU)
import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import '@kitware/vtk.js/Rendering/Misc/RenderingAPIs';

import vtkRenderWindow from '@kitware/vtk.js/Rendering/Core/RenderWindow';
import vtkRenderWindowInteractor from '@kitware/vtk.js/Rendering/Core/RenderWindowInteractor';
import vtkRenderer from '@kitware/vtk.js/Rendering/Core/Renderer';
import vtkInteractorStyleTrackballCamera from '@kitware/vtk.js/Interaction/Style/InteractorStyleTrackballCamera';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkMapper from "@kitware/vtk.js/Rendering/Core/Mapper";

export default function ViewerPage(props) {
  const rwContainerRef = useRef(null);
  const rwRef = useRef(null);

  console.log("[ViewerPage]: models", props.models);

  useEffect(() => {
    if (rwRef.current)
      return;

    const rw = vtkRenderWindow.newInstance();
    const rwView = rw.newAPISpecificView();
    rw.addView(rwView);

    // configure renderer
    const ren = vtkRenderer.newInstance({ background: [0.9, 0.9, 0.9] });
    rw.addRenderer(ren);

    // configure interactor
    const interactor = vtkRenderWindowInteractor.newInstance();
    interactor.setView(rwView);
    interactor.initialize();
    interactor.setInteractorStyle(vtkInteractorStyleTrackballCamera.newInstance());



    const actor = vtkActor.newInstance();
    const mapper = vtkMapper.newInstance();
    mapper.setInputData(props.models[2]);
    actor.setMapper(mapper);
    ren.addActor(actor);
    ren.resetCamera();


    rwView.setContainer(rwContainerRef.current);
    rwRef.current = rw;
    rw.render();
  }, []);

  return (
    <div className={styles.pageContainer}>
      <div className={styles.renderWindowContainer} ref={rwContainerRef}/>
    </div>
  );
}