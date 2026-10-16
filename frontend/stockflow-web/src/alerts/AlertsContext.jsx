import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { alertsApi } from '../api/client.js'

const AlertsContext = createContext(null)

// Cada cuánto se vuelve a consultar, para ver también los movimientos de otros usuarios.
const POLL_MS = 60_000

/** Cantidad de productos bajo el stock mínimo, compartida por la barra y las pantallas. */
export function AlertsProvider({ children }) {
  const [count, setCount] = useState(null)

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
export function useAlerts() {
  return useContext(AlertsContext) ?? { count: null, refresh: () => {} }
}
