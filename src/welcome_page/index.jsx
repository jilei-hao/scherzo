import React, { useState } from "react";
import styles from "./styles.module.css";

export default function WelcomePage(props) {
  return (
    <div className={styles.welcomePageContainer}>
      <h1>Scherzo</h1>
      <div className="fileInputContainer">
        <label className={styles.fileSelectionLabel}>Select a file</label>
        <input type="file" accept=".nii,.nii.gz,application/gzip" onChange={props.onFileChange} />
        <button 
          onClick={props.onGenerateClicked}
          className={styles.buttonGenerate}
        >
          {props.loading ? (
            <>
              Generating...
              <span className={styles.spinner}></span>
            </>
          ) : (
            "Generate Model"
          )}
        </button>
      </div>
    </div>
  );
}