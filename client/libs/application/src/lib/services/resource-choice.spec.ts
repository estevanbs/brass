import { describe, expect, it } from 'vitest';
import type { LegalActionView } from '@brass/domain';
import { nextResourceChoice } from './resource-choice';

function legalAction(overrides: Partial<LegalActionView> = {}): LegalActionView {
  return {
    index: 0,
    type: 'build',
    label: '',
    cardKeys: ['location:worcester'],
    targets: { locationIds: ['worcester'], linkSlotIds: [] },
    costLines: [],
    coalSourceLocationIds: [],
    ironSourceLocationIds: [],
    ...overrides,
  };
}

describe('nextResourceChoice', () => {
  it('returns null for zero or one match — nothing to choose between', () => {
    expect(nextResourceChoice([])).toBeNull();
    expect(nextResourceChoice([legalAction()])).toBeNull();
  });

  it('returns null when matches differ, but not by any resource source (e.g. different slot index)', () => {
    const a = legalAction({ index: 0 });
    const b = legalAction({ index: 1 });
    expect(nextResourceChoice([a, b])).toBeNull();
  });

  it('groups by coal source when two matches differ only by which tied-nearest mine to use', () => {
    const a = legalAction({ index: 0, coalSourceLocationIds: ['dudley'] });
    const b = legalAction({ index: 1, coalSourceLocationIds: ['walsall'] });
    const step = nextResourceChoice([a, b]);
    expect(step?.resourceKind).toBe('coal');
    expect(new Set(step?.options.keys())).toEqual(new Set(['dudley', 'walsall']));
    expect(step?.options.get('dudley')).toEqual([a]);
    expect(step?.options.get('walsall')).toEqual([b]);
  });

  it('groups by iron source when matches differ only by which works to use', () => {
    const a = legalAction({ index: 0, ironSourceLocationIds: ['dudley'] });
    const b = legalAction({ index: 1, ironSourceLocationIds: ['coventry'] });
    const c = legalAction({ index: 2, ironSourceLocationIds: ['coventry'] });
    const step = nextResourceChoice([a, b, c]);
    expect(step?.resourceKind).toBe('iron');
    expect(step?.options.get('dudley')).toEqual([a]);
    // Two different candidates can legitimately resolve to the same works tile (e.g. a
    // different slot index elsewhere in the action) — both stay grouped under it.
    expect(step?.options.get('coventry')).toEqual([b, c]);
  });

  it('checks coal before iron when both vary across the same match set', () => {
    const a = legalAction({ index: 0, coalSourceLocationIds: ['dudley'], ironSourceLocationIds: ['coventry'] });
    const b = legalAction({ index: 1, coalSourceLocationIds: ['walsall'], ironSourceLocationIds: ['birmingham'] });
    const step = nextResourceChoice([a, b]);
    expect(step?.resourceKind).toBe('coal');
  });

  it('does not treat a market-only difference as a choice — nothing on the map to click for it', () => {
    // Only one real location varies; the rest is `null` (market) on one side — `options` would
    // have a single entry, not a real choice.
    const a = legalAction({ index: 0, coalSourceLocationIds: ['dudley'] });
    const b = legalAction({ index: 1, coalSourceLocationIds: ['dudley'] });
    expect(nextResourceChoice([a, b])).toBeNull();
  });

  it('picks the first slot index that actually varies for a multi-slot resource (e.g. a double network link)', () => {
    const a = legalAction({ index: 0, coalSourceLocationIds: ['dudley', 'walsall'] });
    const b = legalAction({ index: 1, coalSourceLocationIds: ['dudley', 'coventry'] });
    const step = nextResourceChoice([a, b]);
    // Index 0 is identical ('dudley' on both) — the real choice is at index 1.
    expect(step?.resourceKind).toBe('coal');
    expect(new Set(step?.options.keys())).toEqual(new Set(['walsall', 'coventry']));
  });

  it('lets a null (market) slot coexist with a real-location choice at a different index', () => {
    const a = legalAction({ index: 0, coalSourceLocationIds: [null, 'walsall'] });
    const b = legalAction({ index: 1, coalSourceLocationIds: [null, 'coventry'] });
    const step = nextResourceChoice([a, b]);
    expect(step?.resourceKind).toBe('coal');
    expect(new Set(step?.options.keys())).toEqual(new Set(['walsall', 'coventry']));
  });
});
