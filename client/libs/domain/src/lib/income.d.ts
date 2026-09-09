/**
 * The income track's position-to-level formula (docs/RULES.md §8, src/engine/income.ts) — the
 * frontend only ever needs to *display* a level from a position, never to change one (that
 * always happens server-side), so this is the one read-only fragment of engine math it
 * duplicates. Kept isolated and pure so it's trivially testable against the same fixtures as
 * the backend's own income.test.ts.
 */
export declare function incomeLevelForPosition(position: number): number;
//# sourceMappingURL=income.d.ts.map