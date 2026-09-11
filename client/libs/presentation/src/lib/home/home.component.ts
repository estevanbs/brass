import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * `/` — lets the player choose offline (vs. bots, works with no internet once the page has
 * loaded before) or online (a real room, shared with other people, needs a connection). Pure
 * navigation, no state of its own; `/offline` and `/online` each wire up their own
 * `GameGateway` (see `app.routes.ts`).
 */
@Component({
  selector: 'brass-home',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="home">
      <h1>Brass: Birmingham</h1>
      <div class="home-modes">
        <a class="home-mode" routerLink="/offline">
          <h2>Jogar offline</h2>
          <p>Você contra bots, no seu navegador. Funciona sem internet depois do primeiro carregamento.</p>
        </a>
        <a class="home-mode" routerLink="/online">
          <h2>Jogar online</h2>
          <p>Crie uma sala e compartilhe o código com outras pessoas. Exige conexão com a internet.</p>
        </a>
      </div>
    </div>
  `,
})
export class HomeComponent {}
