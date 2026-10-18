import { useMemo, useRef, useState } from 'react'
import DataGrid, {
  type DataGridRef,
  Column,
  Editing,
  Export,
  Form,
  HeaderFilter,
  MasterDetail,
  Popup,
  RequiredRule,
  SearchPanel,
  Sorting,
  StringLengthRule,
} from 'devextreme-react/data-grid'
import { Item } from 'devextreme-react/form'
import CustomStore from 'devextreme/data/custom_store'
import type { InitNewRowEvent, MasterDetailTemplateData, RowPreparedEvent } from 'devextreme/ui/data_grid'
import { errorMessage, warehousesApi } from '../api/client.ts'
import { toWarehouseRequest } from '../api/requests.ts'
import type { Warehouse } from '../api/types.ts'
import { useAuth } from '../auth/AuthContext.tsx'
import { excelExporter } from '../utils/exportExcel.ts'

const onExporting = excelExporter('Almacenes', 'almacenes.xlsx')

function onRowPrepared(e: RowPreparedEvent<Warehouse>) {
  if (e.rowType === 'data' && !e.data.isActive) {
    e.rowElement.classList.add('text-muted')
  }
}

function WarehouseStockDetail({ data }: { data: MasterDetailTemplateData<Warehouse> }) {
  const store = useMemo(
    () => new CustomStore({ key: 'productId', load: () => warehousesApi.getStock(data.data.id) }),
    [data.data.id],
  )

  return (
    <div className="p-2">
      <div className="fw-semibold mb-2">Stock en {data.data.name}</div>
      <DataGrid dataSource={store} showBorders columnAutoWidth noDataText="Sin stock registrado">
        <Sorting mode="multiple" />
        <Column dataField="sku" caption="SKU" width={110} />
        <Column dataField="productName" caption="Producto" defaultSortOrder="asc" />
        <Column dataField="unit" caption="Unidad" width={80} />
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

  const store = useMemo(
    () =>
      new CustomStore<Warehouse, number>({
        key: 'id',
        load: () => warehousesApi.getAll().catch((err) => {
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

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h4 mb-0">Almacenes</h1>
        <small className="text-muted">Despliega una fila para ver su stock por producto</small>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card shadow-sm">
        <div className="card-body">
          <DataGrid
            ref={gridRef}
            dataSource={store}
            showBorders
            rowAlternationEnabled
            columnAutoWidth
            allowColumnResizing
            noDataText="No hay almacenes"
            onExporting={onExporting}
            onRowPrepared={onRowPrepared}
            onRowRemoved={onRowRemoved}
            onInitNewRow={(e: InitNewRowEvent<Warehouse, number>) => {
              e.data.isActive = true
            }}
          >
            <Sorting mode="multiple" />
            <HeaderFilter visible />
            <SearchPanel visible placeholder="Buscar…" />
            <Export enabled formats={['xlsx']} />
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

            <Column dataField="code" caption="Código" width={110} defaultSortOrder="asc">
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
            <Column
              dataField="isActive"
              caption="Activo"
              dataType="boolean"
              width={100}
            />
          </DataGrid>
        </div>
      </div>
    </>
  )
}
