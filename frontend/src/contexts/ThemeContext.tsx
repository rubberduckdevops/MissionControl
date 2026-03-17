import { createContext, useContext, useState, ReactNode } from 'react'
import { applyMode, Mode } from '@cloudscape-design/global-styles'

type ThemeMode = 'dark' | 'light'
const STORAGE_KEY = 'mc-theme'

interface ThemeContextType {
  mode: ThemeMode
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextType>({ mode: 'dark', toggle: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    const m: ThemeMode = stored === 'light' ? 'light' : 'dark'
    applyMode(m === 'dark' ? Mode.Dark : Mode.Light)
    return m
  })

  const toggle = () => {
    setMode(prev => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark'
      applyMode(next === 'dark' ? Mode.Dark : Mode.Light)
      localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }

  return <ThemeContext.Provider value={{ mode, toggle }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
