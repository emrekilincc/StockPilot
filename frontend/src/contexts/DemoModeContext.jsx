/* eslint-disable react-refresh/only-export-components */
/* The demo switch is a presentation scope, not a second mock API. */
import { createContext, useContext, useEffect, useState } from 'react'
import { setDemoMode } from '../services/api'

const DemoModeContext = createContext(null)
export const useDemoMode = () => useContext(DemoModeContext)

export function DemoModeProvider({ children }) {
  const [demoMode, setMode] = useState(() => localStorage.getItem('stockpilot-demo-mode') !== 'false')
  useEffect(() => {
    setDemoMode(demoMode)
    localStorage.setItem('stockpilot-demo-mode', String(demoMode))
    window.dispatchEvent(new Event('demo-mode-changed'))
  }, [demoMode])
  return <DemoModeContext.Provider value={{ demoMode, setDemoMode: setMode }}>{children}</DemoModeContext.Provider>
}
