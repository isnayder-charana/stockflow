import { act, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { alertsApi } from '../api/client.ts'
import { AlertsProvider, useAlerts } from './AlertsContext.tsx'

function CountProbe() {
  const { count, refresh } = useAlerts()
  return (
    <>
      <span data-testid="count">{count ?? 'sin dato'}</span>
      <button onClick={refresh}>refrescar</button>
    </>
  )
}

/** Deja correr las promesas pendientes (con timers falsos activos). */
const flush = () => act(async () => {})

describe('AlertsContext', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('consulta la cantidad al montar', async () => {
    vi.spyOn(alertsApi, 'lowStockCount').mockResolvedValue({ count: 3 })
    render(
      <AlertsProvider>
        <CountProbe />
      </AlertsProvider>,
    )

    await flush()

    expect(screen.getByTestId('count')).toHaveTextContent('3')
  })

  it('vuelve a consultar cada minuto y al volver a la ventana', async () => {
    const spy = vi.spyOn(alertsApi, 'lowStockCount').mockResolvedValue({ count: 1 })
    render(
      <AlertsProvider>
        <CountProbe />
      </AlertsProvider>,
    )
    await flush()
    expect(spy).toHaveBeenCalledTimes(1)

    spy.mockResolvedValue({ count: 5 })
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    expect(spy).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('count')).toHaveTextContent('5')

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(spy).toHaveBeenCalledTimes(3)
  })

  it('deja de consultar al desmontar', async () => {
    const spy = vi.spyOn(alertsApi, 'lowStockCount').mockResolvedValue({ count: 1 })
    const { unmount } = render(
      <AlertsProvider>
        <CountProbe />
      </AlertsProvider>,
    )
    await flush()
    unmount()

    await vi.advanceTimersByTimeAsync(120_000)
    window.dispatchEvent(new Event('focus'))

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('si la API falla, el indicador no rompe y queda sin dato', async () => {
    vi.spyOn(alertsApi, 'lowStockCount').mockRejectedValue(new Error('sin red'))
    render(
      <AlertsProvider>
        <CountProbe />
      </AlertsProvider>,
    )

    await flush()

    expect(screen.getByTestId('count')).toHaveTextContent('sin dato')
  })

  it('refresh consulta de nuevo a pedido', async () => {
    const spy = vi.spyOn(alertsApi, 'lowStockCount').mockResolvedValue({ count: 2 })
    render(
      <AlertsProvider>
        <CountProbe />
      </AlertsProvider>,
    )
    await flush()

    spy.mockResolvedValue({ count: 0 })
    await act(async () => {
      screen.getByText('refrescar').click()
    })

    expect(spy).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })

  it('useAlerts fuera del provider no falla', () => {
    vi.useRealTimers()
    const { result } = renderHook(() => useAlerts())
    expect(result.current.count).toBeNull()
    expect(() => result.current.refresh()).not.toThrow()
  })
})
