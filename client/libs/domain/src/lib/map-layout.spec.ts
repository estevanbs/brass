import { describe, expect, it } from 'vitest';
import { computeMapLayout, MAP_HEIGHT, MAP_WIDTH } from './map-layout';
import type { BoardSummary } from './game-view.model';

function board(ids: string[]): BoardSummary {
  return { locations: ids.map((id) => ({ id, kind: 'industrial' as const })), links: [] };
}

describe('computeMapLayout', () => {
  it('places one node per location', () => {
    const layout = computeMapLayout(board(['birmingham', 'oxford', 'stoke_on_trent']));
    expect(layout.size).toBe(3);
    for (const id of ['birmingham', 'oxford', 'stoke_on_trent']) {
      expect(layout.has(id)).toBe(true);
    }
  });

  it('keeps every point within the map viewport', () => {
    const layout = computeMapLayout(
      board(['birmingham', 'oxford', 'stoke_on_trent', 'warrington', 'gloucester', 'nottingham']),
    );
    for (const point of layout.values()) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(MAP_WIDTH);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(MAP_HEIGHT);
    }
  });

  it('places the northernmost town above the southernmost one', () => {
    // Stoke-on-Trent (lat ~53.0) is north of Oxford (lat ~51.75); SVG y grows downward.
    const layout = computeMapLayout(board(['stoke_on_trent', 'oxford']));
    const stoke = layout.get('stoke_on_trent')!;
    const oxford = layout.get('oxford')!;
    expect(stoke.y).toBeLessThan(oxford.y);
  });

  it('falls back to a default coordinate for an unknown location id without throwing', () => {
    const layout = computeMapLayout(board(['not_a_real_town']));
    expect(layout.get('not_a_real_town')).toBeDefined();
  });

  it('does not divide by zero when every location is the same town', () => {
    const layout = computeMapLayout(board(['birmingham', 'birmingham']));
    const point = layout.get('birmingham')!;
    expect(Number.isFinite(point.x)).toBe(true);
    expect(Number.isFinite(point.y)).toBe(true);
  });
});
