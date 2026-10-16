import { useMemo, useRef, useState } from 'react'
import DataGrid, {
  Column,
  EmailRule,
  Editing,
  Export,
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
} from 'devextreme-react/data-grid'
import { Item } from 'devextreme-react/form'
import CustomStore from 'devextreme/data/custom_store'
import { suppliersApi } from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { excelExporter } from '../utils/exportExcel.js'

const currency = { type: 'currency', currency: 'PEN', precision: 2 }

const onExporting = excelExporter('Proveedores', 'proveedores.xlsx')

function toRequest(supplier) {
  return {
    name: supplier.name,
    ruc: supplier.ruc,
    contactName: supplier.contactName || null,
    phone: supplier.phone || null,
    email: supplier.email || null,
    address: supplier.address || null,
    isActive: supplier.isActive ?? true,
  }
}

function onRowPrepared(e) {
  if (e.rowType === 'data' && !e.data.isActive) {
    e.rowElement.classList.add('text-muted')
  }
}

function SupplierProductsDetail({ data }) {
  const store = useMemo(
    () => new CustomStore({ key: 'id', load: () => suppliersApi.getProducts(data.data.id) }),
    [data.data.id],
  )

  return (
    <div className="p-2">
      <div className="fw-semibold mb-2">Productos de {data.data.name}</div>
      <DataGrid dataSource={store} showBorders columnAutoWidth noDataText="Sin productos asociados">
        <Sorting mode="multiple" />
        <Column dataField="sku" caption="SKU" width={110} />
        <Column dataField="name" caption="Producto" defaultSortOrder="asc" />
        <Column dataField="unit" caption="Unidad" width={80} />
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
  const gridRef = useRef(null)
  const [error, setError] = useState('')

  const store = useMemo(
    () =>
      new CustomStore({
        key: 'id',
        load: () => suppliersApi.getAll().catch((err) => {
          setError(err.message)
          throw err
        }),
        insert: (values) => suppliersApi.create(toRequest(values)),
        // La grilla solo envía los campos cambiados; se combinan con el registro actual.
        update: async (id, values) => {
          const current = await suppliersApi.getById(id)
          return suppliersApi.update(id, toRequest({ ...current, ...values }))
        },
        remove: (id) => suppliersApi.remove(id),
      }),
    [],
  )

  // Un proveedor con productos se desactiva en vez de borrarse: se recarga para reflejarlo.
  const onRowRemoved = () => gridRef.current?.instance().refresh()

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h4 mb-0">Proveedores</h1>
        <small className="text-muted">Despliega una fila para ver sus productos</small>
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
            noDataText="No hay proveedores"
            onExporting={onExporting}
            onRowPrepared={onRowPrepared}
            onRowRemoved={onRowRemoved}
            onInitNewRow={(e) => {
              e.data.isActive = true
            }}
          >
            <Sorting mode="multiple" />
            <FilterRow visible />
            <HeaderFilter visible />
            <SearchPanel visible placeholder="Buscar…" />
            <Paging defaultPageSize={20} />
            <Pager showPageSizeSelector allowedPageSizes={[10, 20, 50]} showInfo />
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

            <Column dataField="ruc" caption="RUC" width={120} editorOptions={{ maxLength: 11 }}>
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
            <Column dataField="isActive" caption="Activo" dataType="boolean" width={100} />
          </DataGrid>
        </div>
      </div>
    </>
  )
}
