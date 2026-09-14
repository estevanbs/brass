import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { CardFormatService, GameStateService, IndustryTileService, MapLayoutService, PlayerColorService } from '@brass/application';
import type { BuildSlotState, IndustryTileDef, LegalActionView, LocationState, Point } from '@brass/domain';
import { isCompactViewport } from '../compact-viewport';

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
// Deliberately distinct from ACTIVE_LINE (amber = "build/link here") — while picking which
// coal/iron tile to draw from, only the eligible mine/works nodes are clickable, and coloring
// them the same amber as a normal build target read as "you can build here too", which isn't
// true mid-pick. Reuses `--accent-2`, already the app's other-than-amber accent color.
const RESOURCE_CHOICE_LINE = '#2f6b47';
const RESOURCE_CHOICE_LABEL_FILL = '#1f4a30';

type LinkEra = 'canal' | 'rail' | 'both';

/** Unbuilt links are tinted toward their built-era color (a paler version of `ERA_COLOR`) so
 * "which links am I even allowed to build right now" reads off the map without opening a
 * popup — canal-only links lean blue, rail-only lean the dark rail tone, 'both' stays neutral. */
const UNBUILT_ERA_COLOR: Readonly<Record<LinkEra, string>> = {
  canal: '#5f85ad',
  rail: '#6b5f4a',
  both: INACTIVE_LINE,
};
// Distinct dash rhythms per era so the distinction survives even without color (colorblind-safe,
// and still legible once several unbuilt links overlap near a dense cluster).
const UNBUILT_ERA_DASH: Readonly<Record<LinkEra, string>> = {
  canal: '7,3',
  rail: '2,3',
  both: '5,4',
};
const ERA_TITLE: Readonly<Record<LinkEra, string>> = {
  canal: 'só pode ser construído na era do Canal',
  rail: 'só pode ser construído na era da Ferrovia',
  both: 'pode ser construído em qualquer era',
};

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
  /** VP this link would score right now if the era ended this instant ("pontos por conexão") —
   * always rendered on the map for a built link, not only on hover. `null` while unbuilt. */
  readonly points: number | null;
  readonly title: string;
  readonly botHighlighted: boolean;
}

interface TileBadgeViewModel {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  readonly fill: string;
  readonly stroke: string;
  readonly strokeDasharray: string;
  readonly icon: string;
  readonly fontSize: number;
  readonly opacity: number;
  /** Hover detail (industry, level, VP, renda, and — for coal/iron — how many resource units
   * are left before it flips on its own). Empty for an unbuilt slot's badge. */
  readonly title: string;
  /** Small always-visible counter overlaid on the badge's corner — the resource units still on
   * a coal/iron tile before it flips ("quanto falta para virar"). `null` once flipped or for
   * every other industry, which don't carry resource cubes. */
  readonly counter: number | null;
}

const BUILDABLE_BADGE_FILL = '#fbf5e6';
const BUILDABLE_BADGE_STROKE = '#8a7550';
const MERCHANT_BADGE_FILL = '#d4a537';
const MERCHANT_BADGE_FILL_SPENT = '#e2d6ac';

interface LocationNodeViewModel {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly isMarket: boolean;
  readonly clickable: boolean;
  /** True while this node is specifically a "pick this coal mine / iron works" target — a
   * different mode than the usual "build/link here" highlight, styled distinctly (green, not
   * amber) so the two never read as the same kind of click. */
  readonly resourceChoice: boolean;
  readonly fill: string;
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly pulseColor: string;
  readonly label: string;
  readonly labelBold: boolean;
  readonly labelFill: string;
  readonly badges: readonly TileBadgeViewModel[];
  /** Market only: the one-time reward its merchant bonus tile pays out (e.g. "+£5"), shown
   * under the merchant-slot badges so it reads together with what those slots buy. */
  readonly subLabel: string | null;
  /** True for one-shot ping animation right after a bot changes this location — see
   * `GameStateService.botHighlight`. */
  readonly botHighlighted: boolean;
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

