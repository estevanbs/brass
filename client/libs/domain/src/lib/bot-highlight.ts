import type { ActionTargets } from './game-view.model';
import type { BuiltIndustryTile, GameState } from './game-state.model';

export interface BotHighlight {
  readonly locationIds: readonly string[];
  readonly linkSlotIds: readonly string[];
}

function tilesEqual(a: BuiltIndustryTile | null, b: BuiltIndustryTile | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.owner === b.owner &&
    a.industry === b.industry &&
    a.level === b.level &&
    a.flipped === b.flipped &&
    a.resourceRemaining === b.resourceRemaining
  );
}

/**
 * Finds every board location/link that changed between two states, excluding whatever the
 * human's own just-submitted action already targeted — i.e. everything left over is a bot's
 * doing. Needed because the backend bundles every bot turn between one human action and the
 * next into a single reply (`src/web/server.ts#advanceBotsUntilHumanOrOver`) with no structured
 * per-move target data, only a free-text log — a before/after diff is the only signal available
 * client-side for "what did the bot(s) just do".
 *
 * Location exclusion is whole-location, not per-slot (`ActionTargets` doesn't carry a slot
 * index for Build) — in the rare case a bot builds a second tile at the same location the human
 * just used, that bot move won't get its own highlight. Accepted as a minor gap rather than
 * widening `ActionTargets` just for this.
 */
export function diffBotMoves(before: GameState, after: GameState, humanTargets: ActionTargets): BotHighlight {
  const humanLocations = new Set(humanTargets.locationIds);
  const humanLinks = new Set(humanTargets.linkSlotIds);

  const locationIds = Object.keys(after.locations).filter((id) => {
    if (humanLocations.has(id)) return false;
    const prev = before.locations[id];
    const next = after.locations[id];
    if (prev === undefined || next === undefined) return false;
    return next.slots.some((slot, i) => !tilesEqual(prev.slots[i]?.tile ?? null, slot.tile));
  });

  const beforeLinkIds = new Set(before.links.map((l) => l.slotId));
  const linkSlotIds = after.links
    .filter((l) => !beforeLinkIds.has(l.slotId) && !humanLinks.has(l.slotId))
    .map((l) => l.slotId);

  return { locationIds, linkSlotIds };
}
