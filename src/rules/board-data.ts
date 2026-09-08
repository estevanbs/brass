import type { IndustryType, LinkSlotDef, MerchantBonus } from '../core/types.js';

/**
 * Board topology. See docs/RULES.md §11 and docs/ASSUMPTIONS.md entry 1: this is an
 * original design (real West Midlands place names, invented connectivity), not a
 * transcription of the physical board.
 */
export interface IndustrialLocationDef {
  readonly id: string;
  readonly kind: 'industrial';
  readonly slots: readonly (readonly IndustryType[])[];
}

export interface FarmBreweryDef {
  readonly id: string;
  readonly kind: 'farm_brewery';
  readonly slots: readonly (readonly IndustryType[])[];
}

export interface MarketDef {
  readonly id: string;
  readonly kind: 'market';
  readonly merchantSlotCount: number;
  readonly minPlayers: number;
  readonly bonus: MerchantBonus;
}

export const INDUSTRIAL_LOCATIONS: readonly IndustrialLocationDef[] = [
  {
    id: 'birmingham',
    kind: 'industrial',
    slots: [['iron'], ['cotton', 'manufacturer'], ['manufacturer', 'pottery'], ['coal', 'manufacturer']],
  },
  {
    id: 'wolverhampton',
    kind: 'industrial',
    slots: [['coal'], ['iron', 'manufacturer'], ['cotton', 'pottery']],
  },
  {
    id: 'dudley',
    kind: 'industrial',
    slots: [['coal'], ['coal', 'iron'], ['manufacturer']],
  },
  {
    id: 'walsall',
    kind: 'industrial',
    slots: [['manufacturer', 'cotton'], ['iron'], ['pottery', 'manufacturer']],
  },
  {
    id: 'west_bromwich',
    kind: 'industrial',
    slots: [['manufacturer'], ['coal', 'manufacturer']],
  },
  {
    id: 'coventry',
    kind: 'industrial',
    slots: [['cotton'], ['cotton', 'manufacturer'], ['manufacturer']],
  },
  {
    id: 'tamworth',
    kind: 'industrial',
    slots: [['cotton'], ['coal', 'cotton']],
  },
  {
    id: 'nuneaton',
    kind: 'industrial',
    slots: [['cotton', 'manufacturer'], ['manufacturer']],
  },
  {
    id: 'redditch',
    kind: 'industrial',
    slots: [['manufacturer'], ['iron', 'manufacturer']],
  },
  {
    id: 'bromsgrove',
    kind: 'industrial',
    slots: [['cotton'], ['manufacturer', 'cotton']],
  },
  {
    id: 'kidderminster',
    kind: 'industrial',
    slots: [['cotton'], ['coal', 'cotton'], ['manufacturer']],
  },
  {
    id: 'worcester',
    kind: 'industrial',
    slots: [['cotton', 'manufacturer'], ['pottery']],
  },
  {
    id: 'cannock',
    kind: 'industrial',
    slots: [['coal'], ['coal', 'manufacturer']],
  },
  {
    id: 'coalbrookdale',
    kind: 'industrial',
    slots: [['iron'], ['coal', 'iron']],
  },
  {
    id: 'stoke_on_trent',
    kind: 'industrial',
    slots: [['pottery'], ['pottery', 'coal'], ['manufacturer']],
  },
  {
    id: 'stone',
    kind: 'industrial',
    slots: [['pottery'], ['manufacturer', 'pottery']],
  },
  {
    id: 'leek',
    kind: 'industrial',
    slots: [['cotton'], ['pottery', 'cotton']],
  },
  {
    id: 'stourbridge',
    kind: 'industrial',
    slots: [['manufacturer', 'pottery'], ['iron']],
  },
];

export const FARM_BREWERIES: readonly FarmBreweryDef[] = [
  { id: 'farm_brewery_north', kind: 'farm_brewery', slots: [['brewery']] },
  { id: 'farm_brewery_south', kind: 'farm_brewery', slots: [['brewery']] },
];

