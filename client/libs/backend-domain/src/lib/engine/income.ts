/** docs/RULES.md §8 — income track: position (0-99) <-> income level (-10..30). */

const MAX_POSITION = 99;
const MAX_LEVEL = 30;
const MIN_LEVEL = -10;

export function incomeLevelForPosition(position: number): number {
  if (position < 0 || position > MAX_POSITION || !Number.isInteger(position)) {
    throw new RangeError(`income track position must be an integer in [0, 99], got ${position}`);
  }
  if (position < 11) return position - 10;
  if (position < 31) return Math.floor((position - 9) / 2);
  if (position < 61) return Math.floor((position + 2) / 3);
  return Math.floor((position + 23) / 4);
}

/** Highest track position whose level is exactly `level` (used when taking a Loan). */
export function highestPositionForLevel(level: number): number {
  if (level < MIN_LEVEL || level > MAX_LEVEL || !Number.isInteger(level)) {
    throw new RangeError(`income level must be an integer in [-10, 30], got ${level}`);
  }
  if (level < 1) return level + 10;
  if (level < 11) return level * 2 + 10;
  if (level < 21) return level * 3;
  if (level < MAX_LEVEL) return level * 4 - 20;
  return MAX_POSITION;
}

/** Advances the income track by `spaces` (never past position 99, i.e. level 30). */
export function advanceIncomeSpaces(position: number, spaces: number): number {
  return Math.min(MAX_POSITION, position + spaces);
}

/** Moves the income marker back 3 levels (Loan action), landing on the highest space of
 * the new (lower) level. Throws if that would go below level -10. */
export function applyLoanIncomeDrop(position: number): number {
  const currentLevel = incomeLevelForPosition(position);
  const newLevel = currentLevel - 3;
  if (newLevel < MIN_LEVEL) {
    throw new Error(`cannot take a loan: income level would drop below ${MIN_LEVEL}`);
  }
  return highestPositionForLevel(newLevel);
}
