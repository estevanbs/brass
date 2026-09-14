import type { LegalActionView } from '@brass/domain';

/** One step of "which mine/works does this coal/iron come from" — `options` groups the
 * candidate actions by the board location a click on that tile should narrow down to. Only
 * ever built from locations that actually vary across `matches` (see `nextResourceChoice`), so
 * there's always at least 2 entries. */
export interface ResourceChoiceStep {
  readonly resourceKind: 'coal' | 'iron';
  readonly options: ReadonlyMap<string, readonly LegalActionView[]>;
}

function sourceLocationIds(action: LegalActionView, resourceKind: 'coal' | 'iron'): readonly (string | null)[] {
  return resourceKind === 'coal' ? action.coalSourceLocationIds : action.ironSourceLocationIds;
}

/**
 * Whether `matches` (already narrowed to one build/network/develop "shape" — same target
 * location(s)/link(s)/industries, same card) still differ only in *which* coal or iron tile
 * they'd draw from, and if so, which one to ask the player about next.
 *
 * Checks coal before iron, and each resource's source slots in order (a Network action building
 * 2 rail links can need coal for each) — the first slot that actually varies across `matches`,
 * and has at least 2 distinct real board locations among them (a `null` slot resolves to the
 * market, which has no tile to click), is the next thing to ask about. Everything else
 * (remaining resource slots, or a target/industry choice unrelated to resources) is left for the
 * confirmation popup once every resource slot has settled — this only ever narrows by resource
 * source, never decides the action outright.
 */
export function nextResourceChoice(matches: readonly LegalActionView[]): ResourceChoiceStep | null {
  if (matches.length <= 1) return null;

  for (const resourceKind of ['coal', 'iron'] as const) {
    const maxSlots = matches.reduce((max, m) => Math.max(max, sourceLocationIds(m, resourceKind).length), 0);
    for (let slotIndex = 0; slotIndex < maxSlots; slotIndex++) {
      const options = new Map<string, LegalActionView[]>();
      let first: string | null | undefined;
      let varies = false;
      for (const match of matches) {
        const locationId = sourceLocationIds(match, resourceKind)[slotIndex];
        if (locationId === undefined) continue; // this candidate has no such slot at all
        if (first === undefined) first = locationId;
        else if (locationId !== first) varies = true;
        if (locationId === null) continue; // market — no tile to click
        const group = options.get(locationId) ?? [];
        group.push(match);
        options.set(locationId, group);
      }
      if (varies && options.size > 1) {
        return { resourceKind, options };
      }
    }
  }
  return null;
}
