import type { Card, IndustryType } from './card.model';
import type { MerchantBonus, MerchantIcon } from './game-state.model';

const CARD_ICON: Readonly<Record<Card['kind'], string>> = {
  location: '🏙',
  industry: '⚙',
  wildLocation: '★',
  wildIndustry: '☆',
};

const INDUSTRY_ICON: Readonly<Record<IndustryType, string>> = {
  coal: '⚫',
  iron: '⛓',
  cotton: '🧵',
  manufacturer: '⚙',
  pottery: '🏺',
  brewery: '🍺',
};

/** A string key equal for two cards iff they represent the same value (e.g. two copies of the
 * "Coal" industry card share a key, even though the server sent two distinct objects) — must
 * stay in lockstep with the identical logic in src/engine/cards.ts#cardKey. */
export function cardKey(card: Card): string {
  if (card.kind === 'location') return `location:${card.locationId}`;
  if (card.kind === 'industry') return `industry:${card.industry}`;
  return card.kind;
}

export function cardLabel(card: Card): string {
  if (card.kind === 'location') return card.locationId.replace(/_/g, ' ');
  if (card.kind === 'industry') return card.industry;
  if (card.kind === 'wildLocation') return 'local curinga';
  return 'indústria curinga';
}

export function cardIcon(card: Card): string {
  return CARD_ICON[card.kind];
}

export function isWildCard(card: Card): boolean {
  return card.kind === 'wildLocation' || card.kind === 'wildIndustry';
}

export function cardTypeLabel(card: Card): string {
  return card.kind === 'location' || card.kind === 'wildLocation' ? 'local' : 'indústria';
}

export function industryIcon(industry: IndustryType): string {
  return INDUSTRY_ICON[industry];
}

const MERCHANT_ICON_GLYPH: Readonly<Record<MerchantIcon, string>> = {
  cotton: INDUSTRY_ICON.cotton,
  manufacturer: INDUSTRY_ICON.manufacturer,
  pottery: INDUSTRY_ICON.pottery,
  wild: '★',
  blank: '·',
};

/** What a market's merchant slot actually buys — 'wild' takes any of the three sellable
 * goods, 'blank' takes none (it only ever supplies its own beer). */
export function merchantIcon(icon: MerchantIcon): string {
  return MERCHANT_ICON_GLYPH[icon];
}

/** Short label for the one-time reward a market's merchant bonus tile pays out. */
export function merchantBonusLabel(bonus: MerchantBonus): string {
  if (bonus.kind === 'money') return `+£${bonus.amount}`;
  if (bonus.kind === 'income') return `+${bonus.spaces} renda`;
  if (bonus.kind === 'victoryPoints') return `+${bonus.amount}VP`;
  return 'desenvolver';
}
