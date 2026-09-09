import { Injectable } from '@angular/core';
import { playerColorFor } from '@brass/domain';

@Injectable({ providedIn: 'root' })
export class PlayerColorService {
  colorFor(playerId: string, humanId: string): string {
    return playerColorFor(playerId, humanId);
  }
}
