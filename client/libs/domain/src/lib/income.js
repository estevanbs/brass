/**
 * The income track's position-to-level formula (docs/RULES.md §8, src/engine/income.ts) — the
 * frontend only ever needs to *display* a level from a position, never to change one (that
 * always happens server-side), so this is the one read-only fragment of engine math it
 * duplicates. Kept isolated and pure so it's trivially testable against the same fixtures as
 * the backend's own income.test.ts.
 */
export function incomeLevelForPosition(position) {
    if (position < 11)
        return position - 10;
    if (position < 31)
        return Math.floor((position - 9) / 2);
    if (position < 61)
        return Math.floor((position + 2) / 3);
    return Math.floor((position + 23) / 4);
}
//# sourceMappingURL=income.js.map