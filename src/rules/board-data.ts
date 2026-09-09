import type { Era, IndustryType, LinkSlotDef, MerchantBonus } from '../core/types.js';

/**
 * Board topology. Reconstructed from a photo of the physical board the user plays with
 * (docs/ASSUMPTIONS.md #1) — location list, per-location slot counts, market min-player
 * gates, and link connectivity are all read off that board, not invented. Two things remain
 * genuine reconstruction rather than direct transcription: the exact industry type accepted
 * by each slot (the board's tile icons are too small in a phone photo to read with full
 * confidence for every slot) and a handful of links whose era (see `LinkSlotDef.era`) couldn't
 * be read with confidence — both documented in ASSUMPTIONS.md with what's certain vs inferred.
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
    slots: [['iron'], ['cotton', 'manufacturer'], ['manufacturer', 'pottery'], ['coal', 'manufacturer']],
    deckCopies: [3, 3, 3],
  },
  {
    id: 'wolverhampton',
    kind: 'industrial',
    slots: [['coal'], ['iron', 'manufacturer']],
    deckCopies: [2, 2, 2],
  },
  {
    id: 'dudley',
    kind: 'industrial',
    slots: [['coal'], ['coal', 'iron']],
    deckCopies: [2, 2, 2],
  },
  {
    id: 'walsall',
    kind: 'industrial',
    slots: [['manufacturer', 'cotton'], ['iron']],
    deckCopies: [1, 1, 1],
  },
  {
    id: 'coventry',
    kind: 'industrial',
    slots: [['cotton'], ['cotton', 'manufacturer'], ['manufacturer']],
    deckCopies: [3, 3, 3],
  },
  {
    id: 'tamworth',
    kind: 'industrial',
    slots: [['cotton'], ['coal', 'cotton']],
    deckCopies: [1, 1, 1],
  },
  {
    id: 'nuneaton',
    kind: 'industrial',
    slots: [['cotton', 'manufacturer'], ['manufacturer']],
    deckCopies: [1, 1, 1],
  },
  {
    id: 'redditch',
    kind: 'industrial',
    slots: [['manufacturer'], ['iron', 'manufacturer']],
    deckCopies: [1, 1, 1],
  },
  {
    id: 'kidderminster',
    kind: 'industrial',
    slots: [['cotton'], ['coal', 'cotton']],
    deckCopies: [2, 2, 2],
  },
  {
    id: 'worcester',
    kind: 'industrial',
    slots: [['cotton', 'manufacturer'], ['pottery']],
    deckCopies: [2, 2, 2],
  },
  {
    id: 'cannock',
    kind: 'industrial',
    slots: [['coal'], ['coal', 'manufacturer']],
    deckCopies: [2, 2, 2],
  },
  {
    id: 'coalbrookdale',
    kind: 'industrial',
    slots: [['iron'], ['coal', 'iron']],
    deckCopies: [3, 3, 3],
  },
  // The next four are gated by the deck reference card's per-player-count copy schedule —
  // none of them are in the 2-player deck at all, and uttoxeter's own copy count still grows
  // from 3p to 4p (unlike the others, which stay flat once they appear).
  {
    id: 'stoke_on_trent',
    kind: 'industrial',
    slots: [['pottery'], ['pottery', 'coal']],
    deckCopies: [0, 3, 3],
  },
  {
    id: 'stone',
    kind: 'industrial',
    slots: [['pottery'], ['manufacturer', 'pottery']],
    deckCopies: [0, 2, 2],
  },
  {
    id: 'leek',
    kind: 'industrial',
    slots: [['cotton'], ['pottery', 'cotton']],
    deckCopies: [0, 2, 2],
  },
  {
    id: 'stafford',
    kind: 'industrial',
    slots: [['manufacturer', 'pottery'], ['iron']],
    deckCopies: [2, 2, 2],
  },
  {
    id: 'uttoxeter',
    kind: 'industrial',
    slots: [['cotton'], ['manufacturer', 'cotton']],
    deckCopies: [0, 1, 2],
  },
  {
    id: 'burton_on_trent',
    kind: 'industrial',
    slots: [['manufacturer'], ['coal', 'manufacturer']],
    deckCopies: [2, 2, 2],
  },
  // 4-player only: absent from both the 2p and 3p decks.
  {
    id: 'belper',
    kind: 'industrial',
    slots: [['cotton'], ['coal', 'cotton'], ['pottery']],
    deckCopies: [0, 0, 2],
  },
  {
    id: 'derby',
    kind: 'industrial',
    slots: [['coal', 'manufacturer'], ['iron']],
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
 * Buildable link slots, reconstructed from the board's two line styles (see `LinkSlotDef`'s
 * doc comment and ASSUMPTIONS.md for the full confidence breakdown per link). The
 * kidderminster<->worcester slot is special: building it also connects both locations to
 * farm_brewery_south (docs/RULES.md §11).
 */
const RAW_LINKS: readonly RawLink[] = [
  // North (Warrington / Potteries / Peak District towns)
  { locations: ['warrington', 'stoke_on_trent'], era: 'both' },
  { locations: ['stoke_on_trent', 'stone'], era: 'canal' },
  { locations: ['stoke_on_trent', 'leek'], era: 'rail' },
  { locations: ['stone', 'stafford'], era: 'canal' },
  { locations: ['stone', 'uttoxeter'], era: 'rail' },
  { locations: ['stafford', 'cannock'], era: 'rail' },
  { locations: ['leek', 'belper'], era: 'rail' },
  { locations: ['belper', 'derby'], era: 'both' },
  { locations: ['belper', 'burton_on_trent'], era: 'canal' },
  { locations: ['derby', 'nottingham'], era: 'rail' },
  { locations: ['uttoxeter', 'burton_on_trent'], era: 'rail' },
  { locations: ['burton_on_trent', 'tamworth'], era: 'both' },

  // Black Country core
  { locations: ['shrewsbury', 'coalbrookdale'], era: 'canal' },
  { locations: ['coalbrookdale', 'wolverhampton'], era: 'canal' },
  { locations: ['coalbrookdale', 'dudley'], era: 'canal' },
  { locations: ['cannock', 'wolverhampton'], era: 'canal' },
  { locations: ['cannock', 'walsall'], era: 'canal' },
  { locations: ['cannock', 'farm_brewery_north'], era: 'both' },
  { locations: ['wolverhampton', 'dudley'], era: 'rail' },
  { locations: ['walsall', 'birmingham'], era: 'both' },
  { locations: ['dudley', 'birmingham'], era: 'rail' },
  { locations: ['dudley', 'kidderminster'], era: 'both' },
  { locations: ['birmingham', 'redditch'], era: 'both' },
  { locations: ['birmingham', 'tamworth'], era: 'rail' },

  // South / East
  { locations: ['tamworth', 'nuneaton'], era: 'canal' },
  { locations: ['nuneaton', 'coventry'], era: 'both' },
  { locations: ['coventry', 'oxford'], era: 'canal' },
  { locations: ['redditch', 'oxford'], era: 'canal' },
  { locations: ['kidderminster', 'worcester'], era: 'canal' },
  { locations: ['worcester', 'gloucester'], era: 'canal' },
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
