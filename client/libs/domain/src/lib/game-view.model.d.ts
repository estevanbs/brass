import type { Card, IndustryType } from './card.model';
import type { GameState } from './game-state.model';
export type ActionType = 'build' | 'network' | 'develop' | 'sell' | 'loan' | 'scout' | 'pass';
export interface ActionTargets {
    readonly locationIds: readonly string[];
    readonly linkSlotIds: readonly string[];
}
export interface LegalActionView {
    readonly index: number;
    readonly type: ActionType;
    readonly label: string;
    readonly cardKeys: readonly string[];
    readonly targets: ActionTargets;
}
export interface BoardLocationSummary {
    readonly id: string;
    readonly kind: 'industrial' | 'farm_brewery' | 'market';
}
export interface BoardLinkSummary {
    readonly id: string;
    readonly locations: readonly [string, string];
    readonly bonusConnections: readonly (readonly [string, string])[];
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
    readonly locked: boolean;
}
/** The full payload the backend sends after creating a game or applying an action
 * (src/web/server.ts#view) — the single source of truth the whole UI renders from. */
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
export type { Card };
//# sourceMappingURL=game-view.model.d.ts.map