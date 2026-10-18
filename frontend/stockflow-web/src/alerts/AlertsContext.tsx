import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { alertsApi } from '../api/client.ts'

interface AlertsContextValue {
  /** null mientras no se haya podido consultar. */
  count: number | null
  refresh: () => void
}

const AlertsContext = createContext<AlertsContextValue | null>(null)

// Cada cuánto se vuelve a consultar, para ver también los movimientos de otros usuarios.
const POLL_MS = 60_000

/** Cantidad de productos bajo el stock mínimo, compartida por la barra y las pantallas. */
export function AlertsProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await alertsApi.lowStockCount()
      setCount(data.count)
    } catch {
      // El indicador no debe romper la pantalla: se reintenta en la próxima consulta.
    }
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, POLL_MS)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [refresh])

  return <AlertsContext.Provider value={{ count, refresh }}>{children}</AlertsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAlerts(): AlertsContextValue {
  return useContext(AlertsContext) ?? { count: null, refresh: () => {} }
}
