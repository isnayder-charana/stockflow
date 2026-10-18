import type {
  AlertCount,
  LookupOption,
  LowStockAlert,
  MovementFilters,
  Product,
  ProductRequest,
  Session,
  StockMovement,
  StockMovementRequest,
  Supplier,
  SupplierLookup,
  SupplierProduct,
  SupplierRequest,
  Warehouse,
  WarehouseRequest,
  WarehouseStock,
} from './types.ts'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'
const SESSION_KEY = 'stockflow.session'

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as Session
    return new Date(session.expiresAt) > new Date() ? session : null
  } catch {
    return null
  }
}

export function saveSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const session = getSession()
  // Con FormData (subida de archivos) el navegador pone el Content-Type con su boundary.
  const isForm = options.body instanceof FormData
  const headers = new Headers(options.headers)
  if (!isForm && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (session?.token) headers.set('Authorization', `Bearer ${session.token}`)

  const response = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (response.status === 401 && session) {
    clearSession()
    window.location.assign('/login')
    throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.')
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null
    throw new Error(body?.message ?? `Error ${response.status}`)
  }
  return (response.status === 204 ? null : await response.json()) as T
}

/** Mensaje legible de un error capturado en un catch (donde el tipo es unknown). */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** URL para abrir un archivo: en S3 ya es absoluta; en desarrollo la API la da relativa (/files/...). */
export function fileUrl(url: string): string
export function fileUrl(url: string | null | undefined): string | null | undefined
export function fileUrl(url: string | null | undefined) {
  return url?.startsWith('/') ? `${API_URL}${url}` : url
}

/**
 * Fotos de productos y guías de remisión. Activas en desarrollo (npm run dev) y apagadas al publicar,
 * porque el despliegue gratuito no tiene bucket. VITE_ENABLE_FILES=true|false lo fuerza.
 */
const filesFlag = import.meta.env.VITE_ENABLE_FILES
export const FILES_ENABLED = filesFlag ? filesFlag === 'true' : import.meta.env.DEV

/** Tamaño máximo de fotos y guías (igual que en la API). */
export const MAX_FILE_BYTES = 4 * 1024 * 1024

function formWithFile(file: File) {
  const form = new FormData()
  form.append('file', file)
  return form
}

export const authApi = {
  login: (username: string, password: string) =>
    apiFetch<Session>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
}

const json = (method: string, data: unknown): RequestInit => ({ method, body: JSON.stringify(data) })

type Id = number | string

export const productsApi = {
  getAll: () => apiFetch<Product[]>('/api/products'),
  getById: (id: Id) => apiFetch<Product>(`/api/products/${id}`),
  create: (data: ProductRequest) => apiFetch<Product>('/api/products', json('POST', data)),
  update: (id: Id, data: ProductRequest) => apiFetch<Product>(`/api/products/${id}`, json('PUT', data)),
  remove: (id: Id) => apiFetch<void>(`/api/products/${id}`, { method: 'DELETE' }),
  uploadPhoto: (id: Id, file: File) =>
    apiFetch<Product>(`/api/products/${id}/photo`, { method: 'PUT', body: formWithFile(file) }),
  removePhoto: (id: Id) => apiFetch<void>(`/api/products/${id}/photo`, { method: 'DELETE' }),
}

export const lookupsApi = {
  categories: () => apiFetch<LookupOption[]>('/api/lookups/categories'),
  suppliers: () => apiFetch<SupplierLookup[]>('/api/lookups/suppliers'),
  warehouses: () => apiFetch<LookupOption[]>('/api/lookups/warehouses'),
}

export const warehousesApi = {
  getAll: () => apiFetch<Warehouse[]>('/api/warehouses'),
  getById: (id: Id) => apiFetch<Warehouse>(`/api/warehouses/${id}`),
  getStock: (id: Id) => apiFetch<WarehouseStock[]>(`/api/warehouses/${id}/stock`),
  create: (data: WarehouseRequest) => apiFetch<Warehouse>('/api/warehouses', json('POST', data)),
  update: (id: Id, data: WarehouseRequest) => apiFetch<Warehouse>(`/api/warehouses/${id}`, json('PUT', data)),
  remove: (id: Id) => apiFetch<void>(`/api/warehouses/${id}`, { method: 'DELETE' }),
}

export const suppliersApi = {
  getAll: () => apiFetch<Supplier[]>('/api/suppliers'),
  getById: (id: Id) => apiFetch<Supplier>(`/api/suppliers/${id}`),
  getProducts: (id: Id) => apiFetch<SupplierProduct[]>(`/api/suppliers/${id}/products`),
  create: (data: SupplierRequest) => apiFetch<Supplier>('/api/suppliers', json('POST', data)),
  update: (id: Id, data: SupplierRequest) => apiFetch<Supplier>(`/api/suppliers/${id}`, json('PUT', data)),
  remove: (id: Id) => apiFetch<void>(`/api/suppliers/${id}`, { method: 'DELETE' }),
}

export const movementsApi = {
  /** Filtros opcionales: from, to (fechas ISO, to exclusivo), warehouseId, productId. */
  getAll: (filters: MovementFilters = {}) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined && value !== '') params.append(key, String(value))
    }
    const query = params.toString()
    return apiFetch<StockMovement[]>(`/api/movements${query ? `?${query}` : ''}`)
  },
  create: (data: StockMovementRequest) => apiFetch<StockMovement>('/api/movements', json('POST', data)),
  /** Adjunta la guía de remisión (PDF, JPG o PNG). Solo una vez por movimiento. */
  uploadDocument: (id: Id, file: File) =>
    apiFetch<StockMovement>(`/api/movements/${id}/document`, { method: 'POST', body: formWithFile(file) }),
}

export const alertsApi = {
  lowStock: () => apiFetch<LowStockAlert[]>('/api/alerts/low-stock'),
  lowStockCount: () => apiFetch<AlertCount>('/api/alerts/low-stock/count'),
}
