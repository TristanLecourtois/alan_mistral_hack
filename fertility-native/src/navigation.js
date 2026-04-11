import { createContext, useContext, useState } from 'react'

const NavContext = createContext(null)

export const SCREENS = {
  WELCOME:  'Welcome',
  UPLOAD:   'Upload',
  ANALYSE:  'Analyse',
  PROFILE:  'Profile',
  RESULTS:  'Results',
  COPILOT:  'Copilot',
  HEALTH:   'Health',
}

export function NavProvider({ children }) {
  const [screen, setScreen] = useState(SCREENS.WELCOME)
  const [history, setHistory] = useState([])

  function navigate(name) {
    setHistory(h => [...h, screen])
    setScreen(name)
  }

  function goBack() {
    setHistory(h => {
      const prev = [...h]
      const last = prev.pop()
      if (last) setScreen(last)
      return prev
    })
  }

  return (
    <NavContext.Provider value={{ screen, navigate, goBack }}>
      {children}
    </NavContext.Provider>
  )
}

export function useNav() {
  return useContext(NavContext)
}
