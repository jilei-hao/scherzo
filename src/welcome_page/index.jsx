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