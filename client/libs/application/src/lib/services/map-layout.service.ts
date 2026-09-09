import { Injectable } from '@angular/core';
import { computeMapLayout, MAP_HEIGHT, MAP_WIDTH } from '@brass/domain';
import type { BoardSummary, Point } from '@brass/domain';

@Injectable({ providedIn: 'root' })
export class MapLayoutService {
  readonly width = MAP_WIDTH;
  readonly height = MAP_HEIGHT;

  computeLayout(board: BoardSummary): Map<string, Point> {
    return computeMapLayout(board);
  }
}