export const MARKETS: readonly MarketDef[] = [
  {
    id: 'warrington',
    kind: 'market',
    merchantSlotCount: 2,
    minPlayers: 3,
    bonus: { kind: 'money', amount: 5 },
  },
  {
    id: 'shrewsbury',
    kind: 'market',
    merchantSlotCount: 1,
    minPlayers: 2,
    bonus: { kind: 'victoryPoints', amount: 3 },
  },
  {
    id: 'nottingham',
    kind: 'market',
    merchantSlotCount: 2,
    minPlayers: 4,
    bonus: { kind: 'victoryPoints', amount: 2 },
  },
  {
    id: 'gloucester',
    kind: 'market',
    merchantSlotCount: 2,
    minPlayers: 2,
    bonus: { kind: 'develop' },
  },
  {
    id: 'oxford',
    kind: 'market',
    merchantSlotCount: 2,
    minPlayers: 2,
    bonus: { kind: 'income', spaces: 2 },
  },
];

/**
 * Buildable link slots. The kidderminster<->worcester slot is special: building it also
 * connects both locations to farm_brewery_south (docs/RULES.md §11). Same slot set is used
 * for both the canal and rail eras (docs/ASSUMPTIONS.md entry 5).
 */
export const LINK_SLOTS: readonly LinkSlotDef[] = (
  [
    ['birmingham', 'wolverhampton'],
    ['birmingham', 'dudley'],
    ['birmingham', 'walsall'],
    ['birmingham', 'west_bromwich'],
    ['birmingham', 'coventry'],
    ['birmingham', 'redditch'],
    ['birmingham', 'bromsgrove'],
    ['wolverhampton', 'dudley'],
    ['wolverhampton', 'walsall'],
    ['wolverhampton', 'cannock'],
    ['wolverhampton', 'stourbridge'],
    ['dudley', 'west_bromwich'],
    ['dudley', 'stourbridge'],
    ['dudley', 'kidderminster'],
    ['walsall', 'west_bromwich'],
    ['walsall', 'tamworth'],
    ['walsall', 'cannock'],
    ['cannock', 'tamworth'],
    ['cannock', 'stoke_on_trent'],
    ['cannock', 'farm_brewery_north'],
    ['cannock', 'stone'],
    ['tamworth', 'nuneaton'],
    ['nuneaton', 'coventry'],
    ['coventry', 'redditch'],
    ['redditch', 'bromsgrove'],
    ['bromsgrove', 'worcester'],
    ['kidderminster', 'worcester'],
    ['kidderminster', 'stourbridge'],
    ['stoke_on_trent', 'stone'],
    ['stoke_on_trent', 'leek'],
    ['coalbrookdale', 'kidderminster'],
    ['coalbrookdale', 'stourbridge'],
    ['coalbrookdale', 'worcester'],
    ['warrington', 'wolverhampton'],
    ['warrington', 'stoke_on_trent'],
    ['shrewsbury', 'coalbrookdale'],
    ['shrewsbury', 'stourbridge'],
    ['nottingham', 'tamworth'],
    ['nottingham', 'nuneaton'],
    ['gloucester', 'worcester'],
    ['gloucester', 'bromsgrove'],
    ['oxford', 'coventry'],
    ['oxford', 'redditch'],
  ] as const
).map(([a, b]) => ({
  id: `${a}__${b}`,
  locations: [a, b] as const,
  bonusConnections:
    a === 'kidderminster' && b === 'worcester'
      ? ([
          ['kidderminster', 'farm_brewery_south'],
          ['worcester', 'farm_brewery_south'],
        ] as const)
      : ([] as const),
}));

export const ALL_LOCATION_IDS: readonly string[] = [
  ...INDUSTRIAL_LOCATIONS.map((l) => l.id),
  ...FARM_BREWERIES.map((l) => l.id),
  ...MARKETS.map((l) => l.id),
];
