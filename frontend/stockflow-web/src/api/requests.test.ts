import { describe, expect, it } from 'vitest'
import { makeProduct } from '../test/fixtures.ts'
import { toProductRequest, toSupplierRequest, toWarehouseRequest } from './requests.ts'

describe('toProductRequest', () => {
  it('copia solo los campos que acepta la API', () => {
    const request = toProductRequest(makeProduct({ supplierId: 4, description: 'Blanco' }))
    expect(request).toEqual({
      sku: 'EPP-001',
      name: 'Casco de seguridad',
      description: 'Blanco',
      unit: 'UND',
      unitPrice: 25,
      minStock: 10,
      categoryId: 1,
      supplierId: 4,
      isActive: true,
    })
  })

  it('completa valores por defecto para una fila nueva', () => {
    expect(toProductRequest({ sku: 'X', name: 'Y', categoryId: 2, description: '' })).toEqual({
      sku: 'X',
      name: 'Y',
      description: null,
      unit: 'UND',
      unitPrice: 0,
      minStock: 0,
      categoryId: 2,
      supplierId: null,
      isActive: true,
    })
  })
})

describe('toSupplierRequest', () => {
  it('convierte los textos vacíos en null', () => {
    expect(
      toSupplierRequest({ name: 'Ferretería', ruc: '20123456789', contactName: '', phone: '', email: '', isActive: false }),
    ).toEqual({
      name: 'Ferretería',
      ruc: '20123456789',
      contactName: null,
      phone: null,
      email: null,
      address: null,
      isActive: false,
    })
  })
})

describe('toWarehouseRequest', () => {
  it('activa por defecto y deja la ubicación en null si no hay', () => {
    expect(toWarehouseRequest({ code: 'ALM-01', name: 'Central' })).toEqual({
      code: 'ALM-01',
      name: 'Central',
      location: null,
      isActive: true,
    })
  })
})
