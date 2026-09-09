import type { Card, IndustryType, PlayerId } from '../core/types.js';
import type { BeerSource, CoalSource, IronSource } from './resources.js';

export interface BuildAction {
  readonly type: 'build';
  readonly player: PlayerId;
  readonly card: Card;
  readonly locationId: string;
  readonly slotIndex: number;
  readonly industry: IndustryType;
  readonly coalSource: CoalSource | null;
  readonly ironSource: IronSource | null;
}

export interface NetworkAction {
  readonly type: 'network';
  readonly player: PlayerId;
  readonly card: Card;
  readonly linkSlotIds: readonly [string] | readonly [string, string];
  readonly coalSources: readonly CoalSource[];
  readonly beerSource: BeerSource | null;
}

export interface DevelopAction {
  readonly type: 'develop';
  readonly player: PlayerId;
  readonly card: Card;
  readonly industries: readonly [IndustryType] | readonly [IndustryType, IndustryType];
  readonly ironSources: readonly IronSource[];
}

export interface SellTileSpec {
  readonly locationId: string;
  readonly slotIndex: number;
  readonly beerSources: readonly BeerSource[];
}

export interface SellAction {
  readonly type: 'sell';
  readonly player: PlayerId;
  readonly card: Card;
  readonly sales: readonly SellTileSpec[];
}

export interface LoanAction {
  readonly type: 'loan';
  readonly player: PlayerId;
  readonly card: Card;
}

export interface ScoutAction {
  readonly type: 'scout';
  readonly player: PlayerId;
  readonly cards: readonly [Card, Card, Card];
}

export interface PassAction {
  readonly type: 'pass';
  readonly player: PlayerId;
  readonly card: Card;
}

export type Action =
  | BuildAction
  | NetworkAction
  | DevelopAction
  | SellAction
  | LoanAction
  | ScoutAction
  | PassAction;
