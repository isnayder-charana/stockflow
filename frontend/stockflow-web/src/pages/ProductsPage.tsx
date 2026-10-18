import { useEffect, useMemo, useRef, useState } from 'react'
import DataGrid, {
  type DataGridRef,
  Column,
  Editing,
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
  Toolbar,
  Item as ToolbarItem,
} from 'devextreme-react/data-grid'
import { Item } from 'devextreme-react/form'
import CustomStore from 'devextreme/data/custom_store'
import type { EditorPreparingEvent, InitNewRowEvent, RowPreparedEvent } from 'devextreme/ui/data_grid'
import { FILES_ENABLED, errorMessage, fileUrl, lookupsApi, productsApi } from '../api/client.ts'
import { toProductRequest } from '../api/requests.ts'
import type { LookupOption, Product, SupplierLookup } from '../api/types.ts'
import { useAlerts } from '../alerts/AlertsContext.tsx'
import { useAuth } from '../auth/AuthContext.tsx'
import KpiCards from '../components/KpiCards.tsx'
import PageHeader from '../components/PageHeader.tsx'
import ProductPhotoModal from '../components/ProductPhotoModal.tsx'
import StatusBadge from '../components/StatusBadge.tsx'
import { exportGridToExcel } from '../utils/exportExcel.ts'
import { filterButtonOptions } from '../utils/gridToolbar.ts'
import { productKpis, statusRowClass, statusTone, stockStatus } from '../utils/stockStatus.ts'

const currency = { type: 'currency', currency: 'PEN', precision: 2 }
const units = ['UND', 'CJA', 'PAR', 'KG', 'LT', 'M', 'ROL', 'JGO']

function onRowPrepared(e: RowPreparedEvent<Product>) {
  if (e.rowType !== 'data') return
  const rowClass = statusRowClass[stockStatus(e.data)]
  if (rowClass) e.rowElement.classList.add(rowClass)
}

function StatusCell({ data }: { data: Product }) {
  const status = stockStatus(data)
  return <StatusBadge tone={statusTone[status]}>{status}</StatusBadge>
}

// Los proveedores inactivos se siguen mostrando en la grilla, pero no se ofrecen para asignar.
const supplierName = (s: SupplierLookup | null) => (s ? (s.isActive ? s.name : `${s.name} (inactivo)`) : '')

function onInitNewRow(e: InitNewRowEvent<Product, number>) {
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
  const gridRef = useRef<DataGridRef<Product, number>>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [categories, setCategories] = useState<LookupOption[]>([])
  const [suppliers, setSuppliers] = useState<SupplierLookup[]>([])
  const [products, setProducts] = useState<Product[] | null>(null)
  const [warehouseCount, setWarehouseCount] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [photoProduct, setPhotoProduct] = useState<Product | null>(null)

  useEffect(() => {
    Promise.all([lookupsApi.categories(), lookupsApi.suppliers(), lookupsApi.warehouses()])
      .then(([c, s, w]) => {
        setCategories(c)
        setSuppliers(s)
        setWarehouseCount(w.length)
      })
      .catch((err) => setError(errorMessage(err)))
  }, [])

  const store = useMemo(
    () =>
      new CustomStore<Product, number>({
        key: 'id',
        // Cada recarga de la grilla (también tras guardar) actualiza los indicadores.
        load: () =>
          productsApi
            .getAll()
            .then((list) => {
              setProducts(list)
              return list
            })
            .catch((err) => {
              setError(errorMessage(err))
              throw err
            }),
        insert: (values) => productsApi.create(toProductRequest(values)),
        // La grilla solo envía los campos cambiados; se combinan con el registro actual.
        update: async (id, values) => {
          const current = await productsApi.getById(id)
          return productsApi.update(id, toProductRequest({ ...current, ...values }))
        },
        remove: (id) => productsApi.remove(id),
      }),
    [],
  )

  // En el formulario solo se ofrecen los proveedores activos y el que el producto ya tiene.
  const onEditorPreparing = (e: EditorPreparingEvent<Product>) => {
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
  const renderPhoto = ({ data }: { data: Product }) =>
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

  const kpis = useMemo(() => (products ? productKpis(products) : null), [products])

  // Al ocultar la fila de filtros se quitan sus filtros, para no dejar filas escondidas sin aviso.
  const toggleFilters = () => {
    if (showFilters) gridRef.current?.instance().clearFilter('row')
    setShowFilters(!showFilters)
  }

  const handleExport = () => {
    const grid = gridRef.current?.instance()
    if (grid) exportGridToExcel(grid, 'Productos', 'productos.xlsx')
  }

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

      <PageHeader title="Productos">
        <button className="btn btn-outline-success" onClick={handleExport}>
          Exportar a Excel
        </button>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => gridRef.current?.instance().addRow()}>
            + Nuevo producto
          </button>
        )}
      </PageHeader>

      <KpiCards
        items={[
          { label: 'Productos activos', value: kpis?.active ?? null },
          { label: 'Almacenes', value: warehouseCount },
          { label: 'Bajo stock mínimo', value: kpis?.belowMin ?? null, tone: 'warning' },
          { label: 'Agotados', value: kpis?.outOfStock ?? null, tone: 'danger' },
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
          noDataText="No hay productos"
          onRowPrepared={onRowPrepared}
          onInitNewRow={onInitNewRow}
          onEditorPreparing={onEditorPreparing}
          onRowRemoved={onRowRemoved}
          onSaved={refreshAlerts}
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
          <Column dataField="sku" caption="SKU" width={110} cssClass="cell-code">
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
          <Column dataField="unit" caption="Unidad" width={95}>
            <RequiredRule message="La unidad es obligatoria" />
            <StringLengthRule max={10} message="Máximo 10 caracteres" />
          </Column>
          <Column dataField="unitPrice" caption="Precio" dataType="number" format={currency} editorOptions={{ format: currency, min: 0 }}>
            <RangeRule min={0} message="El precio no puede ser negativo" />
          </Column>
          <Column dataField="totalStock" caption="Stock" dataType="number" allowEditing={false} />
          <Column dataField="minStock" caption="Mínimo" dataType="number" editorOptions={{ min: 0, format: '#0' }}>
            <RangeRule min={0} message="El stock mínimo no puede ser negativo" />
          </Column>
          <Column name="status" caption="Estado" width={130} calculateCellValue={stockStatus} cellRender={StatusCell} />
          <Column dataField="isActive" caption="Activo" dataType="boolean" visible={false} />
          <Column dataField="description" caption="Descripción" visible={false}>
            <StringLengthRule max={500} message="Máximo 500 caracteres" />
          </Column>
        </DataGrid>
      </div>
    </>
  )
}
