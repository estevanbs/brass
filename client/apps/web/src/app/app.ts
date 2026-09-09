import { ChangeDetectionStrategy, Component } from '@angular/core';
import { GameShellComponent } from '@brass/presentation';

@Component({
  selector: 'app-root',
  imports: [GameShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<brass-game-shell />`,
})
export class App {}
