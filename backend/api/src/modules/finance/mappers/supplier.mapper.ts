import { SupplierResponse } from '../dto/responses/supplier.response';
import { Supplier } from '../entities/supplier.entity';

export function toSupplierResponse(supplier: Supplier): SupplierResponse {
  return {
    id: supplier.id,
    name: supplier.name,
    phone: supplier.phone,
    notes: supplier.notes,
    isActive: supplier.isActive,
    createdAt: supplier.createdAt.toISOString(),
  };
}