        @for (line of links(); track line.key) {
          @if (line.clickable) {
            <!-- Invisible wide hit-path for touch: the drawn line is only 1.6-4px thick, far
                 below a finger-sized target, so this transparent line underneath (26px, well
                 past the ~44px minimum touch target once you count both sides of the stroke)
                 is what actually catches a tap on mobile. -->
            <line
              class="link-hit-target"
              [attr.x1]="line.x1"
              [attr.y1]="line.y1"
              [attr.x2]="line.x2"
              [attr.y2]="line.y2"
              stroke="transparent"
              stroke-width="26"
              stroke-linecap="round"
              style="cursor: pointer"
              (click)="onLinkClick(line)"
            ></line>
          }
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
          ><title>{{ line.title }}</title></line>
          @if (line.builtOwnerColor !== null) {
            <circle [attr.cx]="line.midX" [attr.cy]="line.midY" r="9.5" [attr.fill]="line.builtOwnerColor" stroke="#f1e6c8" stroke-width="1.5" />
            @if (line.points !== null) {
              <text
                [attr.x]="line.midX"
                [attr.y]="line.midY + 3"
                text-anchor="middle"
                font-size="9"
                font-weight="700"
                fill="white"
              >{{ line.points }}</text>
            }
          }
          @if (line.botHighlighted) {
            <line [attr.x1]="line.x1" [attr.y1]="line.y1" [attr.x2]="line.x2" [attr.y2]="line.y2" class="bot-ping-line" />
          }
        }

