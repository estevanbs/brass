/** Assigns a stable display color per player id — the human always gets the accent red, bots
 * get one of a fixed palette keyed by the numeral in their id (e.g. "bot2" -> index 2), so the
 * same bot keeps the same color across a whole game without the server needing to send one. */
export declare function playerColorFor(playerId: string, humanId: string): string;
//# sourceMappingURL=player-color.d.ts.map