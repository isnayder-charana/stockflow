import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAlerts } from '../alerts/AlertsContext.jsx'
import { useAuth } from '../auth/AuthContext.jsx'

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
      <nav className="navbar navbar-expand navbar-dark bg-dark px-3">
        <span className="navbar-brand fw-semibold">StockFlow</span>
        <ul className="navbar-nav me-auto">
          <li className="nav-item">
            <NavLink to="/products" className="nav-link">
              Productos
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/warehouses" className="nav-link">
              Almacenes
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/suppliers" className="nav-link">
              Proveedores
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/movements" className="nav-link">
              Movimientos
            </NavLink>
          </li>
        </ul>
        <NavLink
          to="/alerts"
          className={`btn btn-sm me-3 ${alertCount ? 'btn-warning' : 'btn-outline-light'}`}
          title={alertCount ? `${alertCount} producto(s) bajo el stock mínimo` : 'Sin productos bajo el stock mínimo'}
        >
          Alertas{' '}
          <span className={`badge rounded-pill ${alertCount ? 'text-bg-danger' : 'text-bg-secondary'}`}>
            {alertCount ?? '…'}
          </span>
        </NavLink>
        <span className="navbar-text text-light me-3">
          {session.fullName || session.username}{' '}
          <span className="badge text-bg-secondary">{session.role}</span>
        </span>
        <button className="btn btn-outline-light btn-sm" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </nav>
      <main className="container-fluid py-4">
        <Outlet />
      </main>
    </>
  )
}
