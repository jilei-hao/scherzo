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
  const [models, setModels] = useState(null);
  const [appStatus, setAppStatus] = useState("welcome"); // welcome, viewing
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [files, setFiles] = useState(null);

  const handleFileChange = (event) => {
    setFiles(event.target.files);
    setError(null);
  };

  const handleModelGeneration = async () => {
    if (!files || files.length === 0 || loading)
      return;

    setLoading(true);
    setError(null);

    try {
      const startTime = performance.now();

      // the source image is not kept in state: the viewer only needs the models
      const image = await readImageFromFile(Array.from(files));
      const models = await GenerateLabelModel(image, {});

      const timeElapsed = (performance.now() - startTime) / 1000;
      console.log(`Model generation took ${timeElapsed.toFixed(2)} seconds.`);

      setModels(models);
      setAppStatus("viewing");
    } catch (e) {
      console.error("[handleModelGeneration]", e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const handleExit = () => {
    setAppStatus("welcome");
    setModels(null);
    setFiles(null); // the file input is empty again when the welcome page remounts
  }

  return (
    <>
    {appStatus === "welcome" && (
      <WelcomePage
        onFileChange={handleFileChange}
        onGenerateClicked={handleModelGeneration}
        loading={loading}
        canGenerate={!!files && files.length > 0}
        error={error}
      />
    )}
    {appStatus === "viewing" && (
      <ViewerPage
        models={models}
        onExit={handleExit}
      />
    )}
    </>
  )
}

export default App
