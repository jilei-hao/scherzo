import { useState } from 'react'
import './App.css'
import WelcomePage from './welcome_page'
import readImageFromFile from './io/image_io/image_reader'


import { GenerateLabelModel } from './generator'




function App() {
  const [count, setCount] = useState(0)
  const [image, setImage] = useState(null)

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

    GenerateLabelModel(image, {});


  }

  return (
    <>
      <WelcomePage
        onFileChange={handleFileChange}
        onGenerateClicked={handleModelGeneration}
      />
    </>
  )
}

export default App
