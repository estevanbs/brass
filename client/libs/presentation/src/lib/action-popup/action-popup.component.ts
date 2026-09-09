import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { GameStateService } from '@brass/application';

/**
 * The one place a "list of a few options" ever appears in this UI — deliberately small,
 * since `GameStateService` only ever opens it with an already-narrowed set of actions (the
 * few legal at one clicked map spot, or the few Develop/Sell combos for the selected card).
 * Never the full, unfiltered legal-actions list.
 *
 * Doubles as the confirmation step for every action: `GameStateService`'s callers always open
 * this popup before submitting anything (even when there's only one legal option at a spot),
 * so the player always sees exactly what an action will cost — money, resources, items,
 * computed server-side (`src/web/action-cost.ts`) — before it actually happens. Clicking an
 * option is the confirmation; "cancelar" backs out without submitting anything.
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
          <button type="button" class="popup-option" (click)="choose(action.index)">
            <span class="popup-option-label">{{ action.label }}</span>
            @if (action.costLines.length > 0) {
              <span class="popup-cost-lines">
                @for (line of action.costLines; track line.label) {
                  <span class="popup-cost-line"><b>{{ line.label }}:</b> {{ line.value }}</span>
                }
              </span>
            }
          </button>
        }
        <button type="button" class="popup-close" (click)="gameState.closePopup()">cancelar</button>
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
