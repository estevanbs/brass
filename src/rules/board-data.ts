import type { Era, IndustryType, LinkSlotDef, MerchantBonus } from '../core/types.js';

/**
 * Board topology. Per-location build slots (`INDUSTRIAL_LOCATIONS[].slots`) and link
 * connectivity/era (`RAW_LINKS` below) are transcribed directly from `docs/BUILDINGS.md` and
 * `docs/CONECTIONS.md` respectively — user-authored reference files that are this project's
 * final source of truth for this data and must not be second-guessed or edited (docs/
 * ASSUMPTIONS.md #24). Earlier sessions reconstructed this same data from board photos with
 * varying confidence (docs/ASSUMPTIONS.md #1, #5, #23); those entries are kept for history but
 * are now superseded wherever they conflict with the two reference files. Market min-player
 * gates and deck copy counts are unaffected by this change and still come from board/reference-
 * card photos (docs/ASSUMPTIONS.md #15, #22).
 */
export interface IndustrialLocationDef {
  readonly id: string;
  readonly kind: 'industrial';
  readonly slots: readonly (readonly IndustryType[])[];
  /** Copies of this location's card in the draw deck at [2, 3, 4] players — `0` means the
   * card is entirely absent at that player count. Read directly off the game's own printed
   * "Distribuição de Cartas" reference card (photographed by the user), which replaced an
   * earlier, less accurate reconstruction from the board's banner colors alone: that guess had
   * kidderminster/worcester wrongly gated behind 3+ players (docs/ASSUMPTIONS.md #22) and
   * missed that some gated locations' copy count itself changes between 3p and 4p (uttoxeter:
   * 1 copy at 3p, 2 at 4p) rather than just switching on/off. The location itself is always on
   * the board and buildable at any player count via an industry card or the wildcard — only its
   * own dedicated location card can be missing or fewer at a smaller game (`src/rules/deck-data.ts`). */
  readonly deckCopies: readonly [number, number, number];
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
    slots: [['cotton', 'manufacturer'], ['manufacturer'], ['iron'], ['manufacturer']],
    deckCopies: [3, 3, 3],
  },
  {
    id: 'wolverhampton',
    kind: 'industrial',
    slots: [['manufacturer'], ['manufacturer', 'coal']],
    deckCopies: [2, 2, 2],
  },
  {
    id: 'dudley',
    kind: 'industrial',
    slots: [['coal'], ['iron']],
    deckCopies: [2, 2, 2],
  },
  {
    id: 'walsall',
    kind: 'industrial',
    slots: [['iron', 'manufacturer'], ['manufacturer', 'brewery']],
    deckCopies: [1, 1, 1],
  },
  {
    id: 'coventry',
    kind: 'industrial',
    slots: [['pottery'], ['manufacturer', 'coal'], ['iron', 'manufacturer']],
    deckCopies: [3, 3, 3],
  },
  {
    id: 'tamworth',
    kind: 'industrial',
    slots: [['cotton', 'coal'], ['cotton', 'coal']],
    deckCopies: [1, 1, 1],
  },
  {
    id: 'nuneaton',
    kind: 'industrial',
    slots: [['manufacturer', 'brewery'], ['cotton', 'coal']],
    deckCopies: [1, 1, 1],
  },
  {
    id: 'redditch',
    kind: 'industrial',
    slots: [['manufacturer', 'coal'], ['iron']],
    deckCopies: [1, 1, 1],
  },
  {
    id: 'kidderminster',
    kind: 'industrial',
    slots: [['cotton', 'coal'], ['cotton']],
    deckCopies: [2, 2, 2],
  },
  {
    id: 'worcester',
    kind: 'industrial',
    slots: [['cotton'], ['cotton']],
    deckCopies: [2, 2, 2],
  },
  {
    id: 'cannock',
    kind: 'industrial',
    slots: [['manufacturer', 'coal'], ['coal']],
    deckCopies: [2, 2, 2],
  },
  {
    id: 'coalbrookdale',
    kind: 'industrial',
    slots: [['iron', 'brewery'], ['iron'], ['coal']],
    deckCopies: [3, 3, 3],
  },
  // The next four are gated by the deck reference card's per-player-count copy schedule —
  // none of them are in the 2-player deck at all, and uttoxeter's own copy count still grows
  // from 3p to 4p (unlike the others, which stay flat once they appear).
  {
    id: 'stoke_on_trent',
    kind: 'industrial',
    slots: [['cotton', 'manufacturer'], ['pottery', 'iron'], ['manufacturer']],
    deckCopies: [0, 3, 3],
  },
  {
    id: 'stone',
    kind: 'industrial',
    slots: [['cotton', 'brewery'], ['manufacturer', 'coal']],
    deckCopies: [0, 2, 2],
  },
  {
    id: 'leek',
    kind: 'industrial',
    slots: [['cotton', 'manufacturer'], ['cotton', 'coal']],
    deckCopies: [0, 2, 2],
  },
  {
    id: 'stafford',
    kind: 'industrial',
    slots: [['manufacturer', 'brewery'], ['pottery']],
    deckCopies: [2, 2, 2],
  },
  {
    id: 'uttoxeter',
    kind: 'industrial',
    slots: [['manufacturer', 'brewery'], ['cotton', 'brewery']],
    deckCopies: [0, 1, 2],
  },
  {
    id: 'burton_on_trent',
    kind: 'industrial',
    slots: [['manufacturer', 'coal'], ['brewery']],
    deckCopies: [2, 2, 2],
  },
  // 4-player only: absent from both the 2p and 3p decks.
  {
    id: 'belper',
    kind: 'industrial',
    slots: [['cotton', 'manufacturer'], ['coal'], ['pottery']],
    deckCopies: [0, 0, 2],
  },
  {
    id: 'derby',
    kind: 'industrial',
    slots: [['cotton', 'brewery'], ['cotton', 'manufacturer'], ['iron']],
    deckCopies: [0, 0, 3],
  },
];

