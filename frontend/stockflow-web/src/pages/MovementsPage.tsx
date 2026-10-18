import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import DataGrid, {
  type DataGridRef,
  Column,
  FilterRow,
  HeaderFilter,
  Lookup,
  Pager,
  Paging,
  SearchPanel,
  Sorting,
  Toolbar,
  Item as ToolbarItem,
} from 'devextreme-react/data-grid'
import { FILES_ENABLED, MAX_FILE_BYTES, errorMessage, fileUrl, lookupsApi, movementsApi } from '../api/client.ts'
import type { LookupOption, StockMovement } from '../api/types.ts'
import { useAuth } from '../auth/AuthContext.tsx'
import KpiCards from '../components/KpiCards.tsx'
import MovementForm from '../components/MovementForm.tsx'
import PageHeader from '../components/PageHeader.tsx'
import StatusBadge from '../components/StatusBadge.tsx'
import { startOfDayIso, toInputDate } from '../utils/dates.ts'
import { exportGridToExcel } from '../utils/exportExcel.ts'
import { filterButtonOptions } from '../utils/gridToolbar.ts'

/** Movimiento con la fecha ya convertida, para que la grilla filtre y ordene por fecha. */
type MovementRow = Omit<StockMovement, 'date'> & { date: Date }

interface Filters {
  from: string
  to: string
  warehouseId: string
}

const movementTypes = [
  { value: 'In', text: 'Entrada' },
  { value: 'Out', text: 'Salida' },
]

function defaultRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 30)
  return { from: toInputDate(from), to: toInputDate(to) }
}

function TypeCell({ data }: { data: MovementRow }) {
  const isIn = data.type === 'In'
  return <StatusBadge tone={isIn ? 'in' : 'out'}>{isIn ? 'Entrada' : 'Salida'}</StatusBadge>
}

/** Enlace a la guía de remisión, o botón para adjuntarla si aún no tiene. */
interface DocumentCellProps {
  data: MovementRow
  canRegister: boolean
  onUpload: (movement: MovementRow, file: File) => void
}

function DocumentCell({ data, canRegister, onUpload }: DocumentCellProps) {
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

  const [filters, setFilters] = useState<Filters>({ ...defaultRange(), warehouseId: '' })
  const [warehouses, setWarehouses] = useState<LookupOption[]>([])
  const [movements, setMovements] = useState<MovementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const gridRef = useRef<DataGridRef<MovementRow, number>>(null)
  const [showFilters, setShowFilters] = useState(false)

  const load = useCallback(async (current: Filters) => {
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
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    lookupsApi.warehouses().then(setWarehouses).catch((err) => setError(errorMessage(err)))
    load(filters)
    // Solo al montar; luego se recarga con el botón Buscar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleUpload = async (movement: MovementRow, file: File) => {
    setError('')
    if (file.size > MAX_FILE_BYTES) {
      setError('La guía supera los 4 MB.')
      return
    }
    try {
      const updated = await movementsApi.uploadDocument(movement.id, file)
      setMovements((list) => list.map((m) => (m.id === updated.id ? { ...m, documentUrl: updated.documentUrl } : m)))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const setFilter = (field: keyof Filters) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFilters((f) => ({ ...f, [field]: e.target.value }))

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    load(filters)
  }

  // Indicadores del rango consultado.
  const kpis = useMemo(() => {
    const ins = movements.filter((m) => m.type === 'In')
    return {
      total: movements.length,
      ins: ins.length,
      outs: movements.length - ins.length,
      products: new Set(movements.map((m) => m.productId)).size,
    }
  }, [movements])
  const kpiValue = (n: number) => (loading ? null : n)

  // Al ocultar la fila de filtros se quitan sus filtros, para no dejar filas escondidas sin aviso.
  const toggleFilters = () => {
    if (showFilters) gridRef.current?.instance().clearFilter('row')
    setShowFilters(!showFilters)
  }

  const handleExport = () => {
    const grid = gridRef.current?.instance()
    if (grid) exportGridToExcel(grid, 'Movimientos', 'movimientos.xlsx')
  }

  return (
    <>
      <PageHeader title="Movimientos de stock">
        <button className="btn btn-outline-success" onClick={handleExport}>
          Exportar a Excel
        </button>
        {canRegister && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)} disabled={showForm}>
            + Registrar movimiento
          </button>
        )}
      </PageHeader>

      <KpiCards
        items={[
          { label: 'Movimientos en el rango', value: kpiValue(kpis.total) },
          { label: 'Entradas', value: kpiValue(kpis.ins), tone: 'success' },
          { label: 'Salidas', value: kpiValue(kpis.outs), tone: 'danger' },
          { label: 'Productos movidos', value: kpiValue(kpis.products) },
        ]}
      />

      {showForm && <MovementForm onSaved={() => load(filters)} onCancel={() => setShowForm(false)} />}

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="grid-card">
        <form className="row g-2 align-items-end grid-filters" onSubmit={handleSearch}>
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
          ref={gridRef}
          dataSource={movements}
          keyExpr="id"
          showColumnLines={false}
          columnAutoWidth
          allowColumnResizing
          noDataText={loading ? 'Cargando…' : 'No hay movimientos en este rango'}
        >
          <Sorting mode="multiple" />
          <FilterRow visible={showFilters} />
          <HeaderFilter visible />
          <SearchPanel visible placeholder="Buscar…" />
          <Paging defaultPageSize={20} />
          <Pager showPageSizeSelector allowedPageSizes={[10, 20, 50, 100]} showInfo />
          <Toolbar>
            <ToolbarItem name="searchPanel" location="before" />
            <ToolbarItem
              location="after"
              widget="dxButton"
              options={filterButtonOptions(showFilters, toggleFilters)}
            />
          </Toolbar>

          <Column dataField="date" caption="Fecha" dataType="datetime" format="dd/MM/yyyy HH:mm" defaultSortOrder="desc" />
          <Column dataField="type" caption="Tipo" width={100} cellRender={TypeCell}>
            <Lookup dataSource={movementTypes} valueExpr="value" displayExpr="text" />
          </Column>
          <Column dataField="sku" caption="SKU" width={110} cssClass="cell-code" />
          <Column dataField="productName" caption="Producto" />
          <Column dataField="warehouseName" caption="Almacén" />
          <Column dataField="quantity" caption="Cantidad" dataType="number" />
          <Column dataField="unit" caption="Unidad" width={95} />
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
            cellRender={({ data }: { data: MovementRow }) => (
              <DocumentCell data={data} canRegister={canRegister} onUpload={handleUpload} />
            )}
          />
        </DataGrid>
      </div>
    </>
  )
}
