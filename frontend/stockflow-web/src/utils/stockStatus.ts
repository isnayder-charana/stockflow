import type { Product } from '../api/types.ts'
import type { BadgeTone } from '../components/StatusBadge.tsx'

export type StockStatus = 'OK' | 'Bajo mínimo' | 'Agotado' | 'Inactivo'

type StockFields = Pick<Product, 'isActive' | 'totalStock' | 'minStock'>

/** Estado de stock de un producto: agotado si no queda nada, bajo mínimo si no llega al mínimo. */
export function stockStatus(p: StockFields): StockStatus {
  if (!p.isActive) return 'Inactivo'
  if (p.totalStock <= 0) return 'Agotado'
  if (p.totalStock < p.minStock) return 'Bajo mínimo'
  return 'OK'
}

export const statusTone: Record<StockStatus, BadgeTone> = {
  OK: 'ok',
  'Bajo mínimo': 'warning',
  Agotado: 'danger',
  Inactivo: 'muted',
}

/** Clase de la fila en la grilla según el estado (amarillo bajo mínimo, rojo agotado). */
export const statusRowClass: Partial<Record<StockStatus, string>> = {
  'Bajo mínimo': 'row-below-min',
  Agotado: 'row-out-of-stock',
  Inactivo: 'row-inactive',
}

/** Indicadores de la pantalla de productos. Los inactivos no cuentan. */
export function productKpis(products: StockFields[]) {
  const active = products.filter((p) => p.isActive)
  const status = active.map(stockStatus)
  return {
    active: active.length,
    belowMin: status.filter((s) => s === 'Bajo mínimo').length,
    outOfStock: status.filter((s) => s === 'Agotado').length,
  }
}
