export type Era = 'canal' | 'rail';

export type IndustryType = 'coal' | 'iron' | 'cotton' | 'manufacturer' | 'pottery' | 'brewery';

export const INDUSTRY_TYPES: readonly IndustryType[] = [
  'coal',
  'iron',
  'cotton',
  'manufacturer',
  'pottery',
  'brewery',
];

export type MerchantIcon = 'cotton' | 'manufacturer' | 'pottery' | 'wild' | 'blank';

export type MerchantBonus =
  | { kind: 'money'; amount: number }
  | { kind: 'income'; spaces: number }
  | { kind: 'victoryPoints'; amount: number }
  | { kind: 'develop' };

export type PlayerId = string;

export interface IndustryTileId {
  industry: IndustryType;
  level: 1 | 2 | 3 | 4;
}

/** A specific physical tile instance owned by a player, e.g. the 2nd copy of coal level 2. */
export interface OwnedTile {
  readonly industry: IndustryType;
  readonly level: 1 | 2 | 3 | 4;
  readonly copyIndex: number;
}

export interface BuiltIndustryTile {
  readonly owner: PlayerId;
  readonly industry: IndustryType;
  readonly level: 1 | 2 | 3 | 4;
  readonly flipped: boolean;
  /** Remaining coal/iron/beer units sitting on the tile, if any. */
  readonly resourceRemaining: number;
}

export interface BuildSlotState {
  readonly allowedIndustries: readonly IndustryType[];
  readonly tile: BuiltIndustryTile | null;
}

export interface BuildableLocationState {
  readonly id: string;
  readonly kind: 'industrial' | 'farm_brewery';
  readonly slots: readonly BuildSlotState[];
}

export interface MerchantSlotState {
  readonly icon: MerchantIcon | null;
  readonly hasBeer: boolean;
}

export interface MarketLocationState {
  readonly id: string;
  readonly kind: 'market';
  readonly slots: readonly BuildSlotState[];
  readonly bonus: MerchantBonus;
  readonly merchantSlots: readonly MerchantSlotState[];
}

export type LocationState = BuildableLocationState | MarketLocationState;

/** A buildable line on the board. Most connect exactly 2 locations; the
 * Kidderminster-Worcester slot also silently connects Farm Brewery South.
 *
 * `era` restricts which era's link tile can be built here — reconstructed from the physical
 * board (docs/ASSUMPTIONS.md #1), which draws two visually distinct line styles: a thin blue
 * canal/river line and a grey rail-tie track. `'both'` is the default for a slot drawn with
 * only one style where the two towns are also connected in the other era via a different pair
 * (or where the distinction couldn't be read with confidence — see ASSUMPTIONS.md for exactly
 * which slots that applies to). This does not change once built: a built link is scored and
 * removed at every era's end regardless of its `era` tag (src/engine/scoring.ts), so the tag
 * only ever gates *new* Network actions (src/engine/legal/network.ts). */
export interface LinkSlotDef {
  readonly id: string;
  readonly locations: readonly [string, string];
  readonly bonusConnections: readonly (readonly [string, string])[];
  readonly era: Era | 'both';
}

export interface LinkState {
  readonly slotId: string;
  readonly owner: PlayerId;
  readonly kind: Era;
}

export type CardId = string;

export type Card =
  | { readonly kind: 'location'; readonly locationId: string }
  | { readonly kind: 'industry'; readonly industry: IndustryType }
  | { readonly kind: 'wildLocation' }
  | { readonly kind: 'wildIndustry' };

export interface PlayerState {
  readonly id: PlayerId;
  readonly money: number;
  readonly spentThisRound: number;
  readonly incomeTrackPosition: number;
  readonly victoryPoints: number;
  readonly linkTilesRemaining: number;
  /** Remaining stock per industry, lowest level first (front of array = next tile built). */
  readonly industryStock: Readonly<Record<IndustryType, readonly (1 | 2 | 3 | 4)[]>>;
  readonly hand: readonly Card[];
  readonly discardPile: readonly Card[];
}

export interface MarketState {
  readonly coalCubes: number;
  readonly ironCubes: number;
}

export interface GameState {
  readonly era: Era;
  readonly round: number;
  readonly roundsPerEra: number;
  readonly turnOrder: readonly PlayerId[];
  readonly activePlayerIndex: number;
  readonly actionsTakenThisTurn: number;
  readonly players: Readonly<Record<PlayerId, PlayerState>>;
  readonly locations: Readonly<Record<string, LocationState>>;
  readonly links: readonly LinkState[];
  readonly market: MarketState;
  readonly drawDeck: readonly Card[];
  readonly wildLocationCards: number;
  readonly wildIndustryCards: number;
  readonly rngState: number;
  readonly gameOver: boolean;
}
