import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { GameStateService, IncomeService } from '@brass/application';

interface PlayerChipViewModel {
  readonly id: string;
  readonly isHuman: boolean;
  readonly isActive: boolean;
  readonly money: number;
  readonly victoryPoints: number;
  readonly incomeLevel: number;
}

@Component({
  selector: 'brass-top-strip',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="top-strip">
      <div class="strip-era">{{ eraLabel() }}</div>
      @for (p of players(); track p.id) {
        <div class="strip-player" [class.human]="p.isHuman" [class.active]="p.isActive">
          {{ p.id }} · £{{ p.money }} · {{ p.victoryPoints }}VP · renda {{ p.incomeLevel }}
        </div>
      }
    </div>
  `,
})
export class TopStripComponent {
  private readonly gameState = inject(GameStateService);
  private readonly income = inject(IncomeService);

  readonly eraLabel = computed(() => {
    const state = this.gameState.view()?.state;
    if (state === undefined) return '';
    const eraName = state.era === 'canal' ? 'Era Canal' : 'Era Ferrovia';
    return `${eraName} · rodada ${state.round}/${state.roundsPerEra} · carvão ${state.market.coalCubes}/14 · ferro ${state.market.ironCubes}/10`;
  });

  readonly players = computed<PlayerChipViewModel[]>(() => {
    const view = this.gameState.view();
    if (view === null) return [];
    const { state, humanId } = view;
    const order = state.turnOrder.length > 0 ? state.turnOrder : Object.keys(state.players);
    return order.flatMap((id) => {
      const player = state.players[id];
      if (player === undefined) return [];
      return [
        {
          id,
          isHuman: id === humanId,
          isActive: !state.gameOver && state.turnOrder[state.activePlayerIndex] === id,
          money: player.money,
          victoryPoints: player.victoryPoints,
          incomeLevel: this.income.levelForPosition(player.incomeTrackPosition),
        },
      ];
    });
  });
}
