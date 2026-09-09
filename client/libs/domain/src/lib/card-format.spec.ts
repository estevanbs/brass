import { describe, expect, it } from 'vitest';
import { cardIcon, cardKey, cardLabel, cardTypeLabel, isWildCard, merchantBonusLabel, merchantIcon } from './card-format';
import type { Card } from './card.model';
import type { MerchantBonus, MerchantIcon } from './game-state.model';

describe('cardKey', () => {
  it('gives two location cards for the same town the same key', () => {
    const a: Card = { kind: 'location', locationId: 'birmingham' };
    const b: Card = { kind: 'location', locationId: 'birmingham' };
    expect(cardKey(a)).toBe(cardKey(b));
  });

  it('distinguishes different locations', () => {
    const a: Card = { kind: 'location', locationId: 'birmingham' };
    const b: Card = { kind: 'location', locationId: 'oxford' };
    expect(cardKey(a)).not.toBe(cardKey(b));
  });

  it('gives two industry cards for the same industry the same key', () => {
    const a: Card = { kind: 'industry', industry: 'coal' };
    const b: Card = { kind: 'industry', industry: 'coal' };
    expect(cardKey(a)).toBe(cardKey(b));
  });

  it('gives wild cards a fixed key regardless of instance', () => {
    expect(cardKey({ kind: 'wildLocation' })).toBe('wildLocation');
    expect(cardKey({ kind: 'wildIndustry' })).toBe('wildIndustry');
  });
});

describe('cardLabel', () => {
  it('replaces underscores with spaces for location cards', () => {
    expect(cardLabel({ kind: 'location', locationId: 'stoke_on_trent' })).toBe('stoke on trent');
  });

  it('labels industry cards with the industry name', () => {
    expect(cardLabel({ kind: 'industry', industry: 'cotton' })).toBe('cotton');
  });

  it('labels wild cards in Portuguese', () => {
    expect(cardLabel({ kind: 'wildLocation' })).toBe('local curinga');
    expect(cardLabel({ kind: 'wildIndustry' })).toBe('indústria curinga');
  });
});

describe('isWildCard', () => {
  it('is true only for the two wild kinds', () => {
    expect(isWildCard({ kind: 'wildLocation' })).toBe(true);
    expect(isWildCard({ kind: 'wildIndustry' })).toBe(true);
    expect(isWildCard({ kind: 'location', locationId: 'oxford' })).toBe(false);
    expect(isWildCard({ kind: 'industry', industry: 'iron' })).toBe(false);
  });
});

describe('cardTypeLabel', () => {
  it('groups location and wildLocation as "local"', () => {
    expect(cardTypeLabel({ kind: 'location', locationId: 'oxford' })).toBe('local');
    expect(cardTypeLabel({ kind: 'wildLocation' })).toBe('local');
  });

  it('groups industry and wildIndustry as "indústria"', () => {
    expect(cardTypeLabel({ kind: 'industry', industry: 'iron' })).toBe('indústria');
    expect(cardTypeLabel({ kind: 'wildIndustry' })).toBe('indústria');
  });
});

describe('cardIcon', () => {
  it('returns a non-empty icon for every card kind', () => {
    const kinds: Card[] = [
      { kind: 'location', locationId: 'oxford' },
      { kind: 'industry', industry: 'iron' },
      { kind: 'wildLocation' },
      { kind: 'wildIndustry' },
    ];
    for (const card of kinds) {
      expect(cardIcon(card).length).toBeGreaterThan(0);
    }
  });
});

describe('merchantIcon', () => {
  it('returns a distinct, non-empty glyph for every merchant icon', () => {
    const icons: MerchantIcon[] = ['cotton', 'manufacturer', 'pottery', 'wild', 'blank'];
    const glyphs = icons.map(merchantIcon);
    expect(glyphs.every((g) => g.length > 0)).toBe(true);
    expect(new Set(glyphs).size).toBe(icons.length);
  });
});

describe('merchantBonusLabel', () => {
  it('formats each bonus kind', () => {
    expect(merchantBonusLabel({ kind: 'money', amount: 5 })).toBe('+£5');
    expect(merchantBonusLabel({ kind: 'income', spaces: 2 })).toBe('+2 renda');
    expect(merchantBonusLabel({ kind: 'victoryPoints', amount: 3 })).toBe('+3VP');
    expect(merchantBonusLabel({ kind: 'develop' } as MerchantBonus)).toBe('desenvolver');
  });
});
