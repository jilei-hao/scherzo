import styles from "./styles.module.css"

export default function TPSlider ({nT, currentTP, onTPChange}) {
  return (
    <input className={styles.tp_slider}
      type="range" min="1" max={nT}
      value={currentTP}
      onChange={(ev) => onTPChange(Number(ev.target.value))}
    />
  )
}