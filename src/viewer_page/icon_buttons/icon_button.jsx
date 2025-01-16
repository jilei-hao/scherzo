import styles from './styles.module.css';

export default function IconButton({ iconSrc, onClick, className }) {
  return (
    <div className={`${styles.iconButton} ${className}`} onClick={onClick}>
      <img src={iconSrc} />
    </div>
  );
}