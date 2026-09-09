import type { Card } from '../core/types.js';

/** A string key that is equal for two cards iff they represent the same value (e.g. two
 * copies of the "Coal" industry card share a key, even though they are different objects). */
export function cardKey(card: Card): string {
  if (card.kind === 'location') return `location:${card.locationId}`;
  if (card.kind === 'industry') return `industry:${card.industry}`;
  return card.kind;
}

/** One representative per distinct card value in `hand` — duplicate copies of the same card
 * collapse to a single entry (docs/PLANO.md M4: "escolhas equivalentes devem colapsar"). */
export function distinctCards(hand: readonly Card[]): Card[] {
  const seen = new Set<string>();
  const result: Card[] = [];
  for (const card of hand) {
    const key = cardKey(card);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(card);
    }
  }
  return result;
}
