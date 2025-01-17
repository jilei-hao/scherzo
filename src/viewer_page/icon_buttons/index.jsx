import IconStepForward_Idle from '@assets/icons/step-forward_idle.svg';
import IconStepBack_Idle from '@assets/icons/step-back_idle.svg';
import IconPlay_Idle from '@assets/icons/play_idle.svg';
import IconPause_Idle from '@assets/icons/pause_idle.svg';
import IconExit_Idle from '@assets/icons/exit_idle.svg';
import IconPalette_Idle from '@assets/icons/palette_idle.svg';
import IconPalette_Active from '@assets/icons/palette_active.svg';
import IconFullScreen_Idle  from '@assets/icons/full-screen_idle.svg';
import IconSplitScreen_Idle from '@assets/icons/split-screen_idle.svg';
import IconDownload from '@assets/icons/download_idle.svg';
import IconButton from './icon_button';
import styles from './styles.module.css';

export function BtnStepBack({ onClick }) {
  return (
    <IconButton
      iconSrc={IconStepBack_Idle}
      onClick={onClick}
      className=''
    />
  );
}

export function BtnStepForward({ onClick }) {
  return (
    <IconButton
      iconSrc={IconStepForward_Idle}
      onClick={onClick}
      className=''
    />
  );
}

export function BtnPlay({ isReplayOn, onClick }) {
  return (
    <IconButton
      iconSrc={ isReplayOn ? IconPause_Idle : IconPlay_Idle}
      onClick={onClick}
      className={styles.playButton}
    />
  );
}

export function BtnExit({ onClick }) {
  return (
    <IconButton
      iconSrc={IconExit_Idle}
      onClick={onClick}
      className=''
    />
  );
}

export function BtnPalette({ isActive, onClick }) {
  return (
    <IconButton
      iconSrc={isActive ? IconPalette_Active : IconPalette_Idle}
      onClick={onClick}
      className=''
    />
  );
}

export function ViewCtrlBtnFullScreen({className, isFullScreen, onClick}) {
  return (
    <IconButton
      iconSrc={isFullScreen ? IconSplitScreen_Idle : IconFullScreen_Idle}
      onClick={onClick}
      className={className}
    />
  );
}

export function BtnDownload({ onClick }) {
  return (
    <IconButton
      iconSrc={IconDownload}
      onClick={onClick}
      className=''
    />
  );
}