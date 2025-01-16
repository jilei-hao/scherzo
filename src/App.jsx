import { useState } from 'react'
import './App.css'
import WelcomePage from './welcome_page'
import ViewerPage from './viewer_page'
import readImageFromFile from './io/image_io/image_reader'


import { GenerateLabelModel } from './generator'


function App() {
  const [count, setCount] = useState(0);
  const [image, setImage] = useState(null);
  const [models, setModels] = useState(null);
  const [appStatus, setAppStatus] = useState("welcome"); // welcome, viewing
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState(null);

  const handleFileChange = async (event) => {
    setFiles(event.target.files);
  
    // console.log("start reading image", files);
  
    // const image = await readImageFromFile(Array.from(files));
  
    // console.log("image", image);

    // setImage(image);
  };

  const handleModelGeneration = async () => {
    if (!files)
      return;
    
    console.log("start reading image", files);
    setLoading(true);

    const localImage = await readImageFromFile(Array.from(files));
  
    console.log("image", localImage);

    setImage(localImage);
  
    if (!localImage) {
      console.log("[handleModelGeneration] no image!");
      return;
    } else {
      console.log("[handleModelGeneration] image found!");
    }

    const models = await GenerateLabelModel(localImage, {});

    console.log("[handleModelGeneration] models", models);

    setModels(models);
    setLoading(false);
    setAppStatus("viewing");
  }

  const handleExit = () => {
    setAppStatus("welcome");
    setImage(null);
    setModels(null);
  }

  return (
    <>
    {appStatus === "welcome" && (
      <WelcomePage
        onFileChange={handleFileChange}
        onGenerateClicked={handleModelGeneration}
        loading={loading}
      />
    )}
    {(appStatus === "loading" || appStatus === "viewing") && (
      <ViewerPage
        image={image}
        models={models}
        onExit={handleExit}
      />
    )}
    </>
  )
}

export default App
