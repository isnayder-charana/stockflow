import { useMemo, useRef, useState } from 'react'
import DataGrid, {
  type DataGridRef,
  Column,
  EmailRule,
  Editing,
  FilterRow,
  Form,
  HeaderFilter,
  MasterDetail,
  Pager,
  Paging,
  PatternRule,
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
import { errorMessage, suppliersApi } from '../api/client.ts'
import { toSupplierRequest } from '../api/requests.ts'
import type { Supplier } from '../api/types.ts'
import { useAuth } from '../auth/AuthContext.tsx'
import KpiCards from '../components/KpiCards.tsx'
import PageHeader from '../components/PageHeader.tsx'
import StatusBadge from '../components/StatusBadge.tsx'
import { exportGridToExcel } from '../utils/exportExcel.ts'
import { filterButtonOptions } from '../utils/gridToolbar.ts'

const currency = { type: 'currency', currency: 'PEN', precision: 2 }

function onRowPrepared(e: RowPreparedEvent<Supplier>) {
  if (e.rowType === 'data' && !e.data.isActive) {
    e.rowElement.classList.add('row-inactive')
  }
}

function ActiveCell({ data }: { data: { isActive: boolean } }) {
  return <StatusBadge tone={data.isActive ? 'ok' : 'muted'}>{data.isActive ? 'Activo' : 'Inactivo'}</StatusBadge>
}

function SupplierProductsDetail({ data }: { data: MasterDetailTemplateData<Supplier> }) {
  const store = useMemo(
    () => new CustomStore({ key: 'id', load: () => suppliersApi.getProducts(data.data.id) }),
    [data.data.id],
  )

  return (
    <div className="detail-panel">
      <div className="detail-title">Productos de {data.data.name}</div>
      <DataGrid dataSource={store} columnAutoWidth noDataText="Sin productos asociados">
        <Sorting mode="multiple" />
        <Column dataField="sku" caption="SKU" width={110} cssClass="cell-code" />
        <Column dataField="name" caption="Producto" defaultSortOrder="asc" />
        <Column dataField="unit" caption="Unidad" width={95} />
        <Column dataField="unitPrice" caption="Precio" dataType="number" format={currency} />
        <Column dataField="totalStock" caption="Stock" dataType="number" />
        <Column dataField="isActive" caption="Activo" dataType="boolean" width={90} />
      </DataGrid>
    </div>
  )
}

export default function SuppliersPage() {
  const { hasRole } = useAuth()
  const isAdmin = hasRole('Admin')
  const gridRef = useRef<DataGridRef<Supplier, number>>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [error, setError] = useState('')
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null)

  const store = useMemo(
    () =>
      new CustomStore<Supplier, number>({
        key: 'id',
        load: () =>
          suppliersApi
            .getAll()
            .then((list) => {
              setSuppliers(list)
              return list
            })
            .catch((err) => {
              setError(errorMessage(err))
              throw err
            }),
        insert: (values) => suppliersApi.create(toSupplierRequest(values)),
        // La grilla solo envía los campos cambiados; se combinan con el registro actual.
        update: async (id, values) => {
          const current = await suppliersApi.getById(id)
          return suppliersApi.update(id, toSupplierRequest({ ...current, ...values }))
        },
        remove: (id) => suppliersApi.remove(id),
      }),
    [],
  )

  // Un proveedor con productos se desactiva en vez de borrarse: se recarga para reflejarlo.
  const onRowRemoved = () => gridRef.current?.instance().refresh()

  const active = suppliers?.filter((x) => x.isActive)

  // Al ocultar la fila de filtros se quitan sus filtros, para no dejar filas escondidas sin aviso.
  const toggleFilters = () => {
    if (showFilters) gridRef.current?.instance().clearFilter('row')
    setShowFilters(!showFilters)
  }

  const handleExport = () => {
    const grid = gridRef.current?.instance()
    if (grid) exportGridToExcel(grid, 'Proveedores', 'proveedores.xlsx')
  }

  return (
    <>
      <PageHeader title="Proveedores" subtitle="Despliega una fila para ver sus productos">
        <button className="btn btn-outline-success" onClick={handleExport}>
          Exportar a Excel
        </button>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => gridRef.current?.instance().addRow()}>
            + Nuevo proveedor
          </button>
        )}
      </PageHeader>

      <KpiCards
        items={[
          { label: 'Proveedores activos', value: active?.length ?? null },
          { label: 'Inactivos', value: suppliers ? suppliers.length - active!.length : null },
          { label: 'Productos asociados', value: suppliers ? suppliers.reduce((sum, x) => sum + x.productCount, 0) : null },
          { label: 'Activos sin productos', value: active?.filter((x) => x.productCount === 0).length ?? null, tone: 'warning' },
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
          noDataText="No hay proveedores"
          onRowPrepared={onRowPrepared}
          onRowRemoved={onRowRemoved}
          onInitNewRow={(e: InitNewRowEvent<Supplier, number>) => {
            e.data.isActive = true
          }}
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
          <Editing
            mode="popup"
            allowAdding={isAdmin}
            allowUpdating={isAdmin}
            allowDeleting={isAdmin}
            useIcons
            confirmDelete
            texts={{
              confirmDeleteMessage:
                '¿Eliminar este proveedor? Si tiene productos asociados, se desactivará en lugar de borrarse.',
            }}
          >
            <Popup title="Proveedor" showTitle width={720} height="auto" />
            <Form colCount={2}>
              <Item dataField="ruc" />
              <Item dataField="name" />
              <Item dataField="contactName" />
              <Item dataField="phone" />
              <Item dataField="email" />
              <Item dataField="isActive" />
              <Item dataField="address" editorType="dxTextArea" colSpan={2} />
            </Form>
          </Editing>
          <MasterDetail enabled component={SupplierProductsDetail} />

          <Column dataField="ruc" caption="RUC" width={120} editorOptions={{ maxLength: 11 }} cssClass="cell-code">
            <RequiredRule message="El RUC es obligatorio" />
            <PatternRule pattern={/^\d{11}$/} message="El RUC debe tener 11 dígitos" />
          </Column>
          <Column dataField="name" caption="Razón social" defaultSortOrder="asc">
            <RequiredRule message="La razón social es obligatoria" />
            <StringLengthRule max={150} message="Máximo 150 caracteres" />
          </Column>
          <Column dataField="contactName" caption="Contacto">
            <StringLengthRule max={120} message="Máximo 120 caracteres" />
          </Column>
          <Column dataField="phone" caption="Teléfono" width={120}>
            <StringLengthRule max={20} message="Máximo 20 caracteres" />
          </Column>
          <Column dataField="email" caption="Correo">
            <EmailRule message="El correo no es válido" />
            <StringLengthRule max={120} message="Máximo 120 caracteres" />
          </Column>
          <Column dataField="address" caption="Dirección" visible={false}>
            <StringLengthRule max={250} message="Máximo 250 caracteres" />
          </Column>
          <Column dataField="productCount" caption="Productos" dataType="number" allowEditing={false} />
          <Column dataField="isActive" caption="Estado" dataType="boolean" width={110} cellRender={ActiveCell} />
        </DataGrid>
      </div>
    </>
  )
}
