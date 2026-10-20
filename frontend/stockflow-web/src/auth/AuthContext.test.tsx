import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { authApi, getSession, saveSession } from '../api/client.ts'
import { makeSession } from '../test/fixtures.ts'
import { AuthProvider, useAuth } from './AuthContext.tsx'

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>

describe('AuthContext', () => {
  it('arranca con la sesión guardada', () => {
    const session = makeSession()
    saveSession(session)
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.session).toEqual(session)
  })

  it('login guarda la sesión que devuelve la API', async () => {
    const session = makeSession({ username: 'jperez', role: 'Almacenero' })
    const loginSpy = vi.spyOn(authApi, 'login').mockResolvedValue(session)
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(() => result.current.login('jperez', 'secreto'))

    expect(loginSpy).toHaveBeenCalledWith('jperez', 'secreto')
    expect(result.current.session).toEqual(session)
    expect(getSession()).toEqual(session)
  })

  it('login propaga el error y no abre sesión', async () => {
    vi.spyOn(authApi, 'login').mockRejectedValue(new Error('Usuario o contraseña incorrectos.'))
    const { result } = renderHook(() => useAuth(), { wrapper })

    await expect(act(() => result.current.login('x', 'y'))).rejects.toThrow('Usuario o contraseña incorrectos.')
    expect(result.current.session).toBeNull()
  })

  it('loginAsGuest abre una sesión de solo lectura', async () => {
    const session = makeSession({ username: 'invitado', fullName: 'Invitado', role: 'Invitado' })
    vi.spyOn(authApi, 'guest').mockResolvedValue(session)
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(() => result.current.loginAsGuest())

    expect(result.current.session).toEqual(session)
    expect(result.current.hasRole('Admin', 'Almacenero')).toBe(false)
    expect(getSession()).toEqual(session)
  })

  it('logout borra la sesión', () => {
    saveSession(makeSession())
    const { result } = renderHook(() => useAuth(), { wrapper })

    act(() => result.current.logout())

    expect(result.current.session).toBeNull()
    expect(getSession()).toBeNull()
  })

  it('hasRole compara con el rol de la sesión', () => {
    saveSession(makeSession({ role: 'Almacenero' }))
    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.hasRole('Admin', 'Almacenero')).toBe(true)
    expect(result.current.hasRole('Admin')).toBe(false)
  })

  it('hasRole es falso sin sesión', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.hasRole('Admin', 'Almacenero', 'Supervisor')).toBe(false)
  })

  it('useAuth fuera del provider avisa del error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useAuth())).toThrow('useAuth debe usarse dentro de <AuthProvider>.')
  })
})
