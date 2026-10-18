import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { authApi, saveSession } from '../api/client.ts'
import { AuthProvider } from '../auth/AuthContext.tsx'
import { makeSession } from '../test/fixtures.ts'
import LoginPage from './LoginPage.tsx'

function renderLogin() {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/products" element={<div>Pantalla de productos</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('LoginPage', () => {
  it('inicia sesión y va a productos', async () => {
    const user = userEvent.setup()
    const loginSpy = vi.spyOn(authApi, 'login').mockResolvedValue(makeSession())
    renderLogin()

    await user.type(screen.getByLabelText('Usuario'), 'admin')
    await user.type(screen.getByLabelText('Contraseña'), 'Admin123!')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(loginSpy).toHaveBeenCalledWith('admin', 'Admin123!')
    expect(await screen.findByText('Pantalla de productos')).toBeInTheDocument()
  })

  it('muestra el error de la API y deja reintentar', async () => {
    const user = userEvent.setup()
    vi.spyOn(authApi, 'login').mockRejectedValue(new Error('Usuario o contraseña incorrectos.'))
    renderLogin()

    await user.type(screen.getByLabelText('Usuario'), 'admin')
    await user.type(screen.getByLabelText('Contraseña'), 'mala')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByText('Usuario o contraseña incorrectos.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeEnabled()
  })

  it('con sesión abierta redirige a productos', () => {
    saveSession(makeSession())
    renderLogin()
    expect(screen.getByText('Pantalla de productos')).toBeInTheDocument()
  })
})
