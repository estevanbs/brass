import type { Card, IndustryType } from './card.model';

/** These interfaces mirror the engine's `GameState` (src/core/types.ts) exactly — the backend
 * sends the real, serialized engine state as-is, so the frontend never re-derives game rules,
 * only reads and displays this data. */

export type Era = 'canal' | 'rail';

export interface BuiltIndustryTile {
  readonly owner: string;
  readonly industry: IndustryType;
  readonly level: 1 | 2 | 3 | 4;
  readonly flipped: boolean;
  readonly resourceRemaining: number;
}

export interface BuildSlotState {
  readonly allowedIndustries: readonly IndustryType[];
  readonly tile: BuiltIndustryTile | null;
}

export type MerchantIcon = 'cotton' | 'manufacturer' | 'pottery' | 'wild' | 'blank';

export interface MerchantSlotState {
  readonly icon: MerchantIcon | null;
  readonly hasBeer: boolean;
}

export type MerchantBonus =
  | { readonly kind: 'money'; readonly amount: number }
  | { readonly kind: 'income'; readonly spaces: number }
  | { readonly kind: 'victoryPoints'; readonly amount: number }
  | { readonly kind: 'develop' };

export interface LocationState {
  readonly id: string;
  readonly kind: 'industrial' | 'farm_brewery' | 'market';
  readonly slots: readonly BuildSlotState[];
  readonly bonus?: MerchantBonus;
  readonly merchantSlots?: readonly MerchantSlotState[];
}

export interface LinkState {
  readonly slotId: string;
  readonly owner: string;
  readonly kind: Era;
}

export interface PlayerState {
  readonly id: string;
  readonly money: number;
  readonly spentThisRound: number;
  readonly incomeTrackPosition: number;
  readonly victoryPoints: number;
  readonly linkTilesRemaining: number;
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
  readonly turnOrder: readonly string[];
  readonly activePlayerIndex: number;
  readonly actionsTakenThisTurn: number;
  readonly players: Readonly<Record<string, PlayerState>>;
  readonly locations: Readonly<Record<string, LocationState>>;
  readonly links: readonly LinkState[];
  readonly market: MarketState;
  readonly drawDeck: readonly Card[];
  readonly wildLocationCards: number;
  readonly wildIndustryCards: number;
  readonly gameOver: boolean;
}
