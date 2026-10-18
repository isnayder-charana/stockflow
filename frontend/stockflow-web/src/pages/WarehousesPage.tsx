import { useMemo, useRef, useState } from 'react'
import DataGrid, {
  type DataGridRef,
  Column,
  Editing,
  Form,
  HeaderFilter,
  MasterDetail,
  Popup,
  RequiredRule,
  SearchPanel,
  Sorting,
  StringLengthRule,
  Toolbar,
  Item as ToolbarItem,
} from 'devextreme-react/data-grid'
import { Item } from 'devextreme-react/form'
import CustomStore from 'devextreme/data/custom_store'
import type { InitNewRowEvent, MasterDetailTemplateData, RowPreparedEvent } from 'devextreme/ui/data_grid'
import { errorMessage, warehousesApi } from '../api/client.ts'
import { toWarehouseRequest } from '../api/requests.ts'
import type { Warehouse } from '../api/types.ts'
import { useAuth } from '../auth/AuthContext.tsx'
import KpiCards from '../components/KpiCards.tsx'
import PageHeader from '../components/PageHeader.tsx'
import StatusBadge from '../components/StatusBadge.tsx'
import { exportGridToExcel } from '../utils/exportExcel.ts'

function onRowPrepared(e: RowPreparedEvent<Warehouse>) {
  if (e.rowType === 'data' && !e.data.isActive) {
    e.rowElement.classList.add('row-inactive')
  }
}

const activeText = (w: { isActive: boolean }) => (w.isActive ? 'Activo' : 'Inactivo')

function ActiveCell({ data }: { data: { isActive: boolean } }) {
  return <StatusBadge tone={data.isActive ? 'ok' : 'muted'}>{activeText(data)}</StatusBadge>
}

function WarehouseStockDetail({ data }: { data: MasterDetailTemplateData<Warehouse> }) {
  const store = useMemo(
    () => new CustomStore({ key: 'productId', load: () => warehousesApi.getStock(data.data.id) }),
    [data.data.id],
  )

  return (
    <div className="detail-panel">
      <div className="detail-title">Stock en {data.data.name}</div>
      <DataGrid dataSource={store} columnAutoWidth noDataText="Sin stock registrado">
        <Sorting mode="multiple" />
        <Column dataField="sku" caption="SKU" width={110} />
        <Column dataField="productName" caption="Producto" defaultSortOrder="asc" />
        <Column dataField="unit" caption="Unidad" width={95} />
        <Column dataField="quantity" caption="Cantidad" dataType="number" />
      </DataGrid>
    </div>
  )
}

export default function WarehousesPage() {
  const { hasRole } = useAuth()
  const isAdmin = hasRole('Admin')
  const gridRef = useRef<DataGridRef<Warehouse, number>>(null)
  const [error, setError] = useState('')
  const [warehouses, setWarehouses] = useState<Warehouse[] | null>(null)

  const store = useMemo(
    () =>
      new CustomStore<Warehouse, number>({
        key: 'id',
        load: () =>
          warehousesApi
            .getAll()
            .then((list) => {
              setWarehouses(list)
              return list
            })
            .catch((err) => {
              setError(errorMessage(err))
              throw err
            }),
        insert: (values) => warehousesApi.create(toWarehouseRequest(values)),
        // La grilla solo envía los campos cambiados; se combinan con el registro actual.
        update: async (id, values) => {
          const current = await warehousesApi.getById(id)
          return warehousesApi.update(id, toWarehouseRequest({ ...current, ...values }))
        },
        remove: (id) => warehousesApi.remove(id),
      }),
    [],
  )

  // Un almacén con historial se desactiva en vez de borrarse: se recarga para reflejarlo.
  const onRowRemoved = () => gridRef.current?.instance().refresh()

  const active = warehouses?.filter((w) => w.isActive)

  const handleExport = () => {
    const grid = gridRef.current?.instance()
    if (grid) exportGridToExcel(grid, 'Almacenes', 'almacenes.xlsx')
  }

  return (
    <>
      <PageHeader title="Almacenes" subtitle="Despliega una fila para ver su stock por producto">
        <button className="btn btn-outline-success" onClick={handleExport}>
          Exportar a Excel
        </button>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => gridRef.current?.instance().addRow()}>
            + Nuevo almacén
          </button>
        )}
      </PageHeader>

      <KpiCards
        items={[
          { label: 'Almacenes activos', value: active?.length ?? null },
          { label: 'Inactivos', value: warehouses ? warehouses.length - active!.length : null },
          { label: 'Unidades en stock', value: active ? active.reduce((sum, w) => sum + w.totalUnits, 0) : null },
          { label: 'Activos sin stock', value: active?.filter((w) => w.totalUnits <= 0).length ?? null, tone: 'warning' },
        ]}
      />

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="grid-card">
        <DataGrid
          ref={gridRef}
          dataSource={store}
          showColumnLines={false}
          columnAutoWidth
          allowColumnResizing
          noDataText="No hay almacenes"
          onRowPrepared={onRowPrepared}
          onRowRemoved={onRowRemoved}
          onInitNewRow={(e: InitNewRowEvent<Warehouse, number>) => {
            e.data.isActive = true
          }}
        >
          <Sorting mode="multiple" />
          <HeaderFilter visible />
          <SearchPanel visible placeholder="Buscar…" />
          <Toolbar>
            <ToolbarItem name="searchPanel" location="before" />
          </Toolbar>
          <Editing
            mode="popup"
            allowAdding={isAdmin}
            allowUpdating={isAdmin}
            allowDeleting={isAdmin}
            useIcons
            confirmDelete
            texts={{
              confirmDeleteMessage:
                '¿Eliminar este almacén? Si tiene movimientos registrados, se desactivará en lugar de borrarse.',
            }}
          >
            <Popup title="Almacén" showTitle width={520} height="auto" />
            <Form colCount={1}>
              <Item dataField="code" />
              <Item dataField="name" />
              <Item dataField="location" editorType="dxTextArea" />
              <Item dataField="isActive" />
            </Form>
          </Editing>
          <MasterDetail enabled component={WarehouseStockDetail} />

          <Column dataField="code" caption="Código" width={110} defaultSortOrder="asc" cssClass="cell-code">
            <RequiredRule message="El código es obligatorio" />
            <StringLengthRule max={20} message="Máximo 20 caracteres" />
          </Column>
          <Column dataField="name" caption="Nombre">
            <RequiredRule message="El nombre es obligatorio" />
            <StringLengthRule max={100} message="Máximo 100 caracteres" />
          </Column>
          <Column dataField="location" caption="Ubicación">
            <StringLengthRule max={250} message="Máximo 250 caracteres" />
          </Column>
          <Column dataField="productCount" caption="Productos" dataType="number" allowEditing={false} />
          <Column dataField="totalUnits" caption="Unidades" dataType="number" allowEditing={false} />
          <Column dataField="isActive" caption="Estado" dataType="boolean" width={110} cellRender={ActiveCell} />
        </DataGrid>
      </div>
    </>
  )
}
