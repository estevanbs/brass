import { Injectable } from '@angular/core';
import { incomeLevelForPosition } from '@brass/domain';

@Injectable({ providedIn: 'root' })
export class IncomeService {
  levelForPosition(position: number): number {
    return incomeLevelForPosition(position);
  }
}
