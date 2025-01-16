import React, { useState } from "react";

export const AppDataContext = React.createContext();

export default function AppDataContextProvider(props) {
  const [image, setImage] = useState(null);
  const [tpData, setTPData] = useState([]);

  return (
    <AppDataContext.Provider value={{ image, setImage, tpData, setTPData }}>
      {props.children}
    </AppDataContext.Provider>
  );
}