import { Injectable } from '@angular/core';
import { currentLinkPoints, findIndustryTile } from '@brass/domain';
import type { BoardLinkSummary, GameState, IndustryTileDef, IndustryType } from '@brass/domain';

@Injectable({ providedIn: 'root' })
export class IndustryTileService {
  find(tiles: readonly IndustryTileDef[], industry: IndustryType, level: 1 | 2 | 3 | 4): IndustryTileDef | undefined {
    return findIndustryTile(tiles, industry, level);
  }

  linkPoints(link: BoardLinkSummary, state: GameState, tiles: readonly IndustryTileDef[]): number {
    return currentLinkPoints(link, state, tiles);
  }
}
