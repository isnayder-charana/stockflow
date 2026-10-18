// Arman el cuerpo que espera la API a partir de una fila de la grilla (que puede venir incompleta).
import type {
  Product,
  ProductRequest,
  Supplier,
  SupplierRequest,
  Warehouse,
  WarehouseRequest,
} from './types.ts'

export function toProductRequest(product: Partial<Product>): ProductRequest {
  return {
    sku: product.sku ?? '',
    name: product.name ?? '',
    description: product.description || null,
    unit: product.unit || 'UND',
    unitPrice: product.unitPrice ?? 0,
    minStock: product.minStock ?? 0,
    categoryId: product.categoryId ?? 0,
    supplierId: product.supplierId ?? null,
    isActive: product.isActive ?? true,
  }
}

export function toSupplierRequest(supplier: Partial<Supplier>): SupplierRequest {
  return {
    name: supplier.name ?? '',
    ruc: supplier.ruc ?? '',
    contactName: supplier.contactName || null,
    phone: supplier.phone || null,
    email: supplier.email || null,
    address: supplier.address || null,
    isActive: supplier.isActive ?? true,
  }
}

export function toWarehouseRequest(warehouse: Partial<Warehouse>): WarehouseRequest {
  return {
    code: warehouse.code ?? '',
    name: warehouse.name ?? '',
    location: warehouse.location ?? null,
    isActive: warehouse.isActive ?? true,
  }
}
