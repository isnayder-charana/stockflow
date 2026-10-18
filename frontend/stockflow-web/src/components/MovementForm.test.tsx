import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lookupsApi, movementsApi, productsApi, warehousesApi } from '../api/client.ts'
import type { StockMovement } from '../api/types.ts'
import { makeProduct } from '../test/fixtures.ts'
import MovementForm from './MovementForm.tsx'

const refreshAlerts = vi.fn()
vi.mock('../alerts/AlertsContext.tsx', () => ({ useAlerts: () => ({ count: 0, refresh: refreshAlerts }) }))

const casco = makeProduct({ id: 1, sku: 'EPP-001', name: 'Casco de seguridad' })
const guantes = makeProduct({ id: 2, sku: 'EPP-002', name: 'Guantes', unit: 'PAR' })
const inactivo = makeProduct({ id: 3, sku: 'OLD-1', name: 'Producto viejo', isActive: false })

function savedMovement(overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    id: 10,
    type: 'In',
    date: '2026-10-18T00:00:00Z',
    quantity: 5,
    productId: 1,
    sku: 'EPP-001',
    productName: 'Casco de seguridad',
    unit: 'UND',
    warehouseId: 1,
    warehouseName: 'Central',
    reference: null,
    notes: null,
    username: 'admin',
    documentUrl: null,
    ...overrides,
  }
}

describe('MovementForm', () => {
  beforeEach(() => {
    refreshAlerts.mockReset()
    vi.spyOn(lookupsApi, 'warehouses').mockResolvedValue([{ id: 1, name: 'Central' }])
    vi.spyOn(productsApi, 'getAll').mockResolvedValue([casco, guantes, inactivo])
    vi.spyOn(warehousesApi, 'getStock').mockResolvedValue([
      { productId: 1, sku: 'EPP-001', productName: 'Casco de seguridad', unit: 'UND', quantity: 8, minStock: 10 },
    ])
  })

  it('con un solo almacén lo elige y muestra el stock disponible del producto', async () => {
    render(<MovementForm initialProductId={1} onCancel={() => {}} />)

    expect(await screen.findByText('Disponible en el almacén: 8')).toBeInTheDocument()
    expect(screen.getByLabelText('Almacén')).toHaveValue('1')
    expect(warehousesApi.getStock).toHaveBeenCalledWith('1')
    expect(screen.getByText('(UND)')).toBeInTheDocument()
  })

  it('no deja registrar una salida mayor al stock', async () => {
    const user = userEvent.setup()
    render(<MovementForm initialProductId={1} onCancel={() => {}} />)
    await screen.findByText('Disponible en el almacén: 8')

    await user.click(screen.getByText('Salida'))
    await user.type(screen.getByLabelText(/Cantidad/), '9')

    expect(screen.getByLabelText(/Cantidad/)).toHaveClass('is-invalid')
    expect(screen.getByRole('button', { name: 'Registrar' })).toBeDisabled()
  })

  it('registra una entrada y avisa a las alertas', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    const movement = savedMovement()
    const createSpy = vi.spyOn(movementsApi, 'create').mockResolvedValue(movement)
    render(<MovementForm initialProductId={1} onSaved={onSaved} onCancel={() => {}} />)
    await screen.findByText('Disponible en el almacén: 8')

    await user.type(screen.getByLabelText(/Cantidad/), '5')
    await user.type(screen.getByLabelText('Referencia'), 'GR-001')
    await user.click(screen.getByRole('button', { name: 'Registrar' }))

    expect(createSpy).toHaveBeenCalledWith({
      type: 'In',
      warehouseId: 1,
      productId: 1,
      quantity: 5,
      reference: 'GR-001',
      notes: null,
    })
    expect(await screen.findByText('Entrada registrada: 5 UND de Casco de seguridad.')).toBeInTheDocument()
    expect(onSaved).toHaveBeenCalledWith(movement)
    expect(refreshAlerts).toHaveBeenCalledOnce()
    expect(screen.getByLabelText(/Cantidad/)).toHaveValue(null)
  })

  it('pide elegir un producto antes de registrar', async () => {
    const user = userEvent.setup()
    const createSpy = vi.spyOn(movementsApi, 'create')
    render(<MovementForm onCancel={() => {}} />)
    await vi.waitFor(() => expect(screen.getByLabelText('Almacén')).toHaveValue('1'))

    await user.type(screen.getByLabelText(/Cantidad/), '5')
    await user.click(screen.getByRole('button', { name: 'Registrar' }))

    expect(await screen.findByText('Elige un producto.')).toBeInTheDocument()
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('muestra el error de la API', async () => {
    const user = userEvent.setup()
    vi.spyOn(movementsApi, 'create').mockRejectedValue(new Error('Stock insuficiente.'))
    render(<MovementForm initialProductId={1} onCancel={() => {}} />)
    await screen.findByText('Disponible en el almacén: 8')

    await user.type(screen.getByLabelText(/Cantidad/), '5')
    await user.click(screen.getByRole('button', { name: 'Registrar' }))

    expect(await screen.findByText('Stock insuficiente.')).toBeInTheDocument()
    expect(refreshAlerts).not.toHaveBeenCalled()
  })

  it('Cerrar llama a onCancel', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<MovementForm onCancel={onCancel} />)

    await user.click(screen.getByRole('button', { name: 'Cerrar' }))

    expect(onCancel).toHaveBeenCalledOnce()
  })
})
