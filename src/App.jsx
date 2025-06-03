// This file is part of the Scherzo project.
// Copyright (C) 2025 Jilei Hao
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

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
  };

  const handleModelGeneration = async () => {
    if (!files)
      return;
    
    console.log("start reading image", files);
    setLoading(true);

    const startTime = performance.now();

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

    const endTime = performance.now();
    const timeElapsed = (endTime - startTime) / 1000;
    console.log(`Model generation took ${timeElapsed.toFixed(2)} seconds.`);

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
