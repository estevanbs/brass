import type { BoardSummary } from './game-view.model';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export const MAP_WIDTH = 1080;
export const MAP_HEIGHT = 640;
const MAP_PADDING = 70;

/** Minimum center-to-center clearance (px) two nodes are allowed to end up at — an *ellipse*,
 * not a circle: each town's label sits centered above its node and town names run 60-100px
 * wide (two- and three-word names like "stoke on trent" or "burton on trent") but only ~13px
 * tall, so two nodes need much more *horizontal* clearance than vertical before their labels
 * stop colliding. Found by trial against the board's own densest cluster (Wolverhampton /
 * Dudley / Walsall / Birmingham / Cannock all sit close together on the physical board too;
 * see `declutter`). */
const MIN_SEPARATION_X = 108;
const MIN_SEPARATION_Y = 48;
const DECLUTTER_ITERATIONS = 200;
/** How strongly a node is pulled back toward its true board-space position each iteration —
 * small and constant so the final layout stays recognizably "the real board", just with the
 * worst overlaps pried apart, rather than drifting into an unrelated arrangement. */
const ANCHOR_SPRING = 0.02;

/**
 * Each town's approximate position **on the physical board itself** (docs/ASSUMPTIONS.md #1),
 * read off a photo of it and expressed as (x, y) in an arbitrary but consistent 1000×800
 * board-space — not real-world geography. Earlier revisions of this map projected real-world
 * lat/lon instead (a defensible stand-in when no board reference existed yet), but now that an
 * actual board photo does exist, the frontend should visually echo *that* board's layout, per
 * the user's explicit request, not an independently-plausible geography that happens to
 * disagree with it in the details (e.g. the real board runs Warrington top-left to Nottingham
 * top-right to Oxford/Gloucester bottom-right, which those towns' true lat/lon does not
 * reproduce). Farm breweries aren't labeled on the board; each is plotted at the unlabeled
 * single-slot tile nearest the location it links to. */
const LOCATION_POSITIONS: Readonly<Record<string, readonly [number, number]>> = {
  warrington: [285, 15],
  stoke_on_trent: [560, 65],
  leek: [695, 15],
  belper: [835, 15],
  nottingham: [935, 90],
  stone: [310, 105],
  uttoxeter: [565, 105],
  derby: [760, 105],
  stafford: [400, 190],
  burton_on_trent: [675, 220],
  cannock: [450, 280],
  tamworth: [685, 325],
  shrewsbury: [75, 350],
  coalbrookdale: [225, 395],
  wolverhampton: [370, 385],
  walsall: [535, 385],
  nuneaton: [785, 415],
  dudley: [420, 495],
  birmingham: [630, 500],
  coventry: [805, 540],
  kidderminster: [360, 595],
  redditch: [590, 645],
  oxford: [735, 650],
  worcester: [360, 725],
  gloucester: [505, 770],
  farm_brewery_north: [300, 280],
  farm_brewery_south: [260, 660],
};
const FALLBACK_POSITION: readonly [number, number] = [500, 400];

/** Fits every location's board-space position (see `LOCATION_POSITIONS`) into a fixed-size
 * viewport (simple independent min-max scaling per axis, not a projection — there's no
 * geography to project here, just one coordinate space fit into another), then runs
 * `declutter` to pry apart nodes that land too close together for their labels to stay
 * readable. Deterministic — same board in, same layout out, no randomness — so it's safe to
 * recompute on every render without the map "jittering". */
export function computeMapLayout(board: BoardSummary): Map<string, Point> {
  const ids = board.locations.map((l) => l.id);
  const positions = ids.map((id) => LOCATION_POSITIONS[id] ?? FALLBACK_POSITION);
  const xs = positions.map((p) => p[0]);
  const ys = positions.map((p) => p[1]);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xSpan = xMax - xMin || 1;
  const ySpan = yMax - yMin || 1;

  const anchors = new Map<string, Point>();
  for (const id of ids) {
    const [px, py] = LOCATION_POSITIONS[id] ?? FALLBACK_POSITION;
    const x = MAP_PADDING + ((px - xMin) / xSpan) * (MAP_WIDTH - 2 * MAP_PADDING);
    const y = MAP_PADDING + ((py - yMin) / ySpan) * (MAP_HEIGHT - 2 * MAP_PADDING);
    anchors.set(id, { x, y });
  }

  const nodes = new Map(anchors);
  declutter(nodes, anchors);
  return nodes;
}

/**
 * Even the board's own layout packs its densest cluster (Wolverhampton / Dudley / Walsall /
 * Birmingham / Cannock) tightly enough that a naive fit of `LOCATION_POSITIONS` into the
 * viewport still overlaps circles and labels there — the exact complaint this fixes. This
 * mutates `nodes` in place, in two alternating steps per iteration: push any pair inside each
 * other's `MIN_SEPARATION_X`/`_Y` ellipse apart by half their overlap each, then pull every
 * node a small, constant amount back toward its true board-space anchor. The spring keeps the
 * result anchored to "the real board layout" instead of drifting into an unrelated
 * arrangement; running enough iterations lets the pushes and springs settle into a layout with
 * no remaining overlaps that's still recognizably the board's own.
 */
function declutter(nodes: Map<string, Point>, anchors: ReadonlyMap<string, Point>): void {
  const ids = [...nodes.keys()];
  for (let iteration = 0; iteration < DECLUTTER_ITERATIONS; iteration++) {
    for (const [i, idA] of ids.entries()) {
      for (const idB of ids.slice(i + 1)) {
        // Always present — `ids` is `nodes`' own key set and nothing is ever deleted from it;
        // re-read every pass since the previous pair may have just moved either node.
        const a = nodes.get(idA);
        const b = nodes.get(idB);
        if (a === undefined || b === undefined) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        // Scale into "ellipse space" where the required clearance is a unit circle — a pair
        // is too close whenever the scaled distance is under 1.
        const scaledDist = Math.hypot(dx / MIN_SEPARATION_X, dy / MIN_SEPARATION_Y);
        if (scaledDist >= 1) continue;
        const dist = Math.hypot(dx, dy);
        // Coincident nodes have no meaningful direction to separate along — push along a
        // fixed axis rather than dividing by (near) zero.
        const [nx, ny] = dist > 1e-6 ? [dx / dist, dy / dist] : [1, 0];
        // How far apart (in real px, along this direction) the pair needs to be to just touch
        // the ellipse boundary, i.e. the real-space radius of the ellipse along (nx, ny).
        const boundaryDenom = Math.hypot(nx / MIN_SEPARATION_X, ny / MIN_SEPARATION_Y);
        const requiredDist = boundaryDenom > 1e-9 ? 1 / boundaryDenom : MIN_SEPARATION_X;
        const shift = (requiredDist - dist) / 2;
        nodes.set(idA, { x: a.x - nx * shift, y: a.y - ny * shift });
        nodes.set(idB, { x: b.x + nx * shift, y: b.y + ny * shift });
      }
    }
    for (const id of ids) {
      const p = nodes.get(id);
      const anchor = anchors.get(id);
      if (p === undefined || anchor === undefined) continue;
      nodes.set(id, {
        x: p.x + (anchor.x - p.x) * ANCHOR_SPRING,
        y: p.y + (anchor.y - p.y) * ANCHOR_SPRING,
      });
    }
  }
}
