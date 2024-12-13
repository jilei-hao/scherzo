import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import WelcomePage from './welcome_page'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <WelcomePage></WelcomePage>
    </>
  )
}

export default App
