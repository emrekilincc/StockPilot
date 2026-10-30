/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, setCsrf } from '../services/api'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(async () => {
    try {
      const result = await api('/auth/me')
      setCsrf(result.csrf_token)
      setUser(result.user)
    } catch { setUser(null); setCsrf('') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => {
    refresh()
    const expired = () => { setUser(null); setCsrf('') }
    window.addEventListener('session-expired', expired)
    return () => window.removeEventListener('session-expired', expired)
  }, [refresh])
  async function login(body) {
    const result = await api('/auth/login', { method: 'POST', body })
    setCsrf(result.csrf_token)
    setUser(result.user)
  }
  async function logout() {
    await api('/auth/logout', { method: 'POST' })
    setCsrf('')
    setUser(null)
  }
  const can = (permission) => user?.role === 'admin' || Boolean(user?.[`manage_${permission}`])
  return <AuthContext.Provider value={{ user, loading, login, logout, refresh, setUser, can }}>{children}</AuthContext.Provider>
}
