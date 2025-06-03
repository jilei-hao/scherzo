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


import styles from './styles.module.css'

function LabelColorMenuRow (props) {
  const { selected, onClick } = props;
  return (
    <div className={`${styles.menuRow} ${selected ? styles.selected : ''}`} onClick={onClick}>
      {props.children}
    </div>
  )
}

export default function LabelColorPresetMenu (props) {
  const { visible, presets, activeLabelColorPresetId, setActiveLabelColorPresetId } = props
  const getOnMenuRowClick = (presetId) => {
    return () => {
      setActiveLabelColorPresetId(presetId);
    };
  };
  return (
    <div className={`${styles.menuBody} ${visible ? styles.visible : styles.hidden}`}>
      <div className={styles.menuTitle}>Label Color Presets</div>
      <div className={styles.menuRowContainer}>
        {
          presets.map((preset, index) => {
            return (
              <LabelColorMenuRow key={index} onClick={getOnMenuRowClick(preset.Id)} selected={activeLabelColorPresetId == preset.Id}>
                  {preset.DisplayName}
              </LabelColorMenuRow>
            )
          })
        }
      </div>
    </div>
  )
}