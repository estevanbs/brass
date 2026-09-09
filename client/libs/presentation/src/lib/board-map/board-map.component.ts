import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, viewChild } from '@angular/core';
import { CardFormatService, GameStateService, MapLayoutService, PlayerColorService } from '@brass/application';
import type { LegalActionView, Point } from '@brass/domain';

const KIND_COLOR: Readonly<Record<'industrial' | 'farm_brewery' | 'market', string>> = {
  industrial: '#d8c9a3',
  farm_brewery: '#8fae7a',
  market: '#d4a537',
};

const ERA_COLOR: Readonly<Record<'canal' | 'rail', string>> = { canal: '#2f6ba8', rail: '#332924' };
// Darker + more opaque than the original `#b9a97e`/0.6 — that combination was too close to the
// `#f1e6c8` map background to read clearly once several unbuilt links cross near each other.
const INACTIVE_LINE = '#8a7550';
const ACTIVE_LINE = '#c98a2c';

interface LinkLineViewModel {
  readonly key: string;
  readonly linkId: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly dasharray: string;
  readonly opacity: number;
  readonly clickable: boolean;
  readonly highlighted: boolean;
  readonly midX: number;
  readonly midY: number;
  readonly builtOwnerColor: string | null;
}

interface TileBadgeViewModel {
  readonly cx: number;
  readonly cy: number;
  readonly color: string;
  readonly icon: string;
  readonly opacity: number;
}

interface LocationNodeViewModel {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly isMarket: boolean;
  readonly clickable: boolean;
  readonly fill: string;
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly label: string;
  readonly labelBold: boolean;
  readonly labelFill: string;
  readonly badges: readonly TileBadgeViewModel[];
}

/**
 * The interactive centerpiece of the UI: a full board map where the legal plays for the
 * selected card are highlighted directly on the town/link the player would click, instead of
 * a plain list of choices. Owns only rendering + click-target math; all selection/action state
 * still lives in `GameStateService`.
 */
