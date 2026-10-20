import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/client.ts'
import { useAuth } from '../auth/AuthContext.tsx'

export default function LoginPage() {
  const { session, login, loginAsGuest } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (session) return <Navigate to="/products" replace />

  const enter = async (doLogin: () => Promise<void>) => {
    setError('')
    setLoading(true)
    try {
      await doLogin()
      navigate('/products', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    void enter(() => login(username, password))
  }

  return (
    <div className="login-wrapper">
      <div className="login-brand">
        <img src="/logo.svg" alt="" width="40" height="40" />
        StockFlow
      </div>
      <div className="login-card">
        <div className="login-card-body">
          <h1 className="login-title">Iniciar sesión</h1>
          <p className="login-subtitle">Control de inventario industrial</p>

          {error && <div className="alert alert-danger py-2">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="username" className="form-label">
                Usuario
              </label>
              <input
                id="username"
                className="form-control"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                autoFocus
              />
            </div>
            <div className="mb-4">
              <label htmlFor="password" className="form-label">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-lg w-100" disabled={loading}>
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>

          <div className="login-divider">o</div>
          <button
            type="button"
            className="btn btn-outline-secondary btn-lg w-100"
            onClick={() => void enter(loginAsGuest)}
            disabled={loading}
          >
            Entrar como invitado
          </button>
          <p className="login-guest-hint">Puedes ver todo, pero no crear, editar ni borrar.</p>
        </div>
      </div>
    </div>
  )
}
