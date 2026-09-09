import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { GameStateService } from '@brass/application';
import { HeaderComponent } from '../header/header.component';
import { TopStripComponent } from '../top-strip/top-strip.component';
import { BoardMapComponent } from '../board-map/board-map.component';
import { ActionPopupComponent } from '../action-popup/action-popup.component';
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
        </brass-board-map>

        <brass-log-panel />
        <brass-player-mat />

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
