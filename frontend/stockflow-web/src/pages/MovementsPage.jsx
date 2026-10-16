import { useCallback, useEffect, useState } from 'react'
import DataGrid, {
  Column,
  Export,
  FilterRow,
  HeaderFilter,
  Lookup,
  Pager,
  Paging,
  SearchPanel,
  Sorting,
} from 'devextreme-react/data-grid'
import { FILES_ENABLED, MAX_FILE_BYTES, fileUrl, lookupsApi, movementsApi } from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'
import MovementForm from '../components/MovementForm.jsx'
import { excelExporter } from '../utils/exportExcel.js'

const onExporting = excelExporter('Movimientos', 'movimientos.xlsx')

const movementTypes = [
  { value: 'In', text: 'Entrada' },
  { value: 'Out', text: 'Salida' },
]

/** Fecha local en formato yyyy-MM-dd, para los inputs de tipo date. */
function toInputDate(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Inicio del día local de una fecha yyyy-MM-dd, más `addDays`, en ISO (UTC). */
function startOfDayIso(value, addDays = 0) {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d + addDays).toISOString()
}

function defaultRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 30)
  return { from: toInputDate(from), to: toInputDate(to) }
}

function TypeCell({ data }) {
  const isIn = data.type === 'In'
  return <span className={`badge ${isIn ? 'text-bg-success' : 'text-bg-danger'}`}>{isIn ? 'Entrada' : 'Salida'}</span>
}

/** Enlace a la guía de remisión, o botón para adjuntarla si aún no tiene. */
function DocumentCell({ data, canRegister, onUpload }) {
  if (data.documentUrl)
    return (
      <a href={fileUrl(data.documentUrl)} target="_blank" rel="noreferrer">
        Ver guía
      </a>
    )
  if (!canRegister) return null
  return (
    <label className="btn btn-link btn-sm p-0 mb-0">
      Adjuntar
      <input
        type="file"
        hidden
        accept="application/pdf,image/jpeg,image/png"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) onUpload(data, file)
        }}
      />
    </label>
  )
}

export default function MovementsPage() {
  const { hasRole } = useAuth()
  const canRegister = hasRole('Admin', 'Almacenero')

  const [filters, setFilters] = useState({ ...defaultRange(), warehouseId: '' })
  const [warehouses, setWarehouses] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async (current) => {
    setLoading(true)
    setError('')
    try {
      const data = await movementsApi.getAll({
        from: current.from ? startOfDayIso(current.from) : null,
        to: current.to ? startOfDayIso(current.to, 1) : null,
        warehouseId: current.warehouseId,
      })
      setMovements(data.map((m) => ({ ...m, date: new Date(m.date) })))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    lookupsApi.warehouses().then(setWarehouses).catch((err) => setError(err.message))
    load(filters)
    // Solo al montar; luego se recarga con el botón Buscar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleUpload = async (movement, file) => {
    setError('')
    if (file.size > MAX_FILE_BYTES) {
      setError('La guía supera los 4 MB.')
      return
    }
    try {
      const updated = await movementsApi.uploadDocument(movement.id, file)
      setMovements((list) => list.map((m) => (m.id === updated.id ? { ...m, documentUrl: updated.documentUrl } : m)))
    } catch (err) {
      setError(err.message)
    }
  }

  const setFilter = (field) => (e) => setFilters((f) => ({ ...f, [field]: e.target.value }))

  const handleSearch = (e) => {
    e.preventDefault()
    load(filters)
  }

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h4 mb-0">Movimientos de stock</h1>
        {canRegister && !showForm && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            Registrar movimiento
          </button>
        )}
      </div>

      {showForm && <MovementForm onSaved={() => load(filters)} onCancel={() => setShowForm(false)} />}

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card shadow-sm">
        <div className="card-body">
          <form className="row g-2 align-items-end mb-3" onSubmit={handleSearch}>
            <div className="col-sm-3 col-lg-2">
              <label htmlFor="from" className="form-label small mb-1">
                Desde
              </label>
              <input id="from" type="date" className="form-control form-control-sm" value={filters.from} onChange={setFilter('from')} />
            </div>
            <div className="col-sm-3 col-lg-2">
              <label htmlFor="to" className="form-label small mb-1">
                Hasta
              </label>
              <input id="to" type="date" className="form-control form-control-sm" value={filters.to} onChange={setFilter('to')} />
            </div>
            <div className="col-sm-3 col-lg-2">
              <label htmlFor="filter-warehouse" className="form-label small mb-1">
                Almacén
              </label>
              <select
                id="filter-warehouse"
                className="form-select form-select-sm"
                value={filters.warehouseId}
                onChange={setFilter('warehouseId')}
              >
                <option value="">Todos</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-auto">
              <button type="submit" className="btn btn-sm btn-outline-primary" disabled={loading}>
                Buscar
              </button>
            </div>
          </form>

          <DataGrid
            dataSource={movements}
            keyExpr="id"
            showBorders
            rowAlternationEnabled
            columnAutoWidth
            allowColumnResizing
            noDataText={loading ? 'Cargando…' : 'No hay movimientos en este rango'}
            onExporting={onExporting}
          >
            <Sorting mode="multiple" />
            <FilterRow visible />
            <HeaderFilter visible />
            <SearchPanel visible placeholder="Buscar…" />
            <Paging defaultPageSize={20} />
            <Pager showPageSizeSelector allowedPageSizes={[10, 20, 50, 100]} showInfo />
            <Export enabled formats={['xlsx']} />

            <Column dataField="date" caption="Fecha" dataType="datetime" format="dd/MM/yyyy HH:mm" defaultSortOrder="desc" />
            <Column dataField="type" caption="Tipo" width={100} cellRender={TypeCell}>
              <Lookup dataSource={movementTypes} valueExpr="value" displayExpr="text" />
            </Column>
            <Column dataField="sku" caption="SKU" width={110} />
            <Column dataField="productName" caption="Producto" />
            <Column dataField="warehouseName" caption="Almacén" />
            <Column dataField="quantity" caption="Cantidad" dataType="number" />
            <Column dataField="unit" caption="Unidad" width={80} />
            <Column dataField="reference" caption="Referencia" />
            <Column dataField="notes" caption="Observaciones" />
            <Column dataField="username" caption="Usuario" />
            <Column
              caption="Guía"
              visible={FILES_ENABLED}
              width={90}
              allowExporting={false}
              allowFiltering={false}
              allowSorting={false}
              cellRender={({ data }) => (
                <DocumentCell data={data} canRegister={canRegister} onUpload={handleUpload} />
              )}
            />
          </DataGrid>
        </div>
      </div>
    </>
  )
}
