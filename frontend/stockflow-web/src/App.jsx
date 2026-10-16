import { Navigate, Route, Routes } from 'react-router-dom'
import { AlertsProvider } from './alerts/AlertsContext.jsx'
import ProtectedRoute from './auth/ProtectedRoute.jsx'
import Layout from './components/Layout.jsx'
import AlertsPage from './pages/AlertsPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import MovementsPage from './pages/MovementsPage.jsx'
import ProductsPage from './pages/ProductsPage.jsx'
import SuppliersPage from './pages/SuppliersPage.jsx'
import WarehousesPage from './pages/WarehousesPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AlertsProvider>
              <Layout />
            </AlertsProvider>
          </ProtectedRoute>
        }
      >
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/warehouses" element={<WarehousesPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/movements" element={<MovementsPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/products" replace />} />
    </Routes>
  )
}
