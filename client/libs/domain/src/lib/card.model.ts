/** Mirrors `Card` in the engine (src/core/types.ts) — the shape the backend serializes as JSON. */
export type Card =
  | { readonly kind: 'location'; readonly locationId: string }
  | { readonly kind: 'industry'; readonly industry: IndustryType }
  | { readonly kind: 'wildLocation' }
  | { readonly kind: 'wildIndustry' };

export type IndustryType = 'coal' | 'iron' | 'cotton' | 'manufacturer' | 'pottery' | 'brewery';

export const INDUSTRY_TYPES: readonly IndustryType[] = [
  'coal',
  'iron',
  'cotton',
  'manufacturer',
  'pottery',
  'brewery',
];
