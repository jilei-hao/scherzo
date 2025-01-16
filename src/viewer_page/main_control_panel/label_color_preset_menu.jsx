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