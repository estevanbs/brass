import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { BoardSummary } from '@brass/domain';
import { MapLayoutService } from './map-layout.service';

describe('MapLayoutService', () => {
  it('exposes the same viewport size the layout was computed for', () => {
    const service = TestBed.inject(MapLayoutService);
    const board: BoardSummary = { locations: [{ id: 'birmingham', kind: 'industrial' }], links: [] };
    const layout = service.computeLayout(board);
    const point = layout.get('birmingham')!;
    expect(point.x).toBeGreaterThanOrEqual(0);
    expect(point.x).toBeLessThanOrEqual(service.width);
    expect(point.y).toBeGreaterThanOrEqual(0);
    expect(point.y).toBeLessThanOrEqual(service.height);
  });
});
