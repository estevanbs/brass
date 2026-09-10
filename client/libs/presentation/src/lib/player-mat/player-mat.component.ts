import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CardFormatService, GameStateService, IndustryTileService } from '@brass/application';
import { INDUSTRY_TYPES, type IndustryTileDef, type IndustryType } from '@brass/domain';

interface TileChipViewModel {
  readonly level: 1 | 2 | 3 | 4;
  readonly isNext: boolean;
  readonly isLocked: boolean;
  readonly cost: number | null;
  readonly victoryPoints: number | null;
  readonly incomeGain: number | null;
  readonly tooltip: string;
}

/** A tile this player already has on the board — kept visible on the mat as a reference for
 * its VP/renda even after it leaves the stock, since that's the whole point of a "personal
 * board": seeing what you've already committed, not just what's left to place. */
interface BuiltTileChipViewModel {
  readonly locationId: string;
  readonly level: 1 | 2 | 3 | 4;
  readonly flipped: boolean;
  readonly victoryPoints: number | null;
  readonly incomeGain: number | null;
  readonly tooltip: string;
}

interface IndustryColumnViewModel {
  readonly industry: IndustryType;
  readonly icon: string;
  readonly tiles: readonly TileChipViewModel[];
  readonly built: readonly BuiltTileChipViewModel[];
}

interface BuiltTileEntry {
  readonly locationId: string;
  readonly industry: IndustryType;
  readonly level: 1 | 2 | 3 | 4;
  readonly flipped: boolean;
}

@Component({
  selector: 'brass-player-mat',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mat-dock">
      <button type="button" class="mat-toggle" (click)="open.set(!open())">🗂 tabuleiros {{ open() ? '▾' : '▸' }}</button>
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
                      @if (tile.victoryPoints !== null) {
                        <div>{{ tile.victoryPoints }}pv</div>
                      }
                      @if (tile.incomeGain !== null) {
                        <div>+{{ tile.incomeGain }}r</div>
                      }
                    </div>
                  }
                </div>
                @if (col.built.length > 0) {
                  <div class="mat-built-label">no tabuleiro</div>
                  <div class="mat-tile-row">
                    @for (tile of col.built; track $index) {
                      <div class="mat-tile built" [class.flipped]="tile.flipped" [style.background]="'var(--' + col.industry + ')'" [title]="tile.tooltip">
                        <div>L{{ tile.level }}</div>
                        @if (tile.victoryPoints !== null) {
                          <div>{{ tile.victoryPoints }}pv</div>
                        }
                        @if (tile.incomeGain !== null) {
                          <div>+{{ tile.incomeGain }}r</div>
                        }
                        <div class="mat-built-flip">{{ tile.flipped ? '✓ virada' : 'no jogo' }}</div>
                      </div>
                    }
                  </div>
                }
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
  private readonly industryTile = inject(IndustryTileService);
  protected readonly open = signal(true);

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

    const built = this.builtTilesByIndustry(playerId);

    return INDUSTRY_TYPES.map((industry) => ({
      industry,
      icon: this.cardFormat.industryIcon(industry),
      tiles: (player.industryStock[industry] ?? []).map((level, i) => this.toTileViewModel(view.industryTiles, industry, level, i === 0)),
      built: (built.get(industry) ?? []).map((entry) => this.toBuiltTileViewModel(view.industryTiles, entry)),
    }));
  });

  /** Scans every location on the board for tiles this player owns, grouped by industry — the
   * board itself is the source of truth for "already built", there is no separate list of it
   * anywhere in `GameState`. */
  private builtTilesByIndustry(playerId: string): Map<IndustryType, BuiltTileEntry[]> {
    const view = this.gameState.view();
    const byIndustry = new Map<IndustryType, BuiltTileEntry[]>();
    if (view === null) return byIndustry;

    for (const location of Object.values(view.state.locations)) {
      for (const slot of location.slots) {
        const tile = slot.tile;
        if (tile === null || tile.owner !== playerId) continue;
        const list = byIndustry.get(tile.industry) ?? [];
        list.push({ locationId: location.id, industry: tile.industry, level: tile.level, flipped: tile.flipped });
        byIndustry.set(tile.industry, list);
      }
    }
    return byIndustry;
  }

  private toBuiltTileViewModel(tiles: readonly IndustryTileDef[], entry: BuiltTileEntry): BuiltTileChipViewModel {
    const info = this.industryTile.find(tiles, entry.industry, entry.level);
    const flipNote = entry.flipped ? ' · VIRADA' : ' · ainda não virada';
    const tooltip =
      info === undefined
        ? `${entry.industry} nível ${entry.level} em ${entry.locationId}${flipNote}`
        : `${entry.industry} nível ${entry.level} em ${entry.locationId} — ${info.victoryPoints}VP · renda +${info.incomeGain}${flipNote}`;
    return {
      locationId: entry.locationId,
      level: entry.level,
      flipped: entry.flipped,
      victoryPoints: info?.victoryPoints ?? null,
      incomeGain: info?.incomeGain ?? null,
      tooltip,
    };
  }

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
      victoryPoints: info?.victoryPoints ?? null,
      incomeGain: info?.incomeGain ?? null,
      tooltip,
    };
  }
}
