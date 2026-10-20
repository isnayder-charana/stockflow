// Tipos de lo que devuelve y recibe la API (espejo de backend/src/StockFlow.Api/Dtos).

export type UserRole = 'Admin' | 'Almacenero' | 'Supervisor' | 'Invitado'

export interface Session {
  token: string
  expiresAt: string
  username: string
  fullName: string
  role: UserRole
}

export interface LookupOption {
  id: number
  name: string
}

export interface SupplierLookup extends LookupOption {
  isActive: boolean
}

export interface Product {
  id: number
  sku: string
  name: string
  description: string | null
  unit: string
  unitPrice: number
  minStock: number
  totalStock: number
  belowMinStock: boolean
  photoUrl: string | null
  isActive: boolean
  categoryId: number
  categoryName: string
  supplierId: number | null
  supplierName: string | null
  createdAt: string
}

export interface ProductRequest {
  sku: string
  name: string
  description: string | null
  unit: string
  unitPrice: number
  minStock: number
  categoryId: number
  supplierId: number | null
  isActive: boolean
}

export interface Warehouse {
  id: number
  code: string
  name: string
  location: string | null
  isActive: boolean
  productCount: number
  totalUnits: number
}

export interface WarehouseRequest {
  code: string
  name: string
  location: string | null
  isActive: boolean
}

export interface WarehouseStock {
  productId: number
  sku: string
  productName: string
  unit: string
  quantity: number
  minStock: number
}

export interface Supplier {
  id: number
  name: string
  ruc: string
  contactName: string | null
  phone: string | null
  email: string | null
  address: string | null
  isActive: boolean
  productCount: number
}

export interface SupplierRequest {
  name: string
  ruc: string
  contactName: string | null
  phone: string | null
  email: string | null
  address: string | null
  isActive: boolean
}

export interface SupplierProduct {
  id: number
  sku: string
  name: string
  unit: string
  unitPrice: number
  totalStock: number
  isActive: boolean
}

export type MovementType = 'In' | 'Out'

export interface StockMovement {
  id: number
  type: MovementType
  date: string
  quantity: number
  productId: number
  sku: string
  productName: string
  unit: string
  warehouseId: number
  warehouseName: string
  reference: string | null
  notes: string | null
  username: string
  documentUrl: string | null
}

export interface StockMovementRequest {
  type: MovementType
  warehouseId: number
  productId: number
  quantity: number
  reference: string | null
  notes: string | null
}

export interface MovementFilters {
  /** Fecha ISO de inicio (incluida). */
  from?: string | null
  /** Fecha ISO de fin (excluida). */
  to?: string | null
  warehouseId?: number | string | null
  productId?: number | string | null
}

export interface LowStockWarehouse {
  warehouseId: number
  warehouseName: string
  isActive: boolean
  quantity: number
}

export interface LowStockAlert {
  productId: number
  sku: string
  productName: string
  unit: string
  categoryName: string
  minStock: number
  totalStock: number
  shortage: number
  supplierId: number | null
  supplierName: string | null
  supplierPhone: string | null
  supplierEmail: string | null
  warehouses: LowStockWarehouse[]
}

export interface AlertCount {
  count: number
}
