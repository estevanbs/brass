import { ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, computed, inject, viewChild } from '@angular/core';
import { GameStateService } from '@brass/application';

const POPUP_EDGE_MARGIN_PX = 8;

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
      <div #popupEl class="map-popup" [class.corner]="p.position.mode === 'corner'">
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

  private readonly popupEl = viewChild<ElementRef<HTMLElement>>('popupEl');

  constructor() {
    // An anchored popup opens at the tapped node's own position, so a node near the right or
    // bottom edge of the board pushed most of the popup outside `.stage` — which clips it
    // (`overflow: hidden`), leaving options invisible and untappable. A real bug on phones:
    // 238px of a popup cut off in portrait. Its size is only known once rendered, hence this.
    afterRenderEffect(() => {
      const p = this.popup();
      const el = this.popupEl()?.nativeElement;
      if (p === null || el === undefined) return;
      if (p.position.mode !== 'anchored') {
        el.style.left = '';
        el.style.top = '';
        return;
      }
      el.style.left = `${p.position.left}px`;
      el.style.top = `${p.position.top}px`;
      const container = el.offsetParent as HTMLElement | null;
      // No layout (jsdom) or not attached yet — nothing to clamp against.
      if (container === null || container.clientWidth === 0) return;
      // Measure at the origin first: shrink-to-fit width would otherwise already be squeezed by
      // the little space left between the anchor and the container's right edge.
      el.style.left = '0px';
      el.style.top = '0px';
      const maxLeft = container.clientWidth - el.offsetWidth - POPUP_EDGE_MARGIN_PX;
      const maxTop = container.clientHeight - el.offsetHeight - POPUP_EDGE_MARGIN_PX;
      el.style.left = `${Math.max(POPUP_EDGE_MARGIN_PX, Math.min(p.position.left, maxLeft))}px`;
      el.style.top = `${Math.max(POPUP_EDGE_MARGIN_PX, Math.min(p.position.top, maxTop))}px`;
    });
  }

  choose(index: number): void {
    void this.gameState.submitAction(index);
  }
}
