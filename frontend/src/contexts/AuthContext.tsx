import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useAuth as useOidcAuth } from 'react-oidc-context'
import api, { setAccessToken } from '../services/api'

interface User {
  id: string
  email: string
  username: string
  role: string
  created_at: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const oidcAuth = useOidcAuth()
  const [user, setUser] = useState<User | null>(null)
  const [fetchFailed, setFetchFailed] = useState(false)

  useEffect(() => {
    const token = oidcAuth.user?.access_token ?? null
    setAccessToken(token)

    if (oidcAuth.isAuthenticated && token) {
      setFetchFailed(false)
      api
        .get('/api/auth/me')
        .then((res) => setUser(res.data))
        .catch(() => {
          setUser(null)
          setFetchFailed(true)
        })
    } else if (!oidcAuth.isLoading) {
      setUser(null)
      setFetchFailed(false)
    }
  }, [oidcAuth.isAuthenticated, oidcAuth.user?.access_token, oidcAuth.isLoading])

  const login = () => oidcAuth.signinRedirect()
  const logout = () => oidcAuth.signoutRedirect()

  return (
    <AuthContext.Provider value={{ user, loading: oidcAuth.isLoading || (oidcAuth.isAuthenticated && user === null && !fetchFailed), login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
