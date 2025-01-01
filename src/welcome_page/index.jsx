import React, { useState } from "react";

export default function WelcomePage(props) {
  return (
    <div>
      <h1>Scherzo</h1>
      <div className="fileInputContainer">
        <label>Select a file</label>
        <input type="file" accept=".nii,.nii.gz,application/gzip" onChange={props.onFileChange} />
        <button onClick={props.onGenerateClicked}>Generate</button>
      </div>
    </div>
  );
}