import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GameStateService } from '@brass/application';

@Component({
  selector: 'brass-header',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="setup">
      <label
        >Jogadores
        <select [(ngModel)]="playerCount">
          <option [ngValue]="2">2</option>
          <option [ngValue]="3">3</option>
          <option [ngValue]="4">4</option>
        </select>
      </label>
      <label>Seed <input type="number" placeholder="aleatória" [(ngModel)]="seedInput" /></label>
      <button type="button" (click)="startNewGame()">Novo jogo</button>
      <span class="status">{{ gameState.statusMessage() }}</span>
    </div>
  `,
})
export class HeaderComponent {
  protected readonly gameState = inject(GameStateService);

  protected readonly playerCount = signal(2);
  // NumberValueAccessor (bound to <input type="number">) writes `null` for an empty field and
  // a `number` otherwise — never a string — so the signal must match that, not `signal('')`.
  protected readonly seedInput = signal<number | null>(null);

  startNewGame(): void {
    void this.gameState.newGame(this.playerCount(), this.seedInput() ?? undefined);
  }
}
