import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import WelcomePage from './welcome_page'


import { readImage } from '@itk-wasm/image-io'



function sanitizeFileName(name) {
  return name.replace(/\//g, '_');
}

/**
 * Returns a new File instance with a sanitized name.
 * @param file
 */
function sanitizeFile(file) {
  return new File([file], sanitizeFileName(file.name));
}

const makeImage = async (files) => {
  const cleanFiles = files.map(sanitizeFile);

  console.log("cleanFiles", cleanFiles);

  if (cleanFiles.length === 0) {
    return;
  }
    
  if (cleanFiles.length === 1) {
    const { image } = await readImage(cleanFiles[0]);
    return image;
  }
  const { outputImage } = await readImageDicomFileSeries({
    inputImages: cleanFiles,
    singleSortedSeries: false,
  });

  return outputImage;
};


const handleFileChange = async (event) => {
  const files = event.target.files;

  console.log("start reading image", files);

  const image = await makeImage(Array.from(files));

  console.log("image", image);
};

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <h1>scherzo</h1>
      <WelcomePage
        onFileChange={handleFileChange}
      />
    </>
  )
}

export default App
