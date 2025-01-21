import React, {useRef, useEffect, useState} from "react";
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
import MainControlPanel from "./main_control_panel";
import vtkXMLPolyDataWriter from '@kitware/vtk.js/IO/XML/XMLPolyDataWriter';

import vtkAppendPolyData from "@kitware/vtk.js/Filters/General/AppendPolyData";

// Function to download vtkPolyData
function downloadPolyData(polyData, fileName = 'polydata.vtp') {
  // Create an XML PolyData Writer
  const writer = vtkXMLPolyDataWriter.newInstance();
  
  // Write the data to a string (XML format for .vtp)
  const vtkString = writer.write(polyData);
  
  // Create a Blob with the data
  const blob = new Blob([vtkString], { type: 'text/plain' });

  // Create a temporary anchor element
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;

  // Programmatically click the link to start the download
  document.body.appendChild(link);
  link.click();
  
  // Clean up the DOM
  document.body.removeChild(link);
}

async function assemblePolyData(polydataList) {
  const fltAppend = vtkAppendPolyData.newInstance();
  polydataList.forEach((pd) => {
    fltAppend.addInputData(pd);
  });
  fltAppend.update();
  return fltAppend.getOutputData();
}

const getITKSNAPLabelColorTable = () => {
  return {
    0: [0, 0, 0, 0],
    1: [255, 0, 0, 1],
    2: [0, 255, 0, 1],
    3: [0, 0, 255, 1],
    4: [255, 255, 0, 1],
    5: [0, 255, 255, 1],
    6: [255, 0, 255, 1],
    7: [255, 255, 255, 1],
    8: [128, 0, 0, 1],
    9: [0, 128, 0, 1],
    10: [0, 0, 128, 1],
    11: [128, 128, 0, 1],
    12: [128, 0, 128, 1],
    13: [0, 128, 128, 1],
    14: [128, 128, 128, 1],
    15: [192, 192, 192, 1]
  }
};

export default function ViewerPage(props) {
  const rwContainerRef = useRef(null);
  const vtkRwRef = useRef(null);
  const rwRef = useRef(null);
  const renRef = useRef(null);
  const actorListRef = useRef(null);
  const activeTPRef = useRef(1);
  const [activeTP, setActiveTP] = useState(1);

  const handleActiveTPChange = (newTP) => {
    activeTPRef.current = newTP;
    setActiveTP(newTP);
  }

  const handleDownload = () => {
    const activeTPModel = props.models[activeTPRef.current - 1];
    console.log("[ViewerPage] handleDownload", activeTPModel);

    const polydataList = activeTPModel.map((labelModel) => {
      return labelModel.model;
    });

    assemblePolyData(polydataList).then((polyData) => {
      downloadPolyData(polyData, `tp_${activeTPRef.current}.vtp`);
    });

  };

  const updateTPData = () => {
    const activeTPModel = props.models[activeTPRef.current - 1];
    const actorList = actorListRef.current;

    // we are assuming each tp has the same number of labels
    for (let i = 0; i < activeTPModel.length; i++) {
      const labelModel = activeTPModel[i].model;
      actorList[i].actor.getMapper().setInputData(labelModel);
    }

    rwRef.current.render();
  }

  // setup the rendering window
  useEffect(() => {
    if (vtkRwRef.current)
      return;

    // set up the rendering window
    const vtkRw = vtkGenericRenderWindow.newInstance();
    vtkRw.setContainer(rwContainerRef.current);
    vtkRw.resize(); // important to call this after setting the container

    const rw = vtkRw.getRenderWindow();
    const ren = vtkRw.getRenderer();
    ren.setBackground(1, 1, 1);
    
    // for each label model, create an actor and add it to the renderer
    let actorList = [];

    const activeTPModel = props.models[activeTPRef.current - 1];
    console.log("[ViewerPage] ActiveTPModel", activeTPModel);

    for (let i = 0; i < activeTPModel.length; i++) {
      const actor = vtkActor.newInstance();
      const mapper = vtkMapper.newInstance();
      
      const label = activeTPModel[i].label;
      const labelModel = activeTPModel[i].model;

      console.log("[ViewerPage] label", label, labelModel);

      mapper.setInputData(labelModel);
      mapper.setScalarVisibility(false);
      const rgba = getITKSNAPLabelColorTable()[label];

      if (rgba)
        actor.getProperty().setColor(rgba[0]/255, rgba[1]/255, rgba[2]/255);
      else
        actor.getProperty().setColor(0.9, 0.9, 0.9);

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

  // update the rendering window when the active time point changes
  useEffect(() => {
    if (!vtkRwRef.current)
      return;

    updateTPData();
  }, [activeTP]);


  return (
    <div className={styles.pageContainer}>
      <div className={styles.renderWindowContainer} ref={rwContainerRef}/>
      <MainControlPanel 
        activeTP={activeTP} numberOfTPs={props.models.length}
        setActiveTP={handleActiveTPChange} onExit={props.onExit}
        onDownload={handleDownload}
      />
    </div>
  );
}