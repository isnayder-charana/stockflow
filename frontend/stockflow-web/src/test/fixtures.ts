import type { Product, Session } from '../api/types.ts'

/** Sesión válida por una hora. */
export function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    token: 'token-123',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    username: 'admin',
    fullName: 'Administrador',
    role: 'Admin',
    ...overrides,
  }
}

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    sku: 'EPP-001',
    name: 'Casco de seguridad',
    description: null,
    unit: 'UND',
    unitPrice: 25,
    minStock: 10,
    totalStock: 40,
    belowMinStock: false,
    photoUrl: null,
    isActive: true,
    categoryId: 1,
    categoryName: 'EPP',
    supplierId: null,
    supplierName: null,
    createdAt: '2026-10-15T00:00:00Z',
    ...overrides,
  }
}

/** Respuesta JSON como la que devuelve fetch. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
