import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { GameStateService } from '@brass/application';
import type { ActionType, LegalActionView } from '@brass/domain';

/** Actions with no natural spot on the map (Loan, Pass, Scout) or that need a small follow-up
 * choice of their own (Develop, Sell) — everything spatial (Build, Network) is handled by
 * clicking the map directly, so it never shows up here. */
@Component({
  selector: 'brass-other-actions',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="other-actions">
      @if (gameState.scoutMode()) {
        <div class="other-actions-hint">Explorar: escolha mais {{ 2 - gameState.scoutPicks().length }} carta(s) na mão</div>
        <button type="button" class="other-action-btn" (click)="gameState.cancelScout()">cancelar</button>
      } @else if (gameState.selectedCard() === null) {
        <div class="other-actions-hint">{{ hintForNoSelection() }}</div>
      } @else if (byType().size === 0) {
        <div class="other-actions-hint">Essa carta não tem jogadas legais agora.</div>
      } @else {
        @if (single('loan'); as action) {
          <button type="button" class="other-action-btn" (click)="openInline('Empréstimo', [action])">Empréstimo</button>
        }
        @if (single('pass'); as action) {
          <button type="button" class="other-action-btn" (click)="openInline('Passar', [action])">Passar</button>
        }
        @if (byType().get('develop'); as actions) {
          <button type="button" class="other-action-btn" (click)="openInline('Desenvolver', actions)">Desenvolver ▾</button>
        }
        @if (byType().get('sell'); as actions) {
          <button type="button" class="other-action-btn" (click)="openInline('Vender', actions)">Vender ▾</button>
        }
        @if (byType().has('scout')) {
          <button type="button" class="other-action-btn" (click)="gameState.startScout()">Explorar</button>
        }
      }
    </div>
  `,
})
export class OtherActionsComponent {
  protected readonly gameState = inject(GameStateService);

  protected readonly byType = computed<ReadonlyMap<ActionType, readonly LegalActionView[]>>(() => {
    const map = new Map<ActionType, LegalActionView[]>();
    for (const action of this.gameState.filteredActions()) {
      if (action.type === 'build' || action.type === 'network') continue; // shown on the map instead
      const list = map.get(action.type);
      if (list === undefined) map.set(action.type, [action]);
      else list.push(action);
    }
    return map;
  });

  hintForNoSelection(): string {
    const view = this.gameState.view();
    return view !== null && view.state.gameOver ? '' : 'Selecione uma carta na mão para jogar';
  }

  single(type: ActionType): LegalActionView | undefined {
    return this.byType().get(type)?.[0];
  }

  openInline(title: string, actions: readonly LegalActionView[]): void {
    this.gameState.openPopup(title, actions, { mode: 'corner' });
  }
}
