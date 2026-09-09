import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { GameStateService } from '@brass/application';

interface ScoreRowViewModel {
  readonly id: string;
  readonly victoryPoints: number;
}

@Component({
  selector: 'brass-game-over',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="overlay">
        <div class="overlay-card">
          <h2>Fim de jogo</h2>
          <div>
            @for (row of scoreboard(); track row.id) {
              <div class="score-row"><span>{{ row.id }}</span><span>{{ row.victoryPoints }} VP</span></div>
            }
          </div>
          <button type="button" (click)="playAgain()">Jogar de novo</button>
        </div>
      </div>
    }
  `,
})
export class GameOverComponent {
  private readonly gameState = inject(GameStateService);

  readonly visible = computed(() => this.gameState.view()?.state.gameOver ?? false);

  readonly scoreboard = computed<readonly ScoreRowViewModel[]>(() => {
    const state = this.gameState.view()?.state;
    if (state === undefined) return [];
    return Object.values(state.players)
      .map((p) => ({ id: p.id, victoryPoints: p.victoryPoints }))
      .sort((a, b) => b.victoryPoints - a.victoryPoints);
  });

  playAgain(): void {
    const playerCount = Object.keys(this.gameState.view()?.state.players ?? {}).length || 2;
    void this.gameState.newGame(playerCount, undefined);
  }
}
