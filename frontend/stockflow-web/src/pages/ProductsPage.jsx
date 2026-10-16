import { useEffect, useMemo, useRef, useState } from 'react'
import DataGrid, {
  Column,
  Editing,
  Export,
  FilterRow,
  Form,
  HeaderFilter,
  Lookup,
  Pager,
  Paging,
  Popup,
  RangeRule,
  RequiredRule,
  SearchPanel,
  Sorting,
  StringLengthRule,
} from 'devextreme-react/data-grid'
import { Item } from 'devextreme-react/form'
import CustomStore from 'devextreme/data/custom_store'
import { FILES_ENABLED, fileUrl, lookupsApi, productsApi } from '../api/client.js'
import { useAlerts } from '../alerts/AlertsContext.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import ProductPhotoModal from '../components/ProductPhotoModal.jsx'
import { excelExporter } from '../utils/exportExcel.js'

const currency = { type: 'currency', currency: 'PEN', precision: 2 }
const units = ['UND', 'CJA', 'PAR', 'KG', 'LT', 'M', 'ROL', 'JGO']

const onExporting = excelExporter('Productos', 'productos.xlsx')

function toRequest(product) {
  return {
    sku: product.sku,
    name: product.name,
    description: product.description || null,
    unit: product.unit || 'UND',
    unitPrice: product.unitPrice ?? 0,
    minStock: product.minStock ?? 0,
    categoryId: product.categoryId,
    supplierId: product.supplierId ?? null,
    isActive: product.isActive ?? true,
  }
}

function onRowPrepared(e) {
  if (e.rowType !== 'data') return
  if (!e.data.isActive) e.rowElement.classList.add('text-muted')
  else if (e.data.belowMinStock) e.rowElement.classList.add('row-below-min')
}

// Los proveedores inactivos se siguen mostrando en la grilla, pero no se ofrecen para asignar.
const supplierName = (s) => s && (s.isActive ? s.name : `${s.name} (inactivo)`)

function onInitNewRow(e) {
  e.data.unit = 'UND'
  e.data.unitPrice = 0
  e.data.minStock = 0
  e.data.isActive = true
}

