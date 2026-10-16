const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'
const SESSION_KEY = 'stockflow.session'

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    return new Date(session.expiresAt) > new Date() ? session : null
  } catch {
    return null
  }
}

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export async function apiFetch(path, options = {}) {
  const session = getSession()
  // Con FormData (subida de archivos) el navegador pone el Content-Type con su boundary.
  const isForm = options.body instanceof FormData
  const headers = { ...(isForm ? {} : { 'Content-Type': 'application/json' }), ...options.headers }
  if (session?.token) headers.Authorization = `Bearer ${session.token}`

  const response = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (response.status === 401 && session) {
    clearSession()
    window.location.assign('/login')
    throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.')
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.message ?? `Error ${response.status}`)
  }
  return response.status === 204 ? null : response.json()
}

/** URL para abrir un archivo: en S3 ya es absoluta; en desarrollo la API la da relativa (/files/...). */
export function fileUrl(url) {
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

function formWithFile(file) {
  const form = new FormData()
  form.append('file', file)
  return form
}

export const authApi = {
  login: (username, password) =>
    apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
}


const json = (method, data) => ({ method, body: JSON.stringify(data) })

export const productsApi = {
  getAll: () => apiFetch('/api/products'),
  getById: (id) => apiFetch(`/api/products/${id}`),
  create: (data) => apiFetch('/api/products', json('POST', data)),
  update: (id, data) => apiFetch(`/api/products/${id}`, json('PUT', data)),
  remove: (id) => apiFetch(`/api/products/${id}`, { method: 'DELETE' }),
  uploadPhoto: (id, file) => apiFetch(`/api/products/${id}/photo`, { method: 'PUT', body: formWithFile(file) }),
  removePhoto: (id) => apiFetch(`/api/products/${id}/photo`, { method: 'DELETE' }),
}

export const lookupsApi = {
  categories: () => apiFetch('/api/lookups/categories'),
  suppliers: () => apiFetch('/api/lookups/suppliers'),
  warehouses: () => apiFetch('/api/lookups/warehouses'),
}

export const warehousesApi = {
  getAll: () => apiFetch('/api/warehouses'),
  getById: (id) => apiFetch(`/api/warehouses/${id}`),
  getStock: (id) => apiFetch(`/api/warehouses/${id}/stock`),
  create: (data) => apiFetch('/api/warehouses', json('POST', data)),
  update: (id, data) => apiFetch(`/api/warehouses/${id}`, json('PUT', data)),
  remove: (id) => apiFetch(`/api/warehouses/${id}`, { method: 'DELETE' }),
}

export const suppliersApi = {
  getAll: () => apiFetch('/api/suppliers'),
  getById: (id) => apiFetch(`/api/suppliers/${id}`),
  getProducts: (id) => apiFetch(`/api/suppliers/${id}/products`),
  create: (data) => apiFetch('/api/suppliers', json('POST', data)),
  update: (id, data) => apiFetch(`/api/suppliers/${id}`, json('PUT', data)),
  remove: (id) => apiFetch(`/api/suppliers/${id}`, { method: 'DELETE' }),
}

export const movementsApi = {
  /** Filtros opcionales: from, to (fechas ISO, to exclusivo), warehouseId, productId. */
  getAll: (filters = {}) => {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, value]) => value !== null && value !== undefined && value !== ''),
    )
    const query = params.toString()
    return apiFetch(`/api/movements${query ? `?${query}` : ''}`)
  },
  create: (data) => apiFetch('/api/movements', json('POST', data)),
  /** Adjunta la guía de remisión (PDF, JPG o PNG). Solo una vez por movimiento. */
  uploadDocument: (id, file) => apiFetch(`/api/movements/${id}/document`, { method: 'POST', body: formWithFile(file) }),
}

export const alertsApi = {
  lowStock: () => apiFetch('/api/alerts/low-stock'),
  lowStockCount: () => apiFetch('/api/alerts/low-stock/count'),
}
