import { useCallback, useEffect, useRef, useState } from 'react'
import DataGrid, {
  type DataGridRef,
  Column,
  FilterRow,
  HeaderFilter,
  MasterDetail,
  Pager,
  Paging,
  SearchPanel,
  Sorting,
  Toolbar,
  Item as ToolbarItem,
} from 'devextreme-react/data-grid'
import type { MasterDetailTemplateData, RowPreparedEvent } from 'devextreme/ui/data_grid'
import { alertsApi, errorMessage } from '../api/client.ts'
import type { LowStockAlert } from '../api/types.ts'
import { useAlerts } from '../alerts/AlertsContext.tsx'
import { useAuth } from '../auth/AuthContext.tsx'
import KpiCards from '../components/KpiCards.tsx'
import MovementForm from '../components/MovementForm.tsx'
import PageHeader from '../components/PageHeader.tsx'
import StatusBadge from '../components/StatusBadge.tsx'
import { exportGridToExcel } from '../utils/exportExcel.ts'
import { filterButtonOptions } from '../utils/gridToolbar.ts'

const statusText = (row: LowStockAlert) => (row.totalStock <= 0 ? 'Agotado' : 'Bajo mínimo')

// Texto plano del stock por almacén: se ve en la grilla y se exporta igual a Excel.
const warehousesText = (row: LowStockAlert) =>
  row.warehouses.length ? row.warehouses.map((w) => `${w.warehouseName}: ${w.quantity}`).join(' · ') : 'Sin stock'

const supplierContact = (row: LowStockAlert) => [row.supplierPhone, row.supplierEmail].filter(Boolean).join(' · ')

function StatusCell({ data }: { data: LowStockAlert }) {
  const out = data.totalStock <= 0
  return <StatusBadge tone={out ? 'danger' : 'warning'}>{statusText(data)}</StatusBadge>
}

function onRowPrepared(e: RowPreparedEvent<LowStockAlert>) {
  if (e.rowType === 'data') e.rowElement.classList.add(e.data.totalStock <= 0 ? 'row-out-of-stock' : 'row-below-min')
}

function WarehousesDetail({ data }: { data: MasterDetailTemplateData<LowStockAlert> }) {
  const row = data.data
  return (
    <div className="detail-panel">
      <div className="detail-title">
        Stock de {row.productName} por almacén (mínimo total: {row.minStock} {row.unit})
      </div>
      <DataGrid dataSource={row.warehouses} keyExpr="warehouseId" columnAutoWidth noDataText="No hay stock en ningún almacén">
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
  const gridRef = useRef<DataGridRef<LowStockAlert, number>>(null)
  const [showFilters, setShowFilters] = useState(false)

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

  const outOfStock = alerts.filter((a) => a.totalStock <= 0).length
  const kpiValue = (n: number) => (loading ? null : n)

  // Al ocultar la fila de filtros se quitan sus filtros, para no dejar filas escondidas sin aviso.
  const toggleFilters = () => {
    if (showFilters) gridRef.current?.instance().clearFilter('row')
    setShowFilters(!showFilters)
  }

  const handleExport = () => {
    const grid = gridRef.current?.instance()
    if (grid) exportGridToExcel(grid, 'Alertas de stock', 'alertas-stock.xlsx')
  }

  return (
    <>
      <PageHeader
        title="Alertas de stock mínimo"
        subtitle="Productos activos cuyo stock total (sumando todos los almacenes) está por debajo del mínimo"
      >
        <button className="btn btn-outline-success" onClick={handleExport}>
          Exportar a Excel
        </button>
        <button className="btn btn-primary" onClick={handleRefresh} disabled={loading}>
          Actualizar
        </button>
      </PageHeader>

      <KpiCards
        items={[
          { label: 'Productos en alerta', value: kpiValue(alerts.length) },
          { label: 'Bajo stock mínimo', value: kpiValue(alerts.length - outOfStock), tone: 'warning' },
          { label: 'Agotados', value: kpiValue(outOfStock), tone: 'danger' },
          { label: 'Unidades faltantes', value: kpiValue(alerts.reduce((sum, a) => sum + a.shortage, 0)) },
        ]}
      />

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

      <div className="grid-card">
        <DataGrid
          ref={gridRef}
          dataSource={alerts}
          keyExpr="productId"
          showColumnLines={false}
          columnAutoWidth
          allowColumnResizing
          noDataText={loading ? 'Cargando…' : 'No hay alertas'}
          onRowPrepared={onRowPrepared}
        >
          <Sorting mode="multiple" />
          <FilterRow visible={showFilters} />
          <HeaderFilter visible />
          <SearchPanel visible placeholder="Buscar…" />
          <Paging defaultPageSize={20} />
          <Pager showPageSizeSelector allowedPageSizes={[10, 20, 50]} showInfo />
          <Toolbar>
            <ToolbarItem name="searchPanel" location="before" />
            <ToolbarItem
              location="after"
              widget="dxButton"
              options={filterButtonOptions(showFilters, toggleFilters)}
            />
          </Toolbar>
          <MasterDetail enabled component={WarehousesDetail} />

          <Column name="status" caption="Estado" width={120} calculateCellValue={statusText} cellRender={StatusCell} />
          <Column dataField="sku" caption="SKU" width={110} cssClass="cell-code" />
          <Column dataField="productName" caption="Producto" />
          <Column dataField="categoryName" caption="Categoría" />
          <Column dataField="totalStock" caption="Stock total" dataType="number" />
          <Column dataField="minStock" caption="Mínimo" dataType="number" />
          <Column dataField="shortage" caption="Faltante" dataType="number" cssClass="fw-semibold" />
          <Column dataField="unit" caption="Unidad" width={95} />
          <Column name="warehouses" caption="Por almacén" calculateCellValue={warehousesText} allowFiltering={false} />
          <Column dataField="supplierName" caption="Proveedor" />
          <Column name="supplierContact" caption="Contacto proveedor" calculateCellValue={supplierContact} allowFiltering={false} />
          {canRegister && (
            <Column name="actions" caption="" width={150} cellRender={ActionsCell} allowExporting={false} />
          )}
        </DataGrid>
      </div>
    </>
  )
}
