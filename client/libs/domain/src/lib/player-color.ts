const PLAYER_COLORS: readonly string[] = ['#a8432f', '#2f6b47', '#2f5a8a', '#8a5a2f'];
const HUMAN_COLOR = '#a8432f';

/** Assigns a stable display color per player id — the human always gets the accent red, bots
 * get one of a fixed palette keyed by the numeral in their id (e.g. "bot2" -> index 2), so the
 * same bot keeps the same color across a whole game without the server needing to send one. */
export function playerColorFor(playerId: string, humanId: string): string {
  if (playerId === humanId) return HUMAN_COLOR;
  const idx = Number(playerId.replace(/\D/g, '')) || 1;
  return PLAYER_COLORS[idx % PLAYER_COLORS.length] ?? PLAYER_COLORS[0]!;
}
