import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { GameStateService } from '@brass/application';

@Component({
  selector: 'brass-log-panel',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="log-dock">
      <button type="button" class="log-toggle" (click)="open.set(!open())">📜 registro {{ open() ? '▾' : '▸' }}</button>
      @if (open()) {
        <div class="log">
          @for (line of reversedLog(); track $index) {
            <div>{{ line }}</div>
          }
        </div>
      }
    </div>
  `,
})
export class LogPanelComponent {
  private readonly gameState = inject(GameStateService);
  protected readonly open = signal(true);

  reversedLog(): readonly string[] {
    return [...(this.gameState.view()?.log ?? [])].reverse();
  }
}
