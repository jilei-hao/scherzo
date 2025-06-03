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

import React, { useState, useEffect, useRef } from 'react';
import styles from './styles.module.css';
import { 
  BtnStepBack, BtnStepForward, BtnPlay,
  BtnExit,
  BtnDownload
} from '../icon_buttons'
import TPSlider from '../tp_slider'

export default function MainControlPanel (props) {
  const [ IsReplayOn, setIsReplayOn ] = useState(false);
  const replayTimerRef = useRef({});
  const activeTPRef = useRef(props.activeTP);

  useEffect(() => {
    // console.log("[MainControlPanel] IsReplayOn: ", IsReplayOn);
    clearInterval(replayTimerRef.current);
    if (IsReplayOn)
      replayTimerRef.current = setInterval(onReplayTimerTick, 50);
  }, [IsReplayOn]);

  // console.log("[MainControlPanel] Component Rendered");

  const onReplayTimerTick = () => {
    console.log("[MainControlPanel] onReplayTimerTick", props.activeTP);
    let newTP = activeTPRef.current + 1;

    if (newTP > props.numberOfTPs)
      newTP = 1;

    props.setActiveTP(newTP);

    activeTPRef.current = newTP;
  }

  const onExitClicked = () => {
    props.onExit();
  };

  const onStepbackClicked = () => {
    const newTP = props.activeTP - 1;
    if (newTP < 1)
      props.setActiveTP(props.numberOfTPs);
    else
      props.setActiveTP(newTP);
  };

  const onPlayClicked = () => {
    setIsReplayOn(!IsReplayOn);
  }

  const onStepForwardClicked = () => {
    const newTP = props.activeTP + 1;
    if (newTP > props.numberOfTPs)
      props.setActiveTP(1);
    else
      props.setActiveTP(newTP);
  }

  const handleSliderTPChange = (newTP) => {
    props.setActiveTP(newTP);
  }

  const handleDownloadClick = () => {
    console.log("[MainControlPanel] handleDownloadClick");
    props.onDownload();
  }



  useEffect(() => {
    return () => {
      // console.log("[MainControlPanel] Component Unmounted");
      clearInterval(replayTimerRef.current);
      setIsReplayOn(false);
    }
    
  }, []);

  return (
    <div className={styles.panelContainer}>
      <div className={styles.appCtrlBtnGroup}>
        <BtnExit onClick={ onExitClicked } />
      </div>
      <div className={styles.tpCtrlBtnGroup}>
        <BtnStepBack onClick={ onStepbackClicked } />
        <BtnPlay isReplayOn={IsReplayOn} onClick={ onPlayClicked } />
        <BtnStepForward onClick={ onStepForwardClicked } />
        <TPSlider nT={props.numberOfTPs} currentTP={props.activeTP} onTPChange={handleSliderTPChange} />
      </div>
      <div className={styles.viewerCtrlBtnGroup}>
        <BtnDownload onClick={ handleDownloadClick } />
      </div>
    </div>
  );
}