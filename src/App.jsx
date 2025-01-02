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
  const [appStatus, setAppStatus] = useState("welcome"); // welcome, loading, viewing

  const handleFileChange = async (event) => {
    const files = event.target.files;
  
    console.log("start reading image", files);
  
    const image = await readImageFromFile(Array.from(files));
  
    console.log("image", image);

    setImage(image);
  };

  const handleModelGeneration = async () => {
  
    if (!image) {
      console.log("[handleModelGeneration] no image!");
      return;
    } else {
      console.log("[handleModelGeneration] image found!");
    }

    const models = await GenerateLabelModel(image, {});

    console.log("[handleModelGeneration] models", models);

    setModels(models);
    setAppStatus("viewing");
  }

  return (
    <>
    {appStatus === "welcome" && (
      <WelcomePage
        onFileChange={handleFileChange}
        onGenerateClicked={handleModelGeneration}
      />
    )}
    {(appStatus === "loading" || appStatus === "viewing") && (
      <ViewerPage
        image={image}
        models={models}
      />
    )}
    </>
  )
}

export default App
