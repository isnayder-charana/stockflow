import { Navigate, Route, Routes } from 'react-router-dom'
import { AlertsProvider } from './alerts/AlertsContext.tsx'
import ProtectedRoute from './auth/ProtectedRoute.tsx'
import Layout from './components/Layout.tsx'
import AlertsPage from './pages/AlertsPage.tsx'
import LoginPage from './pages/LoginPage.tsx'
import MovementsPage from './pages/MovementsPage.tsx'
import ProductsPage from './pages/ProductsPage.tsx'
import SuppliersPage from './pages/SuppliersPage.tsx'
import WarehousesPage from './pages/WarehousesPage.tsx'

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
