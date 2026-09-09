import { LINK_SLOTS } from '../rules/board-data.js';
import type { GameState, LinkState, PlayerId } from '../core/types.js';

const LINK_SLOT_BY_ID = new Map(LINK_SLOTS.map((l) => [l.id, l]));

function edgesForLink(link: LinkState): (readonly [string, string])[] {
  const def = LINK_SLOT_BY_ID.get(link.slotId);
  if (def === undefined) {
    throw new Error(`unknown link slot id: ${link.slotId}`);
  }
  return [def.locations, ...def.bonusConnections];
}

/** Adjacency built from every link tile currently on the board, regardless of owner. */
export function buildAdjacency(state: GameState): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  const addEdge = (a: string, b: string): void => {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)?.add(b);
    adjacency.get(b)?.add(a);
  };
  for (const link of state.links) {
    for (const [a, b] of edgesForLink(link)) {
      addEdge(a, b);
    }
  }
  return adjacency;
}

/** BFS distances (in link tiles) from `from` to every location reachable via built links. */
export function bfsDistances(state: GameState, from: string): Map<string, number> {
  const adjacency = buildAdjacency(state);
  const distances = new Map<string, number>([[from, 0]]);
  const queue: string[] = [from];
  let head = 0;
  while (head < queue.length) {
    const current = queue[head];
    head += 1;
    if (current === undefined) continue;
    const currentDistance = distances.get(current) ?? 0;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!distances.has(neighbor)) {
        distances.set(neighbor, currentDistance + 1);
        queue.push(neighbor);
      }
    }
  }
  return distances;
}

export function areConnected(state: GameState, a: string, b: string): boolean {
  if (a === b) return true;
  return bfsDistances(state, a).has(b);
}

/**
 * A location is part of a player's network if it holds one of their industry tiles, or is
 * an endpoint of one of their own built links (docs/RULES.md §4.2).
 */
export function locationsInNetwork(state: GameState, playerId: PlayerId): Set<string> {
  const result = new Set<string>();
  for (const location of Object.values(state.locations)) {
    for (const slot of location.slots) {
      if (slot.tile?.owner === playerId) {
        result.add(location.id);
      }
    }
  }
  for (const link of state.links) {
    if (link.owner !== playerId) continue;
    for (const [a, b] of edgesForLink(link)) {
      result.add(a);
      result.add(b);
    }
  }
  return result;
}

export function isInNetwork(state: GameState, playerId: PlayerId, locationId: string): boolean {
  return locationsInNetwork(state, playerId).has(locationId);
}

export function hasAnyTilesOnBoard(state: GameState, playerId: PlayerId): boolean {
  for (const location of Object.values(state.locations)) {
    for (const slot of location.slots) {
      if (slot.tile?.owner === playerId) return true;
    }
  }
  return state.links.some((l) => l.owner === playerId);
}

/** A location is connected to a merchant that can buy coal (docs/RULES.md §6.1). */
export function isConnectedToCoalMerchant(state: GameState, locationId: string): boolean {
  const distances = bfsDistances(state, locationId);
  for (const location of Object.values(state.locations)) {
    if (location.kind === 'market' && distances.has(location.id)) {
      return true;
    }
  }
  return false;
}
