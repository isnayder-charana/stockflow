import { createContext, useContext, useState } from 'react'
import { authApi, clearSession, getSession, saveSession } from '../api/client.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => getSession())

  const login = async (username, password) => {
    const data = await authApi.login(username, password)
    saveSession(data)
    setSession(data)
  }

  const logout = () => {
    clearSession()
    setSession(null)
  }

  const hasRole = (...roles) => !!session && roles.includes(session.role)

  return (
    <AuthContext.Provider value={{ session, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
