import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { GameStateService, PlayerColorService } from '@brass/application';

/**
 * A one-shot toast that animates in every time a bot's move streams over the WebSocket
 * (`GameStateService.botMoveToast`), so "the bots are playing" reads as a sequence of visible
 * events instead of a silent wait ending in a jump to the final state. Purely reactive to the
 * service's own timer — this component owns no timing logic of its own.
 */
@Component({
  selector: 'brass-bot-move-toast',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (toast of toasts(); track toast.key) {
      <div class="bot-move-toast" [style.--toast-color]="colorFor(toast.playerId)">
        <span class="bot-move-toast-player">{{ toast.playerId }}</span>
        <span class="bot-move-toast-label">{{ toast.actionLabel }}</span>
      </div>
    }
  `,
})
export class BotMoveToastComponent {
  private readonly gameState = inject(GameStateService);
  private readonly playerColor = inject(PlayerColorService);

  /** A 0-or-1-item array keyed by `toast.key` — `@for` then destroys and recreates the DOM
   * node for every new toast (even a same-text one right after another), which is what makes
   * the CSS animation actually replay instead of silently no-op on an unchanged element. */
  protected readonly toasts = computed(() => {
    const toast = this.gameState.botMoveToast();
    return toast === null ? [] : [toast];
  });

  protected colorFor(playerId: string): string {
    const humanId = this.gameState.view()?.humanId ?? playerId;
    return this.playerColor.colorFor(playerId, humanId);
  }
}
