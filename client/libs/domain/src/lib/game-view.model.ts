import type { Card, IndustryType } from './card.model';
import type { Era, GameState } from './game-state.model';

export type ActionType = 'build' | 'network' | 'develop' | 'sell' | 'loan' | 'scout' | 'pass';

export interface ActionTargets {
  readonly locationIds: readonly string[];
  readonly linkSlotIds: readonly string[];
}

/** One line of "what this action will cost" — e.g. `{ label: 'Dinheiro', value: '-£5' }` or
 * `{ label: 'Carvão', value: 'do mercado' }`. Computed server-side (src/web/action-cost.ts) by
 * actually applying the action and diffing the result, never re-derived here. */
export interface CostLine {
  readonly label: string;
  readonly value: string;
}

export interface LegalActionView {
  readonly index: number;
  readonly type: ActionType;
  readonly label: string;
  readonly cardKeys: readonly string[];
  readonly targets: ActionTargets;
  readonly costLines: readonly CostLine[];
  /** Board location of each coal cube this action would consume, in the action's own source
   * order (index-aligned across every `LegalActionView` that otherwise shares the same
   * `targets`/`cardKeys` — e.g. a double-rail Network action's two links each have their own
   * slot here). `null` at a given index means that slot resolves to the market, not a specific
   * mine — nothing on the map to click for it. Empty when the action needs no coal at all. Lets
   * the UI offer "click the mine you want to draw from" instead of only a text-differentiated
   * popup button, for the free choice docs/RULES.md §6.1 grants among tied-nearest mines. */
  readonly coalSourceLocationIds: readonly (string | null)[];
  /** Same as `coalSourceLocationIds`, for iron works — docs/RULES.md §6.2 grants a free choice
   * of *any* unflipped works on the board, not just ties, so this is the common case where a
   * Build/Develop needing iron has more than one entry. */
  readonly ironSourceLocationIds: readonly (string | null)[];
}

export interface BoardLocationSummary {
  readonly id: string;
  readonly kind: 'industrial' | 'farm_brewery' | 'market';
}

export interface BoardLinkSummary {
  readonly id: string;
  readonly locations: readonly [string, string];
  readonly bonusConnections: readonly (readonly [string, string])[];
  /** Which era's Network action can build this link — 'both' if either era can. Does not
   * change once built (see `LinkSlotDef.era` on the backend for why). */
  readonly era: Era | 'both';
}

export interface BoardSummary {
  readonly locations: readonly BoardLocationSummary[];
  readonly links: readonly BoardLinkSummary[];
}

export interface IndustryTileDef {
  readonly industry: IndustryType;
  readonly level: 1 | 2 | 3 | 4;
  readonly cost: number;
  readonly coalCost: number;
  readonly ironCost: number;
  readonly resourceProduced: number;
  readonly beerToSell: number;
  readonly victoryPoints: number;
  readonly incomeGain: number;
  /** Cannot be removed via Develop — the only way to clear it is to actually Build it. */
  readonly locked: boolean;
  /** Canal-only: unbuildable once the rail era starts if not built yet (must Develop instead). */
  readonly eraRestricted: boolean;
}

/** The full payload the backend sends after creating a game or applying an action
 * (`GameService#view` in `client/libs/backend-application`) — the single source of truth the
 * whole UI renders from. */
export interface GameView {
  readonly gameId: string;
  readonly humanId: string;
  readonly state: GameState;
  readonly board: BoardSummary;
  readonly industryTiles: readonly IndustryTileDef[];
  readonly legalActions: readonly LegalActionView[];
  readonly log: readonly string[];
}

export interface NewGameRequest {
  readonly playerCount: number;
  readonly seed?: number;
}

/** One move applied while a `submitAction` sequence streams over the WebSocket gateway
 * (`/ws/games`) — the human's own move first, then one per bot move, in the order they
 * actually happened. `targets` is the same shape `LegalActionView` already carries, so the map
 * can highlight exactly what this specific move touched without diffing state before/after. */
export interface GameMoveEvent {
  readonly playerId: string;
  readonly actionLabel: string;
  readonly targets: ActionTargets;
  readonly view: GameView;
}

export type { Card };
