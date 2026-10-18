import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { alertsApi, getSession, saveSession } from '../api/client.ts'
import { AlertsProvider } from '../alerts/AlertsContext.tsx'
import { AuthProvider } from '../auth/AuthContext.tsx'
import { makeSession } from '../test/fixtures.ts'
import Layout from './Layout.tsx'

function renderLayout() {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/products']}>
        <Routes>
          <Route path="/login" element={<div>Pantalla de login</div>} />
          <Route
            element={
              <AlertsProvider>
                <Layout />
              </AlertsProvider>
            }
          >
            <Route path="/products" element={<div>Pantalla de productos</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('Layout', () => {
  it('muestra el usuario, su rol, el menú y la página actual', async () => {
    saveSession(makeSession({ fullName: 'Juan Pérez', role: 'Supervisor' }))
    vi.spyOn(alertsApi, 'lowStockCount').mockResolvedValue({ count: 0 })
    renderLayout()

    expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
    expect(screen.getByText('Supervisor')).toBeInTheDocument()
    for (const name of ['Productos', 'Almacenes', 'Proveedores', 'Movimientos']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument()
    }
    expect(screen.getByText('Pantalla de productos')).toBeInTheDocument()
    expect(await screen.findByTitle('Sin productos bajo el stock mínimo')).toHaveClass('btn-outline-light')
  })

  it('resalta las alertas cuando hay productos bajo el mínimo', async () => {
    saveSession(makeSession())
    vi.spyOn(alertsApi, 'lowStockCount').mockResolvedValue({ count: 4 })
    renderLayout()

    const alerts = await screen.findByTitle('4 producto(s) bajo el stock mínimo')
    expect(alerts).toHaveClass('btn-warning')
    expect(alerts).toHaveTextContent('4')
  })

  it('cerrar sesión borra la sesión y vuelve al login', async () => {
    const user = userEvent.setup()
    saveSession(makeSession())
    vi.spyOn(alertsApi, 'lowStockCount').mockResolvedValue({ count: 0 })
    renderLayout()

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(await screen.findByText('Pantalla de login')).toBeInTheDocument()
    expect(getSession()).toBeNull()
  })
})
