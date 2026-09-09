import { Locale } from 'src/common/constants/locales';
import { LookupEntity } from 'src/common/entities/lookup.entity';
import { pickTranslation, toTranslationsMap } from 'src/common/utils';
import {
  LookupResponse,
  MachineModelResponse,
  MachineTypeResponse,
  ViolationTypeResponse,
} from '../dto/responses/lookup.response';
import { MachineModel } from '../entities/machine-model.entity';
import { MachineType } from '../entities/machine-type.entity';
import { LookupTranslationShape } from '../lookup-crud.service';
import { ViolationType } from '../entities/violation-type.entity';

interface LookupWithTranslations extends LookupEntity {
  translations: LookupTranslationShape[];
}

/**
 * Flattens a lookup and its translation rows into the client shape. `includeRaw` switches to
 * the admin representation that carries every locale at once.
 */
export function toLookupResponse(
  entity: LookupWithTranslations,
  locale: Locale,
  includeRaw = false,
): LookupResponse {
  const translation = pickTranslation(entity.translations, locale);

  const response: LookupResponse = {
    id: entity.id,
    code: entity.code,
    name: translation?.name ?? entity.code,
    isActive: entity.isActive,
    sortOrder: entity.sortOrder,
  };

  // Only name-carrying lookups have a description; omit the key entirely when absent.
  if (translation && 'description' in translation) {
    response.description = translation.description ?? null;
  }

  if (includeRaw) {
    response.translations = toTranslationsMap(entity.translations, (row) => ({
      name: row.name,
      ...(row.description !== undefined ? { description: row.description } : {}),
    }));
  }

  return response;
}

export function toMachineTypeResponse(
  entity: MachineType,
  locale: Locale,
  includeRaw = false,
): MachineTypeResponse {
  return {
    ...toLookupResponse(entity, locale, includeRaw),
    requiresSim: entity.requiresSim,
  };
}

export function toViolationTypeResponse(
  entity: ViolationType,
  locale: Locale,
  includeRaw = false,
): ViolationTypeResponse {
  return {
    ...toLookupResponse(entity, locale, includeRaw),
    defaultSeverity: entity.defaultSeverity,
  };
}

export function toMachineModelResponse(
  entity: MachineModel,
  locale: Locale,
  includeRaw = false,
): MachineModelResponse {
  const typeTranslation = pickTranslation(entity.machineType?.translations, locale);

  return {
    ...toLookupResponse(entity, locale, includeRaw),
    manufacturer: entity.manufacturer,
    machineType: {
      id: entity.machineTypeId,
      code: entity.machineType?.code ?? '',
      name: typeTranslation?.name ?? entity.machineType?.code ?? '',
      requiresSim: entity.machineType?.requiresSim ?? true,
    },
  };
}
