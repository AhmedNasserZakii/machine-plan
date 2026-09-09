import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheKeys, CacheService } from 'src/common/cache';
import { ErrorCode } from 'src/common/constants/error-codes';
import { AppException } from 'src/common/errors';
import { SettingResponse } from './dto/responses/setting.response';
import { Setting } from './entities/setting.entity';
import {
  DecommissionThresholds,
  SETTINGS_CATALOGUE,
  SettingDefinition,
  settingDefinition,
  SettingKey,
  SettingKeyValue,
} from './settings.catalogue';

/**
 * Long, because these change a handful of times a year at most and every candidates query reads
 * three of them. `set` clears the key, so an edit is visible on the next request rather than in
 * ten minutes.
 */
const TTL_SECONDS = 3600;

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting) private readonly settings: Repository<Setting>,
    private readonly cache: CacheService,
  ) {}

  /** The whole catalogue with the current effective values, for the Director's settings screen. */
  async findAll(): Promise<SettingResponse[]> {
    const overrides = await this.overrides();

    return SETTINGS_CATALOGUE.map((definition) => {
      const stored = overrides.get(definition.key);

      return {
        key: definition.key,
        value: stored ?? definition.default,
        default: definition.default,
        kind: definition.kind,
        min: definition.min,
        max: definition.max,
        description: definition.description,
        isOverridden: stored !== undefined,
      };
    });
  }

  async findOne(key: string): Promise<SettingResponse> {
    const all = await this.findAll();
    const found = all.find((setting) => setting.key === key);

    if (!found) throw AppException.notFound(ErrorCode.SETTING_NOT_FOUND, { key });

    return found;
  }

  /** The effective value of one key, cached. */
  get(key: SettingKeyValue): Promise<number> {
    const definition = settingDefinition(key)!;

    return this.cache.remember(CacheKeys.setting(key), TTL_SECONDS, async () => {
      const row = await this.settings.findOne({ where: { key } });
      const parsed = row ? Number(row.value) : Number.NaN;

      // A row that no longer parses — hand-edited, or left behind by a key whose kind changed —
      // reads as the default rather than poisoning every ratio it feeds.
      return Number.isFinite(parsed) ? parsed : definition.default;
    });
  }

  async decommissionThresholds(): Promise<DecommissionThresholds> {
    const [reviewRatio, considerRatio, considerRepairCount] = await Promise.all([
      this.get(SettingKey.DECOMMISSION_COST_RATIO_REVIEW),
      this.get(SettingKey.DECOMMISSION_COST_RATIO_CONSIDER),
      this.get(SettingKey.DECOMMISSION_REPAIR_COUNT_CONSIDER),
    ]);

    return { reviewRatio, considerRatio, considerRepairCount };
  }

  async set(key: string, value: number, actorId: string): Promise<SettingResponse> {
    const definition = settingDefinition(key);

    if (!definition) throw AppException.notFound(ErrorCode.SETTING_NOT_FOUND, { key });

    this.assertInRange(definition, value);

    const existing = await this.settings.findOne({ where: { key } });

    if (existing) {
      await this.settings.update(existing.id, { value: String(value), updatedBy: actorId });
    } else {
      await this.settings.save(
        this.settings.create({ key, value: String(value), createdBy: actorId }),
      );
    }

    await this.cache.del(CacheKeys.setting(key));

    return this.findOne(key);
  }

  private assertInRange(definition: SettingDefinition, value: number): void {
    if (value < definition.min || value > definition.max) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [
          {
            field: 'value',
            value,
            constraint: `must be between ${definition.min} and ${definition.max}`,
          },
        ],
      });
    }

    if (definition.kind === 'COUNT' && !Number.isInteger(value)) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [{ field: 'value', value, constraint: 'must be a whole number' }],
      });
    }
  }

  private async overrides(): Promise<Map<string, number>> {
    const rows = await this.settings.find();

    return new Map(
      rows
        .map((row) => [row.key, Number(row.value)] as const)
        .filter(([, value]) => Number.isFinite(value)),
    );
  }
}