export default function ProductsPage() {
  const { hasRole } = useAuth()
  const canEdit = hasRole('Admin', 'Almacenero')
  const canDelete = hasRole('Admin')
  const { refresh: refreshAlerts } = useAlerts()
  const gridRef = useRef(null)
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [error, setError] = useState('')
  const [photoProduct, setPhotoProduct] = useState(null)

  useEffect(() => {
    Promise.all([lookupsApi.categories(), lookupsApi.suppliers()])
      .then(([c, s]) => {
        setCategories(c)
        setSuppliers(s)
      })
      .catch((err) => setError(err.message))
  }, [])

  const store = useMemo(
    () =>
      new CustomStore({
        key: 'id',
        load: () =>
          productsApi.getAll().catch((err) => {
            setError(err.message)
            throw err
          }),
        insert: (values) => productsApi.create(toRequest(values)),
        // La grilla solo envía los campos cambiados; se combinan con el registro actual.
        update: async (id, values) => {
          const current = await productsApi.getById(id)
          return productsApi.update(id, toRequest({ ...current, ...values }))
        },
        remove: (id) => productsApi.remove(id),
      }),
    [],
  )

  // En el formulario solo se ofrecen los proveedores activos y el que el producto ya tiene.
  const onEditorPreparing = (e) => {
    if (e.parentType === 'dataRow' && e.dataField === 'supplierId') {
      e.editorOptions.dataSource = suppliers.filter((s) => s.isActive || s.id === e.value)
    }
  }

  // Un producto con movimientos se desactiva en vez de borrarse: se recarga para reflejarlo.
  const onRowRemoved = () => {
    gridRef.current?.instance().refresh()
    refreshAlerts()
  }

  // Miniatura de la foto; al hacer clic se abre la ventana para verla o cambiarla.
  const renderPhoto = ({ data }) =>
    data.photoUrl ? (
      <img
        src={fileUrl(data.photoUrl)}
        alt={data.name}
        className="product-thumb"
        title="Ver foto"
        onClick={() => setPhotoProduct(data)}
      />
    ) : (
      <span
        className="product-thumb product-thumb-empty"
        title={canEdit ? 'Subir foto' : 'Sin foto'}
        onClick={() => setPhotoProduct(data)}
      >
        {canEdit ? '+' : '—'}
      </span>
    )

  return (
    <>
      {photoProduct && (
        <ProductPhotoModal
          product={photoProduct}
          canEdit={canEdit}
          onClose={() => setPhotoProduct(null)}
          onChanged={() => gridRef.current?.instance().refresh()}
        />
      )}

      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h4 mb-0">Productos</h1>
        <small className="text-muted">Las filas en amarillo están por debajo del stock mínimo</small>
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
            noDataText="No hay productos"
            onExporting={onExporting}
            onRowPrepared={onRowPrepared}
            onInitNewRow={onInitNewRow}
            onEditorPreparing={onEditorPreparing}
            onRowRemoved={onRowRemoved}
            onSaved={refreshAlerts}
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
              allowAdding={canEdit}
              allowUpdating={canEdit}
              allowDeleting={canDelete}
              useIcons
              confirmDelete
              texts={{
                confirmDeleteMessage:
                  '¿Eliminar este producto? Si tiene movimientos registrados, se desactivará en lugar de borrarse.',
              }}
            >
              <Popup title="Producto" showTitle width={720} height="auto" />
              <Form colCount={2}>
                <Item dataField="sku" />
                <Item dataField="name" />
                <Item dataField="categoryId" />
                <Item dataField="supplierId" editorOptions={{ showClearButton: true }} />
                <Item dataField="unit" editorType="dxSelectBox" editorOptions={{ items: units, acceptCustomValue: true }} />
                <Item dataField="unitPrice" />
                <Item dataField="minStock" />
                <Item dataField="isActive" />
                <Item dataField="description" editorType="dxTextArea" colSpan={2} />
              </Form>
            </Editing>

            <Column
              caption="Foto"
              visible={FILES_ENABLED}
              width={64}
              alignment="center"
              cellRender={renderPhoto}
              allowExporting={false}
              allowFiltering={false}
              allowSorting={false}
              showInColumnChooser={false}
            />
            <Column dataField="sku" caption="SKU" width={110}>
              <RequiredRule message="El SKU es obligatorio" />
              <StringLengthRule max={40} message="Máximo 40 caracteres" />
            </Column>
            <Column dataField="name" caption="Producto" defaultSortOrder="asc">
              <RequiredRule message="El nombre es obligatorio" />
              <StringLengthRule max={150} message="Máximo 150 caracteres" />
            </Column>
            <Column dataField="categoryId" caption="Categoría">
              <Lookup dataSource={categories} valueExpr="id" displayExpr="name" />
              <RequiredRule message="La categoría es obligatoria" />
            </Column>
            <Column dataField="supplierId" caption="Proveedor">
              <Lookup dataSource={suppliers} valueExpr="id" displayExpr={supplierName} allowClearing />
            </Column>
            <Column dataField="unit" caption="Unidad" width={80}>
              <RequiredRule message="La unidad es obligatoria" />
              <StringLengthRule max={10} message="Máximo 10 caracteres" />
            </Column>
            <Column dataField="unitPrice" caption="Precio" dataType="number" format={currency} editorOptions={{ format: currency, min: 0 }}>
              <RangeRule min={0} message="El precio no puede ser negativo" />
            </Column>
            <Column dataField="totalStock" caption="Stock" dataType="number" allowEditing={false} />
            <Column dataField="minStock" caption="Stock mín." dataType="number" editorOptions={{ min: 0, format: '#0' }}>
              <RangeRule min={0} message="El stock mínimo no puede ser negativo" />
            </Column>
            <Column dataField="isActive" caption="Activo" dataType="boolean" width={100} />
            <Column dataField="description" caption="Descripción" visible={false}>
              <StringLengthRule max={500} message="Máximo 500 caracteres" />
            </Column>
          </DataGrid>
        </div>
      </div>
    </>
  )
}
