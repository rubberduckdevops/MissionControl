import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import api from '../services/api'

interface User {
  id: string
  email: string
  username: string
  role: string
  created_at: string
}

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem('token'),
    loading: true,
  })

  // Hydrate user from stored token on mount
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      api
        .get('/api/auth/me')
        .then((res) => setState({ user: res.data, token, loading: false }))
        .catch(() => {
          localStorage.removeItem('token')
          setState({ user: null, token: null, loading: false })
        })
    } else {
      setState((s) => ({ ...s, loading: false }))
    }
  }, [])

  const login = async (email: string, password: string) => {
    const res = await api.post('/api/auth/login', { email, password })
    const { token, user } = res.data
    localStorage.setItem('token', token)
    setState({ user, token, loading: false })
  }

  const register = async (email: string, username: string, password: string) => {
    const res = await api.post('/api/auth/register', { email, username, password })
    const { token, user } = res.data
    localStorage.setItem('token', token)
    setState({ user, token, loading: false })
  }

  const logout = () => {
    localStorage.removeItem('token')
    setState({ user: null, token: null, loading: false })
  }

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
