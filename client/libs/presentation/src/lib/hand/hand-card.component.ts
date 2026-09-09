import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CardFormatService } from '@brass/application';
import type { Card } from '@brass/domain';

/**
 * One playing-card-shaped tile in the hand. Purely presentational (`@Input`/`@Output` only,
 * no service injection beyond the stateless formatter) so it is trivial to test and reuse —
 * `HandComponent` owns the actual selection state.
 */
@Component({
  selector: 'brass-hand-card',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="hand-card"
      [class.selected]="selected"
      [class.scout-pick]="scoutPick"
      [class.wild]="cardFormat.isWild(card)"
      [style.--rotate.deg]="rotateDeg"
      [style.--lift.px]="selected || scoutPick ? -26 : 0"
      [style.z-index]="selected ? 100 : zIndex"
      (click)="cardClick.emit()"
    >
      <div class="hand-card-icon">{{ icon() }}</div>
      <div class="hand-card-label">{{ cardFormat.label(card) }}</div>
      <div class="hand-card-type">{{ cardFormat.typeLabel(card) }}</div>
    </button>
  `,
})
export class HandCardComponent {
  protected readonly cardFormat = inject(CardFormatService);

  @Input({ required: true }) card!: Card;
  @Input() selected = false;
  @Input() scoutPick = false;
  @Input() rotateDeg = 0;
  @Input() zIndex = 0;
  @Output() readonly cardClick = new EventEmitter<void>();

  /** Industry cards show which industry they let you build (e.g. 🧵 for cotton) instead of the
   * generic ⚙ card-kind icon — location/wild cards keep that generic icon, since they don't
   * name a single industry. */
  protected icon(): string {
    return this.card.kind === 'industry' ? this.cardFormat.industryIcon(this.card.industry) : this.cardFormat.icon(this.card);
  }
}
