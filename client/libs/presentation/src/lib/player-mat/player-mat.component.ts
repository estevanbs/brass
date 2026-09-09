import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CardFormatService, GameStateService } from '@brass/application';
import { INDUSTRY_TYPES, type IndustryTileDef, type IndustryType } from '@brass/domain';

interface TileChipViewModel {
  readonly level: 1 | 2 | 3 | 4;
  readonly isNext: boolean;
  readonly isLocked: boolean;
  readonly cost: number | null;
  readonly tooltip: string;
}

interface IndustryColumnViewModel {
  readonly industry: IndustryType;
  readonly icon: string;
  readonly tiles: readonly TileChipViewModel[];
}

@Component({
  selector: 'brass-player-mat',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mat-dock">
      <button type="button" class="mat-toggle" (click)="open.set(!open())">🗂 tabuleiros</button>
      @if (open()) {
        <div class="mat-panel">
          <div class="mat-tabs">
            @for (p of playerIds(); track p) {
              <button type="button" [class.active]="p === gameState.selectedMatPlayer()" (click)="gameState.selectMatPlayer(p)">
                {{ p === humanId() ? p + ' (você)' : p }}
              </button>
            }
          </div>
          <div class="mat-stock">
            @for (col of columns(); track col.industry) {
              <div class="mat-industry">
                <div class="mat-industry-title"><span>{{ col.icon }}</span><span>{{ col.industry }}</span></div>
                <div class="mat-tile-row">
                  @if (col.tiles.length === 0) {
                    <div class="mat-tile-empty">esgotado</div>
                  }
                  @for (tile of col.tiles; track $index) {
                    <div
                      class="mat-tile"
                      [class.next]="tile.isNext"
                      [class.locked]="tile.isLocked"
                      [style.background]="'var(--' + col.industry + ')'"
                      [title]="tile.tooltip"
                    >
                      <div>L{{ tile.level }}</div>
                      @if (tile.cost !== null) {
                        <div>£{{ tile.cost }}</div>
                      }
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class PlayerMatComponent {
  protected readonly gameState = inject(GameStateService);
  private readonly cardFormat = inject(CardFormatService);
  protected readonly open = signal(false);

  protected readonly humanId = computed(() => this.gameState.view()?.humanId ?? null);

  protected readonly playerIds = computed<readonly string[]>(() => {
    const state = this.gameState.view()?.state;
    if (state === undefined) return [];
    return state.turnOrder.length > 0 ? state.turnOrder : Object.keys(state.players);
  });

  protected readonly columns = computed<readonly IndustryColumnViewModel[]>(() => {
    const view = this.gameState.view();
    const playerId = this.gameState.selectedMatPlayer();
    if (view === null || playerId === null) return [];
    const player = view.state.players[playerId];
    if (player === undefined) return [];

    return INDUSTRY_TYPES.map((industry) => ({
      industry,
      icon: this.cardFormat.industryIcon(industry),
      tiles: (player.industryStock[industry] ?? []).map((level, i) => this.toTileViewModel(view.industryTiles, industry, level, i === 0)),
    }));
  });

  private toTileViewModel(
    tiles: readonly IndustryTileDef[],
    industry: IndustryType,
    level: 1 | 2 | 3 | 4,
    isNext: boolean,
  ): TileChipViewModel {
    const info = tiles.find((t) => t.industry === industry && t.level === level) ?? null;
    const resourceNote = info === null ? '' : `${info.coalCost ? ` + ${info.coalCost} carvão` : ''}${info.ironCost ? ` + ${info.ironCost} ferro` : ''}`;
    const lockedNote = info?.locked ? ' · TRAVADA (só via Construir — não pode ser Desenvolvida)' : '';
    const eraNote = info?.eraRestricted ? ' · só era Canal (depois só via Desenvolver)' : '';
    const tooltip =
      info === null
        ? `Nível ${level}`
        : `Nível ${level} — custo £${info.cost}${resourceNote} · ${info.victoryPoints}VP · renda +${info.incomeGain}${lockedNote}${eraNote}`;
    return {
      level,
      isNext,
      isLocked: info?.locked ?? false,
      cost: info?.cost ?? null,
      tooltip,
    };
  }
}
