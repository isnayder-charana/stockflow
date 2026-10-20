import { createContext, useContext, useState, type ReactNode } from 'react'
import { authApi, clearSession, getSession, saveSession } from '../api/client.ts'
import type { Session, UserRole } from '../api/types.ts'

interface AuthContextValue {
  session: Session | null
  login: (username: string, password: string) => Promise<void>
  loginAsGuest: () => Promise<void>
  logout: () => void
  hasRole: (...roles: UserRole[]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(() => getSession())

  const login = async (username: string, password: string) => {
    const data = await authApi.login(username, password)
    saveSession(data)
    setSession(data)
  }

  const loginAsGuest = async () => {
    const data = await authApi.guest()
    saveSession(data)
    setSession(data)
  }

  const logout = () => {
    clearSession()
    setSession(null)
  }

  const hasRole = (...roles: UserRole[]) => !!session && roles.includes(session.role)

  return (
    <AuthContext.Provider value={{ session, login, loginAsGuest, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>.')
  return context
}
