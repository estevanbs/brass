import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { GameStateService } from '@brass/application';

/**
 * The one place a "list of a few options" ever appears in this UI — deliberately small,
 * since `GameStateService` only ever opens it with an already-narrowed set of actions (the
 * few legal at one clicked map spot, or the few Develop/Sell combos for the selected card).
 * Never the full, unfiltered legal-actions list.
 */
@Component({
  selector: 'brass-action-popup',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (popup(); as p) {
      <div
        class="map-popup"
        [class.corner]="p.position.mode === 'corner'"
        [style.left.px]="p.position.mode === 'anchored' ? p.position.left : null"
        [style.top.px]="p.position.mode === 'anchored' ? p.position.top : null"
      >
        <div class="map-popup-title">{{ p.title }}</div>
        @for (action of p.actions; track action.index) {
          <button type="button" (click)="choose(action.index)">{{ action.label }}</button>
        }
        <button type="button" class="popup-close" (click)="gameState.closePopup()">fechar</button>
      </div>
    }
  `,
})
export class ActionPopupComponent {
  protected readonly gameState = inject(GameStateService);

  readonly popup = computed(() => this.gameState.popup());

  choose(index: number): void {
    void this.gameState.submitAction(index);
  }
}
