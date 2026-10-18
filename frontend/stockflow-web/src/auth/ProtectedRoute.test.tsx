import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { saveSession } from '../api/client.ts'
import { makeSession } from '../test/fixtures.ts'
import { AuthProvider } from './AuthContext.tsx'
import ProtectedRoute from './ProtectedRoute.tsx'

function renderAt(path: string) {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<div>Pantalla de login</div>} />
          <Route
            path="/products"
            element={
              <ProtectedRoute>
                <div>Contenido privado</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('ProtectedRoute', () => {
  it('sin sesión manda al login', () => {
    renderAt('/products')
    expect(screen.getByText('Pantalla de login')).toBeInTheDocument()
    expect(screen.queryByText('Contenido privado')).not.toBeInTheDocument()
  })

  it('con sesión muestra el contenido', () => {
    saveSession(makeSession())
    renderAt('/products')
    expect(screen.getByText('Contenido privado')).toBeInTheDocument()
  })
})
