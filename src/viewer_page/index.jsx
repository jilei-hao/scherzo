import React, {useRef, useEffect} from "react";
import styles from "./styles.module.css";

// Load the rendering pieces we want to use (for both WebGL and WebGPU)
import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import '@kitware/vtk.js/Rendering/Misc/RenderingAPIs';

import vtkRenderWindow from '@kitware/vtk.js/Rendering/Core/RenderWindow';
import vtkRenderWindowInteractor from '@kitware/vtk.js/Rendering/Core/RenderWindowInteractor';
import vtkRenderer from '@kitware/vtk.js/Rendering/Core/Renderer';
import vtkInteractorStyleTrackballCamera from '@kitware/vtk.js/Interaction/Style/InteractorStyleTrackballCamera';

export default function ViewerPage(props) {
  const rwContainerRef = useRef(null);
  const rwRef = useRef(null);

  useEffect(() => {
    if (rwRef.current)
      return;

    const rw = vtkRenderWindow.newInstance();
    const rwView = rw.newAPISpecificView();
    rw.addView(rwView);

    console.log("[ViewPage] rwContainerRef", rwContainerRef.current);
    rwView.setContainer(rwContainerRef.current);
    rwRef.current = rw;
  }, []);

  return (
    <div>
      <h1>Viewer</h1>
      <div className={styles.renderWindowContainer} ref={rwContainerRef}/>
    </div>
  );
}