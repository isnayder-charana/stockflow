import { describe, expect, it, vi } from 'vitest'
import { jsonResponse, makeSession } from '../test/fixtures.ts'
import {
  apiFetch,
  clearSession,
  errorMessage,
  fileUrl,
  getSession,
  movementsApi,
  productsApi,
  saveSession,
} from './client.ts'

const SESSION_KEY = 'stockflow.session'

function mockFetch(response: Response = jsonResponse({})) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** URL y opciones de la llamada número `index` a fetch. */
function fetchCall(fetchMock: ReturnType<typeof mockFetch>, index = 0) {
  const [url, init] = fetchMock.mock.calls[index]
  return { url: String(url), init: init ?? {}, headers: new Headers(init?.headers) }
}

describe('sesión', () => {
  it('guarda y lee la sesión', () => {
    const session = makeSession()
    saveSession(session)
    expect(getSession()).toEqual(session)
  })

  it('devuelve null si no hay sesión', () => {
    expect(getSession()).toBeNull()
  })

  it('ignora una sesión vencida', () => {
    saveSession(makeSession({ expiresAt: new Date(Date.now() - 1000).toISOString() }))
    expect(getSession()).toBeNull()
  })

  it('ignora una sesión corrupta', () => {
    localStorage.setItem(SESSION_KEY, '{no es json')
    expect(getSession()).toBeNull()
  })

  it('clearSession la borra', () => {
    saveSession(makeSession())
    clearSession()
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
  })
})

describe('apiFetch', () => {
  it('llama a la API con JSON y sin token si no hay sesión', async () => {
    const fetchMock = mockFetch(jsonResponse([{ id: 1 }]))

    const data = await apiFetch('/api/products')

    expect(data).toEqual([{ id: 1 }])
    const { url, headers } = fetchCall(fetchMock)
    expect(url).toBe('http://api.test/api/products')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.has('Authorization')).toBe(false)
  })

  it('envía el token de la sesión', async () => {
    saveSession(makeSession({ token: 'abc' }))
    const fetchMock = mockFetch()

    await apiFetch('/api/products')

    expect(fetchCall(fetchMock).headers.get('Authorization')).toBe('Bearer abc')
  })

  it('no fija Content-Type al subir archivos (FormData)', async () => {
    const fetchMock = mockFetch()
    const body = new FormData()

    await apiFetch('/api/products/1/photo', { method: 'PUT', body })

    const { init, headers } = fetchCall(fetchMock)
    expect(init.body).toBe(body)
    expect(headers.has('Content-Type')).toBe(false)
  })

  it('devuelve null en respuestas 204', async () => {
    mockFetch(jsonResponse(null, 204))
    await expect(apiFetch('/api/products/1', { method: 'DELETE' })).resolves.toBeNull()
  })

  it('usa el mensaje de error que manda la API', async () => {
    mockFetch(jsonResponse({ message: 'El SKU ya existe.' }, 409))
    await expect(apiFetch('/api/products')).rejects.toThrow('El SKU ya existe.')
  })

  it('usa el código HTTP si la respuesta no trae mensaje', async () => {
    mockFetch(new Response('falla', { status: 500 }))
    await expect(apiFetch('/api/products')).rejects.toThrow('Error 500')
  })

  it('con 401 y sesión, cierra la sesión y manda al login', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    saveSession(makeSession())
    mockFetch(jsonResponse({ message: 'no' }, 401))

    await expect(apiFetch('/api/products')).rejects.toThrow('Tu sesión expiró')
    expect(getSession()).toBeNull()
    expect(assign).toHaveBeenCalledWith('/login')
  })

  it('con 401 sin sesión (login fallido), muestra el mensaje de la API', async () => {
    mockFetch(jsonResponse({ message: 'Usuario o contraseña incorrectos.' }, 401))
    await expect(apiFetch('/api/auth/login')).rejects.toThrow('Usuario o contraseña incorrectos.')
  })
})

describe('APIs por recurso', () => {
  it('productsApi.update envía PUT con el cuerpo en JSON', async () => {
    const fetchMock = mockFetch()
    const request = {
      sku: 'A',
      name: 'B',
      description: null,
      unit: 'UND',
      unitPrice: 1,
      minStock: 0,
      categoryId: 1,
      supplierId: null,
      isActive: true,
    }

    await productsApi.update(7, request)

    const { url, init } = fetchCall(fetchMock)
    expect(url).toBe('http://api.test/api/products/7')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(String(init.body))).toEqual(request)
  })

  it('movementsApi.getAll omite los filtros vacíos', async () => {
    const fetchMock = mockFetch(jsonResponse([]))

    await movementsApi.getAll({ from: '2026-10-01T05:00:00.000Z', to: null, warehouseId: '', productId: 3 })

    const url = new URL(fetchCall(fetchMock).url)
    expect(url.pathname).toBe('/api/movements')
    expect(Object.fromEntries(url.searchParams)).toEqual({ from: '2026-10-01T05:00:00.000Z', productId: '3' })
  })

  it('movementsApi.getAll sin filtros no agrega query string', async () => {
    const fetchMock = mockFetch(jsonResponse([]))
    await movementsApi.getAll()
    expect(fetchCall(fetchMock).url).toBe('http://api.test/api/movements')
  })
})

describe('fileUrl', () => {
  it('antepone la URL de la API a las rutas relativas', () => {
    expect(fileUrl('/files/foto.png')).toBe('http://api.test/files/foto.png')
  })

  it('deja igual las URL absolutas y los vacíos', () => {
    expect(fileUrl('https://bucket.s3.amazonaws.com/foto.png')).toBe('https://bucket.s3.amazonaws.com/foto.png')
    expect(fileUrl(null)).toBeNull()
  })
})

describe('errorMessage', () => {
  it('saca el mensaje de un Error o convierte a texto', () => {
    expect(errorMessage(new Error('falló'))).toBe('falló')
    expect(errorMessage('texto')).toBe('texto')
  })
})
