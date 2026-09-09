/**
 * The tunable numbers, with their defaults and their limits.
 *
 * Declared here rather than in the database so the set of keys is a compile-time fact: a typo in a
 * key name is a type error, and `SettingsService.get` can promise a number for every key without
 * asking whether somebody remembered to seed it.
 */
export const SettingKey = {
  /** Below this cost-to-value ratio the machine is simply worth keeping (`07`). */
  DECOMMISSION_COST_RATIO_REVIEW: 'DECOMMISSION_COST_RATIO_REVIEW',
  DECOMMISSION_COST_RATIO_CONSIDER: 'DECOMMISSION_COST_RATIO_CONSIDER',
  DECOMMISSION_REPAIR_COUNT_CONSIDER: 'DECOMMISSION_REPAIR_COUNT_CONSIDER',
} as const;

export type SettingKeyValue = (typeof SettingKey)[keyof typeof SettingKey];

export interface SettingDefinition {
  key: SettingKeyValue;
  /** `RATIO` is a fraction of the purchase price; `COUNT` is a whole number of repairs. */
  kind: 'RATIO' | 'COUNT';
  default: number;
  min: number;
  max: number;
  description: string;
}

export const SETTINGS_CATALOGUE: readonly SettingDefinition[] = [
  {
    key: SettingKey.DECOMMISSION_COST_RATIO_REVIEW,
    kind: 'RATIO',
    default: 0.4,
    min: 0,
    max: 1,
    description: 'Repair cost against purchase price above which a machine is flagged for review',
  },
  {
    key: SettingKey.DECOMMISSION_COST_RATIO_CONSIDER,
    kind: 'RATIO',
    default: 0.7,
    min: 0,
    max: 1,
    description: 'Ratio above which decommissioning is recommended to the Director',
  },
  {
    key: SettingKey.DECOMMISSION_REPAIR_COUNT_CONSIDER,
    kind: 'COUNT',
    default: 5,
    min: 1,
    max: 100,
    description: 'Number of repairs above which decommissioning is recommended',
  },
];

const BY_KEY = new Map<string, SettingDefinition>(
  SETTINGS_CATALOGUE.map((definition) => [definition.key, definition]),
);

export function settingDefinition(key: string): SettingDefinition | undefined {
  return BY_KEY.get(key);
}

/** The three thresholds the decommission heuristic reads, resolved together. */
export interface DecommissionThresholds {
  reviewRatio: number;
  considerRatio: number;
  considerRepairCount: number;
}
