import React, { useState } from "react";

export default function WelcomePage(props) {
  return (
    <div>
      <div className="fileInputContainer">
        <label>Select a file</label>
        <input type="file" accept=".nii,.nii.gz,application/gzip" onChange={props.onFileChange} />
      </div>
    </div>
  );
}