        @for (node of nodes(); track node.id) {
          <g
            [attr.transform]="'translate(' + node.x + ',' + node.y + ')'"
            [class.map-target-node]="node.clickable"
            [class.map-resource-target]="node.resourceChoice"
            (click)="node.clickable && onNodeClick(node)"
          >
            @if (node.clickable) {
              <!-- Invisible hit-target, larger than the drawn circle (r=11-15, 22-30px across)
                   — a comfortable finger tap needs roughly 44px, so this extends the tappable
                   radius well past what is actually drawn. The click handler lives on the
                   enclosing g element above (bubbles from here, the visible circle, or a
                   build-slot badge), so any of them registers the same tap. -->
              <circle class="node-hit-target" [attr.r]="node.r + 14" fill="transparent" style="cursor: pointer" />
              <circle [attr.r]="node.r + 9" fill="none" [attr.stroke]="node.pulseColor" stroke-width="3" class="pulse-ring" />
            }
            @if (node.botHighlighted) {
              <circle [attr.r]="node.r + 6" class="bot-ping-ring" />
            }
            <circle
              class="node-fill"
              [attr.r]="node.r"
              [attr.fill]="node.fill"
              [attr.stroke]="node.stroke"
              [attr.stroke-width]="node.strokeWidth"
              [style.cursor]="node.clickable ? 'pointer' : null"
            />
            @if (node.isMarket) {
              <text text-anchor="middle" font-size="13" y="5">⚑</text>
            }
            @for (badge of node.badges; track $index) {
              <circle
                [attr.cx]="badge.cx"
                [attr.cy]="badge.cy"
                [attr.r]="badge.r"
                [attr.fill]="badge.fill"
                [attr.opacity]="badge.opacity"
                [attr.stroke]="badge.stroke"
                [attr.stroke-dasharray]="badge.strokeDasharray"
                stroke-width="1"
              >
                @if (badge.title !== '') {
                  <title>{{ badge.title }}</title>
                }
              </circle>
              <text [attr.x]="badge.cx" [attr.y]="badge.cy + 3.5" text-anchor="middle" [attr.font-size]="badge.fontSize" [attr.opacity]="badge.opacity">{{ badge.icon }}</text>
              @if (badge.counter !== null) {
                <circle [attr.cx]="badge.cx + badge.r * 0.72" [attr.cy]="badge.cy - badge.r * 0.72" r="5.5" class="tile-counter-badge" />
                <text [attr.x]="badge.cx + badge.r * 0.72" [attr.y]="badge.cy - badge.r * 0.72 + 2.5" text-anchor="middle" class="tile-counter-text">{{ badge.counter }}</text>
              }
            }
            @if (node.subLabel !== null) {
              <text
                [attr.y]="node.r + 30"
                text-anchor="middle"
                font-size="9"
                font-weight="700"
                fill="#8a4e0f"
                paint-order="stroke"
                stroke="#f1e6c8"
                stroke-width="3"
                stroke-linejoin="round"
              >
                {{ node.subLabel }}
              </text>
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

      <div class="legend-dock">
        <!-- The toggle is only displayed on compact viewports (see styles.css); a large screen
             keeps the legend permanently open, as legendOpen starts true there. -->
        <button type="button" class="legend-toggle" (click)="legendOpen.set(!legendOpen())">🗺 legenda {{ legendOpen() ? '▾' : '▸' }}</button>
        @if (legendOpen()) {
      <div class="map-legend">
        <span><i class="dot" [style.background]="kindColor.industrial"></i> vila</span>
        <span><i class="dot" [style.background]="kindColor.farm_brewery"></i> fazenda</span>
        <span><i class="dot" [style.background]="kindColor.market"></i> ⚑ mercador</span>
        <span><i class="dot" style="background:#c98a2c"></i> jogável agora</span>
        <span><i class="dot" [style.background]="resourceChoiceColor"></i> escolha de qual mina/siderúrgica usar</span>
        <span><i class="line built" [style.background]="eraColor.canal"></i> canal construído</span>
        <span><i class="line built" [style.background]="eraColor.rail"></i> ferrovia construída</span>
        <span><i class="line dashed" [style.border-top-color]="unbuiltEraColor.canal"></i> só constrói no Canal</span>
        <span><i class="line dashed" [style.border-top-color]="unbuiltEraColor.rail"></i> só constrói na Ferrovia</span>
        <span><i class="line dashed" [style.border-top-color]="unbuiltEraColor.both"></i> constrói em qualquer era</span>
        <span><i class="dot outline"></i> pode construir (indústria aceita)</span>
        <span><i class="dot" style="background:#d4a537"></i> mercador compra este bem</span>
        <span><i class="dot" style="background:#5a4d38"></i> número = pontos que o link daria agora</span>
      </div>
        }
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
  private readonly industryTile = inject(IndustryTileService);

  protected readonly kindColor = KIND_COLOR;
  protected readonly eraColor = ERA_COLOR;
  protected readonly unbuiltEraColor = UNBUILT_ERA_COLOR;
  protected readonly resourceChoiceColor = RESOURCE_CHOICE_LINE;
  protected readonly legendOpen = signal(!isCompactViewport());

  private readonly svgRoot = viewChild.required<ElementRef<SVGSVGElement>>('svgRoot');

  private readonly layout = computed<Map<string, Point>>(() => {
    const board = this.gameState.view()?.board;
    return board === undefined ? new Map() : this.mapLayout.computeLayout(board);
  });

  private readonly activeLocationIds = computed(() => new Set(this.gameState.filteredActions().flatMap((a) => a.targets.locationIds)));
  private readonly activeLinkIds = computed(() => new Set(this.gameState.filteredActions().flatMap((a) => a.targets.linkSlotIds)));

  /** The mine/works tiles currently offered as a coal/iron source pick — see
   * `GameStateService.resourceChoice`. Non-empty exactly while that mode is active, in which
   * case it *replaces* the normal build/link targets below rather than adding to them: the
   * player already committed to which build/network/develop action shape they're doing, and is
   * now only choosing a resource tile for it. */
  private readonly resourceChoiceLocationIds = computed(() => new Set(this.gameState.resourceChoice()?.options.keys() ?? []));

  private readonly botHighlightedLocationIds = computed(() => new Set(this.gameState.botHighlight()?.locationIds ?? []));
  private readonly botHighlightedLinkIds = computed(() => new Set(this.gameState.botHighlight()?.linkSlotIds ?? []));

  protected readonly hintText = computed<string | null>(() => {
    if (this.gameState.popup() !== null) return null;
    const pendingResource = this.gameState.resourceChoice();
    if (pendingResource !== null) {
      return pendingResource.resourceKind === 'coal'
        ? 'Clique na mina destacada para escolher de onde vem o carvão'
        : 'Clique na siderúrgica destacada para escolher de onde vem o ferro';
    }
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
    // Links are never a coal/iron source — while picking one, no link should read as clickable.
    const activeIds = this.resourceChoiceLocationIds().size > 0 ? new Set<string>() : this.activeLinkIds();
    const botHighlighted = this.botHighlightedLinkIds();

    return view.board.links.flatMap((link) => {
      const built = builtByLinkId.get(link.id);
      const isActive = activeIds.has(link.id);
      const isBuilt = built !== undefined;
      const points = built !== undefined ? this.industryTile.linkPoints(link, view.state, view.industryTiles) : null;
      const style = {
        botHighlighted: botHighlighted.has(link.id),
        stroke: built !== undefined ? ERA_COLOR[built.kind] : isActive ? ACTIVE_LINE : UNBUILT_ERA_COLOR[link.era],
        strokeWidth: isBuilt || isActive ? 4 : 1.6,
        dasharray: isBuilt || isActive ? 'none' : UNBUILT_ERA_DASH[link.era],
        opacity: isBuilt || isActive ? 0.95 : 0.8,
        clickable: isActive && !isBuilt,
        highlighted: isActive,
        builtOwnerColor: built !== undefined ? this.playerColor.colorFor(built.owner, view.humanId) : null,
        points,
        title:
          built !== undefined
            ? `construído (${built.kind === 'canal' ? 'Canal' : 'Ferrovia'}) · pontuaria ${points}VP agora`
            : ERA_TITLE[link.era],
      };

      // A link with bonus connections (only kidderminster-worcester today) is a single buildable
      // slot that joins 3 locations at once — per docs/CONNECTIONS.md's own note, it's drawn as
      // one T-junction (3 spokes meeting at a shared point), not as 3 separate pairwise lines
      // (a triangle), which would visually read as 3 distinct connections instead of 1.
      if (link.bonusConnections.length > 0) {
        const [locA, locB] = link.locations;
        const third = link.bonusConnections[0]?.find((id) => id !== locA && id !== locB);
        const nA = layout.get(locA);
        const nB = layout.get(locB);
        const nThird = third === undefined ? undefined : layout.get(third);
        if (nA === undefined || nB === undefined || nThird === undefined) return [];
        const junction: Point = { x: (nA.x + nB.x) / 2, y: (nA.y + nB.y) / 2 };
        const spokes: readonly [Point, number][] = [
          [nA, 0],
          [nB, 1],
          [nThird, 2],
        ];
        return spokes.map(([node, i]): LinkLineViewModel => ({
          key: `${link.id}:${i}`,
          linkId: link.id,
          x1: junction.x,
          y1: junction.y,
          x2: node.x,
          y2: node.y,
          ...style,
          midX: junction.x,
          midY: junction.y,
          // Only one spoke carries the built-owner marker (and points badge) so it renders
          // once, at the junction, instead of 3 overlapping copies.
          builtOwnerColor: i === 0 ? style.builtOwnerColor : null,
          points: i === 0 ? style.points : null,
        }));
      }

      const [a, b] = link.locations;
      const na = layout.get(a);
      const nb = layout.get(b);
      if (na === undefined || nb === undefined) return [];
      const mid: Point = { x: (na.x + nb.x) / 2, y: (na.y + nb.y) / 2 };
      return [
        {
          key: `${link.id}:0`,
          linkId: link.id,
          x1: na.x,
          y1: na.y,
          x2: nb.x,
          y2: nb.y,
          ...style,
          midX: mid.x,
          midY: mid.y,
        },
      ];
    });
  });

  /** Full hover detail for a built tile: industry, level, VP, renda, owner, and — for a coal
   * or iron mine still holding cubes — how many are left before it flips on its own. */
  private tileTitle(tile: NonNullable<BuildSlotState['tile']>, industryTiles: readonly IndustryTileDef[]): string {
    const def = this.industryTile.find(industryTiles, tile.industry, tile.level);
    const base = `${tile.industry} nível ${tile.level} (${tile.owner})`;
    if (def === undefined) return base;
    const resourceNote = tile.resourceRemaining > 0 ? ` · restam ${tile.resourceRemaining}/${def.resourceProduced} antes de virar` : '';
    const flipNote = tile.flipped ? ' · VIRADA' : resourceNote;
    return `${base} — ${def.victoryPoints}VP · renda +${def.incomeGain}${flipNote}`;
  }

  /** Row of badges under an industrial/farm-brewery node: one per build slot, in board order —
   * a filled, owner-colored badge for a built tile, or a hollow dashed one showing which
   * industry type(s) an empty slot still accepts, so "what can I build here" reads directly off
   * the map instead of requiring a click. */
  private buildSlotBadges(slots: readonly BuildSlotState[], humanId: string, industryTiles: readonly IndustryTileDef[]): TileBadgeViewModel[] {
    // Slots with 2 accepted industries render a wider (r=9) badge than a single-industry or
    // built one (r=8) — space badge centers by the widest pair actually present so neighboring
    // badges never touch (a real bug found by measuring rendered circle bounding boxes).
    const anyWide = slots.some((s) => s.tile === null && s.allowedIndustries.length > 1);
    const spacing = anyWide ? 19 : 17;
    return slots.map((slot, i) => {
      const cx = (i - (slots.length - 1) / 2) * spacing;
      const cy = 0; // filled in by the caller once `r` is known
      if (slot.tile !== null) {
        const { tile } = slot;
        const isMine = tile.industry === 'coal' || tile.industry === 'iron';
        return {
          cx,
          cy,
          r: 9,
          fill: this.playerColor.colorFor(tile.owner, humanId),
          stroke: '#f1e6c8',
          strokeDasharray: 'none',
          icon: `${this.cardFormat.industryIcon(tile.industry)}${tile.level}`,
          fontSize: 7,
          opacity: tile.flipped ? 0.55 : 1,
          title: this.tileTitle(tile, industryTiles),
          counter: isMine && !tile.flipped && tile.resourceRemaining > 0 ? tile.resourceRemaining : null,
        };
      }
      const icon = slot.allowedIndustries.map((i2) => this.cardFormat.industryIcon(i2)).join('');
      const wide = slot.allowedIndustries.length > 1;
      return {
        cx,
        cy,
        r: wide ? 9 : 8,
        fill: BUILDABLE_BADGE_FILL,
        stroke: BUILDABLE_BADGE_STROKE,
        strokeDasharray: '2,1.5',
        icon,
        fontSize: wide ? 7 : 9,
        opacity: 0.9,
        title: '',
        counter: null,
      };
    });
  }

  /** Row of badges under a market node: one per merchant slot, showing which good it buys
   * ("what can be sold/bought here") — dimmed once its beer has already been spent. */
  private merchantBadges(location: LocationState): TileBadgeViewModel[] {
    const slots = location.merchantSlots ?? [];
    return slots.map((slot, i) => {
      const cx = (i - (slots.length - 1) / 2) * 19;
      return {
        cx,
        cy: 0,
        r: 9,
        fill: slot.hasBeer ? MERCHANT_BADGE_FILL : MERCHANT_BADGE_FILL_SPENT,
        stroke: '#f1e6c8',
        strokeDasharray: 'none',
        icon: this.cardFormat.merchantIcon(slot.icon ?? 'blank'),
        fontSize: 9,
        opacity: slot.hasBeer ? 1 : 0.5,
        title: slot.hasBeer ? 'cerveja disponível para venda' : 'cerveja já vendida',
        counter: null,
      };
    });
  }

  protected readonly nodes = computed<readonly LocationNodeViewModel[]>(() => {
    const view = this.gameState.view();
    if (view === null) return [];
    const layout = this.layout();
    const resourceChoiceIds = this.resourceChoiceLocationIds();
    const inResourceChoiceMode = resourceChoiceIds.size > 0;
    const activeIds = inResourceChoiceMode ? resourceChoiceIds : this.activeLocationIds();
    const botHighlighted = this.botHighlightedLocationIds();

    return view.board.locations.flatMap((location): LocationNodeViewModel[] => {
      const pos = layout.get(location.id);
      if (pos === undefined) return [];
      const isActive = activeIds.has(location.id);
      const isResourceChoice = inResourceChoiceMode && isActive;
      const locState = view.state.locations[location.id];
      const slots = locState?.slots ?? [];
      const hasHumanTile = slots.some((s) => s.tile?.owner === view.humanId);
      const r = location.kind === 'market' ? 15 : 11;
      const cy = r + 12;

      const isMarket = location.kind === 'market';
      const rawBadges = isMarket && locState !== undefined ? this.merchantBadges(locState) : this.buildSlotBadges(slots, view.humanId, view.industryTiles);
      const badges = rawBadges.map((b) => ({ ...b, cy }));

      const marketInPlay = !isMarket || (locState?.merchantSlots ?? []).some((s) => s.icon !== null);
      const subLabel = isMarket && locState?.bonus !== undefined ? this.cardFormat.merchantBonusLabel(locState.bonus) : null;

      return [
        {
          id: location.id,
          x: pos.x,
          y: pos.y,
          r,
          isMarket,
          clickable: isActive,
          resourceChoice: isResourceChoice,
          fill: marketInPlay ? KIND_COLOR[location.kind] : '#c9bfa0',
          stroke: hasHumanTile ? '#a8432f' : isResourceChoice ? RESOURCE_CHOICE_LINE : isActive ? ACTIVE_LINE : '#5a4d38',
          strokeWidth: hasHumanTile || isActive ? 3 : 1.4,
          pulseColor: isResourceChoice ? RESOURCE_CHOICE_LINE : ACTIVE_LINE,
          label: location.id.replace(/_/g, ' '),
          labelBold: isMarket || isActive,
          labelFill: isResourceChoice ? RESOURCE_CHOICE_LABEL_FILL : isActive ? '#8a4e0f' : '#2b2620',
          badges,
          subLabel,
          botHighlighted: botHighlighted.has(location.id),
        },
      ];
    });
  });

  onNodeClick(node: LocationNodeViewModel): void {
    if (node.resourceChoice) {
      this.gameState.chooseResourceSource(node.id);
      return;
    }
    const matches = this.gameState.filteredActions().filter((a) => a.targets.locationIds.includes(node.id));
    this.resolveClick(node.label, matches, { x: node.x, y: node.y });
  }

  onLinkClick(line: LinkLineViewModel): void {
    const matches = this.gameState.filteredActions().filter((a) => a.targets.linkSlotIds.includes(line.linkId));
    this.resolveClick('construir link', matches, { x: line.midX, y: line.midY });
  }

  /** Always opens the confirmation popup, even for a single match — it shows the exact cost
   * (money, resources, items) before anything is actually submitted, per the user's request
   * for a confirm step on every action, not just when there are several to choose between.
   * `GameStateService.chooseAction` may instead enter resource-choice mode first, if `matches`
   * still differ only by which coal/iron tile to draw from. */
  private resolveClick(title: string, matches: readonly LegalActionView[], svgPoint: Point): void {
    if (matches.length === 0) return;
    this.gameState.chooseAction(title, matches, { mode: 'anchored', ...this.toPixel(svgPoint) });
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
