import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAlerts } from '../alerts/AlertsContext.tsx'
import { useAuth } from '../auth/AuthContext.tsx'

const links = [
  { to: '/products', label: 'Productos' },
  { to: '/warehouses', label: 'Almacenes' },
  { to: '/suppliers', label: 'Proveedores' },
  { to: '/movements', label: 'Movimientos' },
]

export default function Layout() {
  const { session, logout } = useAuth()
  const { count: alertCount } = useAlerts()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <header className="app-topbar">
        <span className="app-brand">
          <img src="/logo.svg" alt="" width="30" height="30" />
          StockFlow
        </span>
        <nav className="app-nav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className="app-nav-link">
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="app-user">
          <NavLink
            to="/alerts"
            className={`alerts-pill ${alertCount ? 'alerts-pill-active' : ''}`}
            title={alertCount ? `${alertCount} producto(s) bajo el stock mínimo` : 'Sin productos bajo el stock mínimo'}
          >
            Alertas <span className="alerts-count">{alertCount ?? '…'}</span>
          </NavLink>
          <span className="app-user-name">
            {session?.fullName || session?.username} <span className="role-badge">
              {session?.role === 'Invitado' ? 'Solo lectura' : session?.role}
            </span>
          </span>
          <button className="btn-logout" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </>
  )
}
