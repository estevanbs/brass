import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CardFormatService, GameStateService } from '@brass/application';
import type { Card } from '@brass/domain';
import { HandCardComponent } from './hand-card.component';

interface HandCardViewModel {
  readonly card: Card;
  readonly key: string;
  readonly selected: boolean;
  readonly scoutPick: boolean;
  readonly rotateDeg: number;
}

const FAN_DEGREES_PER_CARD = 4;

@Component({
  selector: 'brass-hand',
  imports: [HandCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="hand-cards">
      <!-- Tracked by index, not vm.key — a hand very routinely holds two identical cards
           (e.g. two "iron" industry cards, or two cards for the same location), and vm.key is
           derived from the card's content, not its identity, so two such cards collide on the
           same track key. That was a real, pre-existing bug (Angular logs NG0955 for it, and it
           can leave stale/misattributed DOM nodes behind after a re-render) found while adding
           mobile e2e coverage — hand order is otherwise stable within a render, so the index is
           a safe substitute. -->
      @for (vm of cards(); track i; let i = $index) {
        <brass-hand-card
          [card]="vm.card"
          [selected]="vm.selected"
          [scoutPick]="vm.scoutPick"
          [rotateDeg]="vm.rotateDeg"
          [zIndex]="i"
          (cardClick)="gameState.selectCard(vm.key)"
        />
      }
    </div>
  `,
})
export class HandComponent {
  protected readonly gameState = inject(GameStateService);
  private readonly cardFormat = inject(CardFormatService);

  readonly cards = computed<HandCardViewModel[]>(() => {
    const view = this.gameState.view();
    if (view === null) return [];
    const hand = view.state.players[view.humanId]?.hand ?? [];
    const mid = (hand.length - 1) / 2;
    const selectedCard = this.gameState.selectedCard();
    return hand.map((card, i) => {
      const key = this.cardFormat.cardKey(card);
      return {
        card,
        key,
        selected: key === selectedCard,
        scoutPick: this.gameState.isScoutPick(key),
        rotateDeg: (i - mid) * FAN_DEGREES_PER_CARD,
      };
    });
  });
}
