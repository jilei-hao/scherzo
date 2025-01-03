import React, {useRef, useEffect} from "react";
import styles from "./styles.module.css";

// Load the rendering pieces we want to use (for both WebGL and WebGPU)
import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import '@kitware/vtk.js/Rendering/Misc/RenderingAPIs';

import vtkRenderWindow from '@kitware/vtk.js/Rendering/Core/RenderWindow';
import vtkRenderWindowInteractor from '@kitware/vtk.js/Rendering/Core/RenderWindowInteractor';
import vtkRenderer from '@kitware/vtk.js/Rendering/Core/Renderer';
import vtkInteractorStyleTrackballCamera from '@kitware/vtk.js/Interaction/Style/InteractorStyleTrackballCamera';
import vtkGenericRenderWindow from "@kitware/vtk.js/Rendering/Misc/GenericRenderWindow";
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkMapper from "@kitware/vtk.js/Rendering/Core/Mapper";

export default function ViewerPage(props) {
  const rwContainerRef = useRef(null);
  const vtkRwRef = useRef(null);
  const rwRef = useRef(null);
  const renRef = useRef(null);
  const actorListRef = useRef(null);
  const activeTPRef = useRef(1);

  console.log("[ViewerPage]: models", props.models);

  useEffect(() => {
    if (vtkRwRef.current)
      return;

    // set up the rendering window
    const vtkRw = vtkGenericRenderWindow.newInstance();
    vtkRw.setContainer(rwContainerRef.current);
    vtkRw.resize(); // important to call this after setting the container

    const rw = vtkRw.getRenderWindow();
    const ren = vtkRw.getRenderer();
    
    // for each label model, create an actor and add it to the renderer
    let actorList = [];

    const activeTPModel = props.models[activeTPRef.current - 1];

    for (let i = 0; i < activeTPModel.length; i++) {
      const actor = vtkActor.newInstance();
      const mapper = vtkMapper.newInstance();
      const label = activeTPModel[i].label;
      const labelModel = activeTPModel[i].model;
      mapper.setInputData(labelModel);
      actor.setMapper(mapper);
      ren.addActor(actor);
      actorList.push({
        label: label,
        actor: actor
      });
    }

    actorListRef.current = actorList;

    ren.resetCamera();
    rw.render();

    rwRef.current = rw;
    renRef.current = ren;
    vtkRwRef.current = vtkRw;

    return () => {
      console.log("[ViewerPage] component dismount");
      vtkRwRef.current.delete();
      vtkRwRef.current = null;
    }
  }, []);

  return (
    <div className={styles.pageContainer}>
      <div className={styles.renderWindowContainer} ref={rwContainerRef}/>
    </div>
  );
}