import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import SelectBox from 'devextreme-react/select-box'
import { useAlerts } from '../alerts/AlertsContext.tsx'
import {
  FILES_ENABLED,
  MAX_FILE_BYTES,
  errorMessage,
  lookupsApi,
  movementsApi,
  productsApi,
  warehousesApi,
} from '../api/client.ts'
import type { LookupOption, MovementType, Product, StockMovement, WarehouseStock } from '../api/types.ts'

interface MovementFormState {
  type: MovementType
  /** Valor del select (texto); '' mientras no se elija. */
  warehouseId: string
  productId: number | null
  quantity: string
  reference: string
  notes: string
}

type TextField = 'warehouseId' | 'quantity' | 'reference' | 'notes'

const emptyForm: MovementFormState = { type: 'In', warehouseId: '', productId: null, quantity: '', reference: '', notes: '' }

const productLabel = (p: Product | null | undefined) => (p ? `${p.sku} · ${p.name}` : '')

/** Formulario para registrar una entrada o salida de stock. `initialProductId` preselecciona el producto. */
interface MovementFormProps {
  onSaved?: (movement: StockMovement) => void
  onCancel: () => void
  initialProductId?: number | null
}

export default function MovementForm({ onSaved, onCancel, initialProductId = null }: MovementFormProps) {
  const { refresh: refreshAlerts } = useAlerts()
  const [form, setForm] = useState<MovementFormState>(() => ({ ...emptyForm, productId: initialProductId }))
  const [warehouses, setWarehouses] = useState<LookupOption[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [stock, setStock] = useState<WarehouseStock[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const documentInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([lookupsApi.warehouses(), productsApi.getAll()])
      .then(([w, p]) => {
        setWarehouses(w)
        setProducts(p.filter((x) => x.isActive))
        if (w.length === 1) setForm((f) => ({ ...f, warehouseId: String(w[0].id) }))
      })
      .catch((err) => setError(errorMessage(err)))
  }, [])

  // Stock del almacén elegido, para mostrar lo disponible antes de una salida.
  useEffect(() => {
    if (!form.warehouseId) {
      setStock([])
      return
    }
    warehousesApi
      .getStock(form.warehouseId)
      .then(setStock)
      .catch((err) => setError(errorMessage(err)))
  }, [form.warehouseId])

  const set = (field: TextField) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const product = products.find((p) => p.id === form.productId)
  const available = form.productId ? (stock.find((s) => s.productId === form.productId)?.quantity ?? 0) : null
  const quantity = Number(form.quantity)
  const exceeds = form.type === 'Out' && available !== null && quantity > available

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!form.productId) {
      setError('Elige un producto.')
      return
    }
    if (documentFile && documentFile.size > MAX_FILE_BYTES) {
      setError('La guía supera los 4 MB.')
      return
    }
    setSaving(true)
    try {
      const saved = await movementsApi.create({
        type: form.type,
        warehouseId: Number(form.warehouseId),
        productId: form.productId,
        quantity,
        reference: form.reference || null,
        notes: form.notes || null,
      })
      let message = `${saved.type === 'In' ? 'Entrada' : 'Salida'} registrada: ${saved.quantity} ${saved.unit} de ${saved.productName}.`
      if (documentFile) {
        // El movimiento ya quedó guardado; si la guía falla se puede adjuntar luego desde la grilla.
        try {
          await movementsApi.uploadDocument(saved.id, documentFile)
          message += ' Guía adjuntada.'
        } catch (err) {
          setError(`El movimiento se registró, pero la guía no se pudo subir: ${errorMessage(err)} Adjúntala desde la grilla.`)
        }
      }
      setSuccess(message)
      setForm((f) => ({ ...f, quantity: '', reference: '', notes: '' }))
      setDocumentFile(null)
      if (documentInput.current) documentInput.current.value = ''
      setStock(await warehousesApi.getStock(form.warehouseId))
      refreshAlerts()
      onSaved?.(saved)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card shadow-sm mb-3">
      <div className="card-body">
        <div className="fw-semibold mb-3">Registrar movimiento</div>
        {error && <div className="alert alert-danger py-2">{error}</div>}
        {success && <div className="alert alert-success py-2">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label d-block">Tipo</label>
              <div className="btn-group w-100" role="group">
                <input
                  type="radio"
                  className="btn-check"
                  id="type-in"
                  checked={form.type === 'In'}
                  onChange={() => setForm((f) => ({ ...f, type: 'In' }))}
                />
                <label className="btn btn-outline-success" htmlFor="type-in">
                  Entrada
                </label>
                <input
                  type="radio"
                  className="btn-check"
                  id="type-out"
                  checked={form.type === 'Out'}
                  onChange={() => setForm((f) => ({ ...f, type: 'Out' }))}
                />
                <label className="btn btn-outline-danger" htmlFor="type-out">
                  Salida
                </label>
              </div>
            </div>

            <div className="col-md-3">
              <label htmlFor="warehouse" className="form-label">
                Almacén
              </label>
              <select
                id="warehouse"
                className="form-select"
                value={form.warehouseId}
                onChange={set('warehouseId')}
                required
              >
                <option value="">Elige…</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label">Producto</label>
              <SelectBox
                dataSource={products}
                valueExpr="id"
                displayExpr={productLabel}
                searchEnabled
                searchExpr={['sku', 'name']}
                placeholder="Busca por SKU o nombre…"
                value={form.productId}
                onValueChanged={(e) => setForm((f) => ({ ...f, productId: e.value }))}
                showClearButton
              />
            </div>

            <div className="col-md-3">
              <label htmlFor="quantity" className="form-label">
                Cantidad {product && <span className="text-muted">({product.unit})</span>}
              </label>
              <input
                id="quantity"
                type="number"
                min="1"
                step="1"
                className={`form-control ${exceeds ? 'is-invalid' : ''}`}
                value={form.quantity}
                onChange={set('quantity')}
                required
              />
              {available !== null && (
                <div className={exceeds ? 'invalid-feedback d-block' : 'form-text'}>
                  Disponible en el almacén: {available}
                </div>
              )}
            </div>

            <div className="col-md-3">
              <label htmlFor="reference" className="form-label">
                Referencia
              </label>
              <input
                id="reference"
                className="form-control"
                maxLength={60}
                placeholder="Guía, OC, vale…"
                value={form.reference}
                onChange={set('reference')}
              />
            </div>

            <div className="col-md-6">
              <label htmlFor="notes" className="form-label">
                Observaciones
              </label>
              <input
                id="notes"
                className="form-control"
                maxLength={500}
                value={form.notes}
                onChange={set('notes')}
              />
            </div>

            {FILES_ENABLED && (
              <div className="col-md-6">
                <label htmlFor="document" className="form-label">
                  Guía de remisión <span className="text-muted">(opcional)</span>
                </label>
                <input
                  id="document"
                  ref={documentInput}
                  type="file"
                  className="form-control"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)}
                />
                <div className="form-text">PDF, JPG o PNG, hasta 4 MB</div>
              </div>
            )}
          </div>

          <div className="d-flex gap-2 justify-content-end mt-3">
            <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
              Cerrar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || exceeds}>
              {saving ? 'Guardando…' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
