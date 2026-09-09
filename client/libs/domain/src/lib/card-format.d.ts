import type { Card, IndustryType } from './card.model';
/** A string key equal for two cards iff they represent the same value (e.g. two copies of the
 * "Coal" industry card share a key, even though the server sent two distinct objects) — must
 * stay in lockstep with the identical logic in src/engine/cards.ts#cardKey. */
export declare function cardKey(card: Card): string;
export declare function cardLabel(card: Card): string;
export declare function cardIcon(card: Card): string;
export declare function isWildCard(card: Card): boolean;
export declare function cardTypeLabel(card: Card): string;
export declare function industryIcon(industry: IndustryType): string;
//# sourceMappingURL=card-format.d.ts.map