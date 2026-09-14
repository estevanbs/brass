import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { GameStateService } from '@brass/application';
import { HeaderComponent } from '../header/header.component';
import { TopStripComponent } from '../top-strip/top-strip.component';
import { BoardMapComponent } from '../board-map/board-map.component';
import { ActionPopupComponent } from '../action-popup/action-popup.component';
import { BotMoveToastComponent } from '../bot-move-toast/bot-move-toast.component';
import { LogPanelComponent } from '../log-panel/log-panel.component';
import { PlayerMatComponent } from '../player-mat/player-mat.component';
import { OtherActionsComponent } from '../other-actions/other-actions.component';
import { HandComponent } from '../hand/hand.component';
import { GameOverComponent } from '../game-over/game-over.component';

/**
 * The one component `apps/web` renders. Composes every feature component from this library
 * around the shared `GameStateService`, so the app shell itself stays a pure composition root
 * (bootstrap + DI wiring only) with no game-screen markup or logic of its own.
 */
@Component({
  selector: 'brass-game-shell',
  imports: [
    HeaderComponent,
    TopStripComponent,
    BoardMapComponent,
    ActionPopupComponent,
    BotMoveToastComponent,
    LogPanelComponent,
    PlayerMatComponent,
    OtherActionsComponent,
    HandComponent,
    GameOverComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <h1>Brass: Birmingham</h1>
      <brass-header />
    </header>

    @if (gameState.view(); as view) {
      <main class="app-main">
        <brass-top-strip />

        <brass-board-map>
          <brass-action-popup />
          <brass-bot-move-toast />
          <!-- Projected into .stage (not left as app-main's direct children) so .log-dock and
               .mat-dock are absolutely positioned against .stage's own box — which the flex
               layout already sizes to exclude the hand dock below it — instead of app-main's
               full box, which includes the hand dock. Anchored to the latter, a .mat-panel
               tall enough (its default-open state, see PlayerMatComponent) could overlap the
               hand cards on a short screen: a real bug found via mobile e2e coverage, where
               that overlap intercepted taps meant for the hand. -->
          <brass-log-panel />
          <brass-player-mat />
        </brass-board-map>

        <div class="hand-dock">
          <brass-other-actions />
          <brass-hand />
        </div>
      </main>

      <brass-game-over />
    }
  `,
})
export class GameShellComponent {
  protected readonly gameState = inject(GameStateService);
}
