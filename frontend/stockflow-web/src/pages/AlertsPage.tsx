import { useCallback, useEffect, useState } from 'react'
import DataGrid, {
  Column,
  Export,
  FilterRow,
  HeaderFilter,
  MasterDetail,
  Pager,
  Paging,
  SearchPanel,
  Sorting,
} from 'devextreme-react/data-grid'
import type { MasterDetailTemplateData, RowPreparedEvent } from 'devextreme/ui/data_grid'
import { alertsApi, errorMessage } from '../api/client.ts'
import type { LowStockAlert } from '../api/types.ts'
import { useAlerts } from '../alerts/AlertsContext.tsx'
import { useAuth } from '../auth/AuthContext.tsx'
import MovementForm from '../components/MovementForm.tsx'
import { excelExporter } from '../utils/exportExcel.ts'

const onExporting = excelExporter('Alertas de stock', 'alertas-stock.xlsx')

const statusText = (row: LowStockAlert) => (row.totalStock <= 0 ? 'Agotado' : 'Bajo mínimo')

// Texto plano del stock por almacén: se ve en la grilla y se exporta igual a Excel.
const warehousesText = (row: LowStockAlert) =>
  row.warehouses.length ? row.warehouses.map((w) => `${w.warehouseName}: ${w.quantity}`).join(' · ') : 'Sin stock'

const supplierContact = (row: LowStockAlert) => [row.supplierPhone, row.supplierEmail].filter(Boolean).join(' · ')

function StatusCell({ data }: { data: LowStockAlert }) {
  const out = data.totalStock <= 0
  return <span className={`badge ${out ? 'text-bg-danger' : 'text-bg-warning'}`}>{statusText(data)}</span>
}

function onRowPrepared(e: RowPreparedEvent<LowStockAlert>) {
  if (e.rowType === 'data') e.rowElement.classList.add(e.data.totalStock <= 0 ? 'row-out-of-stock' : 'row-below-min')
}

function WarehousesDetail({ data }: { data: MasterDetailTemplateData<LowStockAlert> }) {
  const row = data.data
  return (
    <div className="p-2">
      <div className="fw-semibold mb-2">
        Stock de {row.productName} por almacén (mínimo total: {row.minStock} {row.unit})
      </div>
      <DataGrid dataSource={row.warehouses} keyExpr="warehouseId" showBorders columnAutoWidth noDataText="No hay stock en ningún almacén">
        <Column dataField="warehouseName" caption="Almacén" defaultSortOrder="asc" />
        <Column dataField="quantity" caption="Cantidad" dataType="number" />
        <Column dataField="isActive" caption="Almacén activo" dataType="boolean" width={130} />
      </DataGrid>
    </div>
  )
}

export default function AlertsPage() {
  const { hasRole } = useAuth()
  const canRegister = hasRole('Admin', 'Almacenero')
  const { refresh: refreshCount } = useAlerts()

  const [alerts, setAlerts] = useState<LowStockAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [restockProductId, setRestockProductId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setAlerts(await alertsApi.lowStock())
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleRefresh = () => {
    load()
    refreshCount()
  }

  // Referencia estable: si cambia en cada render, DevExtreme vuelve a armar las columnas.
  const ActionsCell = useCallback(
    ({ data }: { data: LowStockAlert }) => (
      <button className="btn btn-sm btn-outline-success py-0" onClick={() => setRestockProductId(data.productId)}>
        Registrar entrada
      </button>
    ),
    [],
  )

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h1 className="h4 mb-0">Alertas de stock mínimo</h1>
          <small className="text-muted">
            Productos activos cuyo stock total (sumando todos los almacenes) está por debajo del mínimo
          </small>
        </div>
        <button className="btn btn-outline-primary" onClick={handleRefresh} disabled={loading}>
          Actualizar
        </button>
      </div>

      {restockProductId !== null && (
        <MovementForm
          key={restockProductId}
          initialProductId={restockProductId}
          onSaved={load}
          onCancel={() => setRestockProductId(null)}
        />
      )}

      {error && <div className="alert alert-danger">{error}</div>}

      {!loading && !error && alerts.length === 0 && (
        <div className="alert alert-success">Todo en orden: ningún producto está por debajo de su stock mínimo.</div>
      )}

      <div className="card shadow-sm">
        <div className="card-body">
          <DataGrid
            dataSource={alerts}
            keyExpr="productId"
            showBorders
            columnAutoWidth
            allowColumnResizing
            noDataText={loading ? 'Cargando…' : 'No hay alertas'}
            onExporting={onExporting}
            onRowPrepared={onRowPrepared}
          >
            <Sorting mode="multiple" />
            <FilterRow visible />
            <HeaderFilter visible />
            <SearchPanel visible placeholder="Buscar…" />
            <Paging defaultPageSize={20} />
            <Pager showPageSizeSelector allowedPageSizes={[10, 20, 50]} showInfo />
            <Export enabled formats={['xlsx']} />
            <MasterDetail enabled component={WarehousesDetail} />

            <Column name="status" caption="Estado" width={120} calculateCellValue={statusText} cellRender={StatusCell} />
            <Column dataField="sku" caption="SKU" width={110} />
            <Column dataField="productName" caption="Producto" />
            <Column dataField="categoryName" caption="Categoría" />
            <Column dataField="totalStock" caption="Stock total" dataType="number" />
            <Column dataField="minStock" caption="Mínimo" dataType="number" />
            <Column dataField="shortage" caption="Faltante" dataType="number" cssClass="fw-semibold" />
            <Column dataField="unit" caption="Unidad" width={80} />
            <Column name="warehouses" caption="Por almacén" calculateCellValue={warehousesText} allowFiltering={false} />
            <Column dataField="supplierName" caption="Proveedor" />
            <Column name="supplierContact" caption="Contacto proveedor" calculateCellValue={supplierContact} allowFiltering={false} />
            {canRegister && (
              <Column name="actions" caption="" width={150} cellRender={ActionsCell} allowExporting={false} />
            )}
          </DataGrid>
        </div>
      </div>
    </>
  )
}
