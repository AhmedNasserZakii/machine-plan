import { WarehouseType } from 'src/common/enums/operations.enum';
import { BranchResponse, WarehouseResponse } from '../dto/responses/branch.response';
import { Branch } from '../entities/branch.entity';
import { Warehouse } from '../entities/warehouse.entity';

export function toWarehouseResponse(warehouse: Warehouse): WarehouseResponse {
  return {
    id: warehouse.id,
    type: warehouse.type,
    name: warehouse.name,
    branchId: warehouse.branchId,
    isActive: warehouse.isActive,
  };
}

/**
 * `includeWarehouse` is only set when the query loaded the relation, so a missing warehouse is
 * reported as `null` rather than being silently indistinguishable from "not requested".
 */
export function toBranchResponse(branch: Branch, includeWarehouse = true): BranchResponse {
  const response: BranchResponse = {
    id: branch.id,
    code: branch.code,
    name: branch.name,
    address: branch.address,
    phone: branch.phone,
    isActive: branch.isActive,
  };

  if (includeWarehouse) {
    const warehouse = branch.warehouses?.find((row) => row.type === WarehouseType.BRANCH);
    response.warehouse = warehouse ? toWarehouseResponse(warehouse) : null;
  }

  return response;
}
