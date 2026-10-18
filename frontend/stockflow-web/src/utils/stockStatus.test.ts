import { describe, expect, it } from 'vitest'
import { makeProduct } from '../test/fixtures.ts'
import { productKpis, stockStatus } from './stockStatus.ts'

describe('stockStatus', () => {
  it('distingue OK, bajo mínimo, agotado e inactivo', () => {
    expect(stockStatus(makeProduct({ totalStock: 40, minStock: 10 }))).toBe('OK')
    expect(stockStatus(makeProduct({ totalStock: 10, minStock: 10 }))).toBe('OK')
    expect(stockStatus(makeProduct({ totalStock: 9, minStock: 10 }))).toBe('Bajo mínimo')
    expect(stockStatus(makeProduct({ totalStock: 0, minStock: 10 }))).toBe('Agotado')
    expect(stockStatus(makeProduct({ totalStock: 0, minStock: 10, isActive: false }))).toBe('Inactivo')
  })
})

describe('productKpis', () => {
  it('cuenta solo los productos activos', () => {
    const kpis = productKpis([
      makeProduct({ totalStock: 40, minStock: 10 }),
      makeProduct({ totalStock: 5, minStock: 10 }),
      makeProduct({ totalStock: 0, minStock: 10 }),
      makeProduct({ totalStock: 0, minStock: 10, isActive: false }),
    ])
    expect(kpis).toEqual({ active: 3, belowMin: 1, outOfStock: 1 })
  })
})