@Component({
  selector: 'brass-board-map',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stage">
      <svg
        #svgRoot
        class="map-svg"
        [attr.viewBox]="'0 0 ' + mapLayout.width + ' ' + mapLayout.height"
        preserveAspectRatio="xMidYMid meet"
      >
        <rect x="0" y="0" [attr.width]="mapLayout.width" [attr.height]="mapLayout.height" fill="#f1e6c8" />
        <text [attr.x]="mapLayout.width - 40" y="46" text-anchor="middle" font-size="26" fill="#c9b787">✦</text>

        @for (line of links(); track line.key) {
          <line
            [attr.x1]="line.x1"
            [attr.y1]="line.y1"
            [attr.x2]="line.x2"
            [attr.y2]="line.y2"
            [attr.stroke]="line.stroke"
            [attr.stroke-width]="line.strokeWidth"
            [attr.stroke-dasharray]="line.dasharray"
            [attr.opacity]="line.opacity"
            stroke-linecap="round"
            [class.map-target-line]="line.highlighted"
            [style.cursor]="line.clickable ? 'pointer' : null"
            (click)="line.clickable && onLinkClick(line)"
          />
          @if (line.builtOwnerColor !== null) {
            <circle [attr.cx]="line.midX" [attr.cy]="line.midY" r="6" [attr.fill]="line.builtOwnerColor" stroke="#f1e6c8" stroke-width="1.5" />
          }
        }

        @for (node of nodes(); track node.id) {
          <g [attr.transform]="'translate(' + node.x + ',' + node.y + ')'" [class.map-target-node]="node.clickable">
            @if (node.clickable) {
              <circle [attr.r]="node.r + 9" fill="none" stroke="#c98a2c" stroke-width="3" class="pulse-ring" />
            }
            <circle
              [attr.r]="node.r"
              [attr.fill]="node.fill"
              [attr.stroke]="node.stroke"
              [attr.stroke-width]="node.strokeWidth"
              [style.cursor]="node.clickable ? 'pointer' : null"
              (click)="node.clickable && onNodeClick(node)"
            />
            @if (node.isMarket) {
              <text text-anchor="middle" font-size="13" y="5">⚑</text>
            }
            @for (badge of node.badges; track $index) {
              <circle [attr.cx]="badge.cx" [attr.cy]="badge.cy" r="7" [attr.fill]="badge.color" [attr.opacity]="badge.opacity" stroke="#f1e6c8" stroke-width="1" />
              <text [attr.x]="badge.cx" [attr.y]="badge.cy + 3.5" text-anchor="middle" font-size="8">{{ badge.icon }}</text>
            }
            <text
              [attr.y]="-(node.r + 6)"
              text-anchor="middle"
              font-size="11"
              [attr.font-weight]="node.labelBold ? 700 : 400"
              [attr.fill]="node.labelFill"
              font-family="Georgia, 'Times New Roman', serif"
              paint-order="stroke"
              stroke="#f1e6c8"
              stroke-width="3"
              stroke-linejoin="round"
            >
              {{ node.label }}
            </text>
          </g>
        }
      </svg>

      <div class="map-legend">
        <span><i class="dot" [style.background]="kindColor.industrial"></i> vila</span>
        <span><i class="dot" [style.background]="kindColor.farm_brewery"></i> fazenda</span>
        <span><i class="dot" [style.background]="kindColor.market"></i> ⚑ mercador</span>
        <span><i class="dot" style="background:#c98a2c"></i> jogável agora</span>
        <span><i class="line built" [style.background]="eraColor.canal"></i> canal</span>
        <span><i class="line built" [style.background]="eraColor.rail"></i> ferrovia</span>
      </div>

      @if (hintText(); as hint) {
        <div class="map-hint">{{ hint }}</div>
      }

      <ng-content />
    </div>
  `,
})
export class BoardMapComponent {
  protected readonly gameState = inject(GameStateService);
  protected readonly mapLayout = inject(MapLayoutService);
  private readonly cardFormat = inject(CardFormatService);
  private readonly playerColor = inject(PlayerColorService);

  protected readonly kindColor = KIND_COLOR;
  protected readonly eraColor = ERA_COLOR;

  private readonly svgRoot = viewChild.required<ElementRef<SVGSVGElement>>('svgRoot');

  private readonly layout = computed<Map<string, Point>>(() => {
    const board = this.gameState.view()?.board;
    return board === undefined ? new Map() : this.mapLayout.computeLayout(board);
  });

  private readonly activeLocationIds = computed(() => new Set(this.gameState.filteredActions().flatMap((a) => a.targets.locationIds)));
  private readonly activeLinkIds = computed(() => new Set(this.gameState.filteredActions().flatMap((a) => a.targets.linkSlotIds)));

  protected readonly hintText = computed<string | null>(() => {
    if (this.gameState.popup() !== null) return null;
    const haveSelection = this.gameState.selectedCard() !== null || this.gameState.scoutMode();
    if (!haveSelection) return 'Selecione uma carta na mão para ver as jogadas possíveis';
    if (this.gameState.filteredActions().length === 0) return 'Essa carta não tem jogadas legais agora';
    return null;
  });

  protected readonly links = computed<readonly LinkLineViewModel[]>(() => {
    const view = this.gameState.view();
    if (view === null) return [];
    const layout = this.layout();
    const builtByLinkId = new Map(view.state.links.map((l) => [l.slotId, l] as const));
    const activeIds = this.activeLinkIds();

    return view.board.links.flatMap((link) => {
      const built = builtByLinkId.get(link.id);
      const isActive = activeIds.has(link.id);
      const pairs = [link.locations, ...link.bonusConnections];
      return pairs.flatMap(([a, b], i): LinkLineViewModel[] => {
        const na = layout.get(a);
        const nb = layout.get(b);
        if (na === undefined || nb === undefined) return [];
        const mid: Point = { x: (na.x + nb.x) / 2, y: (na.y + nb.y) / 2 };
        return [
          {
            key: `${link.id}:${i}`,
            linkId: link.id,
            x1: na.x,
            y1: na.y,
            x2: nb.x,
            y2: nb.y,
            stroke: built !== undefined ? ERA_COLOR[built.kind] : isActive ? ACTIVE_LINE : INACTIVE_LINE,
            strokeWidth: built !== undefined || isActive ? 4 : 1.6,
            dasharray: built !== undefined || isActive ? 'none' : '5,4',
            opacity: built !== undefined || isActive ? 0.95 : 0.8,
            clickable: isActive && built === undefined,
            highlighted: isActive,
            midX: mid.x,
            midY: mid.y,
            builtOwnerColor: built !== undefined ? this.playerColor.colorFor(built.owner, view.humanId) : null,
          },
        ];
      });
    });
  });

  protected readonly nodes = computed<readonly LocationNodeViewModel[]>(() => {
    const view = this.gameState.view();
    if (view === null) return [];
    const layout = this.layout();
    const activeIds = this.activeLocationIds();

    return view.board.locations.flatMap((location): LocationNodeViewModel[] => {
      const pos = layout.get(location.id);
      if (pos === undefined) return [];
      const isActive = activeIds.has(location.id);
      const slots = view.state.locations[location.id]?.slots ?? [];
      const builtSlots = slots.flatMap((s) => (s.tile !== null ? [s.tile] : []));
      const hasHumanTile = builtSlots.some((t) => t.owner === view.humanId);
      const r = location.kind === 'market' ? 15 : 11;

      const badges: TileBadgeViewModel[] = builtSlots.map((tile, i) => ({
        cx: (i - (builtSlots.length - 1) / 2) * 15,
        cy: r + 12,
        color: this.playerColor.colorFor(tile.owner, view.humanId),
        icon: this.cardFormat.industryIcon(tile.industry),
        opacity: tile.flipped ? 0.55 : 1,
      }));

      return [
        {
          id: location.id,
          x: pos.x,
          y: pos.y,
          r,
          isMarket: location.kind === 'market',
          clickable: isActive,
          fill: KIND_COLOR[location.kind],
          stroke: hasHumanTile ? '#a8432f' : isActive ? '#c98a2c' : '#5a4d38',
          strokeWidth: hasHumanTile || isActive ? 3 : 1.4,
          label: location.id.replace(/_/g, ' '),
          labelBold: location.kind === 'market' || isActive,
          labelFill: isActive ? '#8a4e0f' : '#2b2620',
          badges,
        },
      ];
    });
  });

  onNodeClick(node: LocationNodeViewModel): void {
    const matches = this.gameState.filteredActions().filter((a) => a.targets.locationIds.includes(node.id));
    this.resolveClick(node.label, matches, { x: node.x, y: node.y });
  }

  onLinkClick(line: LinkLineViewModel): void {
    const matches = this.gameState.filteredActions().filter((a) => a.targets.linkSlotIds.includes(line.linkId));
    this.resolveClick('construir link', matches, { x: line.midX, y: line.midY });
  }

  private resolveClick(title: string, matches: readonly LegalActionView[], svgPoint: Point): void {
    if (matches.length === 0) return;
    if (matches.length === 1) {
      void this.gameState.submitAction(matches[0]!.index);
      return;
    }
    this.gameState.openPopup(title, matches, { mode: 'anchored', ...this.toPixel(svgPoint) });
  }

  /** Converts an SVG-viewport point into a pixel offset from `.stage` — the popup's actual CSS
   * positioned ancestor (not the SVG element itself, which is scaled to fit the viewport). */
  private toPixel(point: Point): { left: number; top: number } {
    const svg = this.svgRoot().nativeElement;
    const rect = svg.getBoundingClientRect();
    const stage = svg.closest('.stage');
    const stageRect = (stage ?? svg).getBoundingClientRect();
    const scaleX = rect.width / this.mapLayout.width;
    const scaleY = rect.height / this.mapLayout.height;
    return {
      left: rect.left - stageRect.left + point.x * scaleX,
      top: rect.top - stageRect.top + point.y * scaleY,
    };
  }
}
