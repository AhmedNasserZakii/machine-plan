import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { likePattern } from 'src/common/utils';
import { CreateSupplierDto, QuerySuppliersDto } from '../dto/supplier.dto';
import { Supplier } from '../entities/supplier.entity';

/**
 * Suppliers are free text with a name, not a managed lookup: an expense has to be bookable the
 * moment it happens, and a spare-parts shop nobody registered first is not a reason to block it.
 */
@Injectable()
export class SuppliersService {
  constructor(@InjectRepository(Supplier) private readonly suppliers: Repository<Supplier>) {}

  async findAll(query: QuerySuppliersDto): Promise<Supplier[]> {
    const qb = this.suppliers.createQueryBuilder('supplier');

    if (!query.includeInactive) qb.andWhere('supplier.is_active = true');
    if (query.search) {
      qb.andWhere('(supplier.name ILIKE :search OR supplier.phone ILIKE :search)', {
        search: likePattern(query.search),
      });
    }

    return qb.orderBy('supplier.name', 'ASC').getMany();
  }

  async create(dto: CreateSupplierDto, actorId: string): Promise<Supplier> {
    return this.suppliers.save(
      this.suppliers.create({
        name: dto.name,
        phone: dto.phone ?? null,
        notes: dto.notes ?? null,
        isActive: true,
        createdBy: actorId,
      }),
    );
  }
}