export const FARM_BREWERIES: readonly FarmBreweryDef[] = [
  { id: 'farm_brewery_north', kind: 'farm_brewery', slots: [['brewery']] },
  { id: 'farm_brewery_south', kind: 'farm_brewery', slots: [['brewery']] },
];

/**
 * `minPlayers`: each external market's own badge on the board (a circled number next to its
 * trading-post tiles) reads as the minimum player count needed for that market to be in play —
 * Warrington=5, Nottingham=3, Shrewsbury=4, Oxford=2, and Gloucester carries no badge at all
 * (always in play). Warrington's gate (5) exceeds this engine's supported 2-4 player range
 * (src/core/state.ts), so it is faithfully recorded but never actually reachable until/unless
 * 5-player support is added as separate work — see ASSUMPTIONS.md.
 */
export const MARKETS: readonly MarketDef[] = [
  {
    id: 'warrington',
    kind: 'market',
    merchantSlotCount: 2,
    minPlayers: 5,
    bonus: { kind: 'money', amount: 5 },
  },
  {
    id: 'shrewsbury',
    kind: 'market',
    merchantSlotCount: 1,
    minPlayers: 4,
    bonus: { kind: 'victoryPoints', amount: 3 },
  },
  {
    id: 'nottingham',
    kind: 'market',
    merchantSlotCount: 2,
    minPlayers: 3,
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

interface RawLink {
  readonly locations: readonly [string, string];
  readonly era: Era | 'both';
}

/**
 * Buildable link slots, transcribed directly from `docs/CONECTIONS.md` (docs/ASSUMPTIONS.md
 * #24 — that file is the final source of truth, not to be second-guessed). The
 * kidderminster<->worcester slot is special: per that file's own note, building it also
 * connects both locations to farm_brewery_south (docs/RULES.md §11).
 */
const RAW_LINKS: readonly RawLink[] = [
  // "Ambas" (both eras) in docs/CONECTIONS.md
  { locations: ['warrington', 'stoke_on_trent'], era: 'both' },
  { locations: ['stoke_on_trent', 'leek'], era: 'both' },
  { locations: ['stoke_on_trent', 'stone'], era: 'both' },
  { locations: ['belper', 'derby'], era: 'both' },
  { locations: ['derby', 'burton_on_trent'], era: 'both' },
  { locations: ['derby', 'nottingham'], era: 'both' },
  { locations: ['burton_on_trent', 'stone'], era: 'both' },
  { locations: ['stone', 'stafford'], era: 'both' },
  { locations: ['stafford', 'cannock'], era: 'both' },
  { locations: ['burton_on_trent', 'tamworth'], era: 'both' },
  { locations: ['cannock', 'farm_brewery_north'], era: 'both' },
  { locations: ['cannock', 'wolverhampton'], era: 'both' },
  { locations: ['cannock', 'walsall'], era: 'both' },
  { locations: ['wolverhampton', 'coalbrookdale'], era: 'both' },
  { locations: ['coalbrookdale', 'shrewsbury'], era: 'both' },
  { locations: ['wolverhampton', 'walsall'], era: 'both' },
  { locations: ['tamworth', 'nuneaton'], era: 'both' },
  { locations: ['tamworth', 'birmingham'], era: 'both' },
  { locations: ['birmingham', 'coventry'], era: 'both' },
  { locations: ['oxford', 'birmingham'], era: 'both' },
  { locations: ['oxford', 'redditch'], era: 'both' },
  { locations: ['walsall', 'birmingham'], era: 'both' },
  { locations: ['dudley', 'birmingham'], era: 'both' },
  { locations: ['worcester', 'birmingham'], era: 'both' },
  { locations: ['worcester', 'gloucester'], era: 'both' },
  { locations: ['redditch', 'gloucester'], era: 'both' },
  { locations: ['wolverhampton', 'dudley'], era: 'both' },
  { locations: ['coalbrookdale', 'kidderminster'], era: 'both' },
  { locations: ['dudley', 'kidderminster'], era: 'both' },
  { locations: ['kidderminster', 'worcester'], era: 'both' },

  // "Somente Ferrovia" (rail only)
  { locations: ['leek', 'belper'], era: 'rail' },
  { locations: ['uttoxeter', 'stone'], era: 'rail' },
  { locations: ['uttoxeter', 'derby'], era: 'rail' },
  { locations: ['burton_on_trent', 'cannock'], era: 'rail' },
  { locations: ['tamworth', 'walsall'], era: 'rail' },
  { locations: ['nuneaton', 'coventry'], era: 'rail' },
  { locations: ['birmingham', 'nuneaton'], era: 'rail' },
  { locations: ['birmingham', 'redditch'], era: 'rail' },

  // "Somente Canal" (canal only)
  { locations: ['burton_on_trent', 'walsall'], era: 'canal' },
];

export const LINK_SLOTS: readonly LinkSlotDef[] = RAW_LINKS.map(({ locations: [a, b], era }) => ({
  id: `${a}__${b}`,
  locations: [a, b] as const,
  era,
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
