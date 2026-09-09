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
 * wide (two- and three-word names like "west bromwich" or "stoke on trent") but only ~13px
 * tall, so two nodes need much more *horizontal* clearance than vertical before their labels
 * stop colliding. Found by trial against the real West Midlands cluster (Wolverhampton /
 * Dudley / West Bromwich / Walsall / Birmingham / Stourbridge / Cannock all sit within a few
 * real-world km of each other, so their raw lat/lon projection overlaps badly; see
 * `declutter`). */
const MIN_SEPARATION_X = 108;
const MIN_SEPARATION_Y = 48;
const DECLUTTER_ITERATIONS = 200;
/** How strongly a node is pulled back toward its true geographic position each iteration —
 * small and constant so the final layout stays recognizably "the real map", just with the
 * worst overlaps pried apart, rather than drifting into an unrelated arrangement. */
const ANCHOR_SPRING = 0.02;

/** Real-world [lat, lon] of each town the board is named after (docs/ASSUMPTIONS.md #1: the
 * board's topology is an original design, but the town names are real West Midlands / England
 * places — using their actual relative positions makes the map read like a real map instead
 * of an abstract graph, without reproducing any of the physical game's own artwork). Farm
 * breweries aren't real places; each is plotted near the town(s) it connects to. */
const LOCATION_COORDS: Readonly<Record<string, readonly [number, number]>> = {
  birmingham: [52.4862, -1.8904],
  wolverhampton: [52.5862, -2.1281],
  dudley: [52.5083, -2.0807],
  walsall: [52.586, -1.9822],
  west_bromwich: [52.5186, -1.9945],
  coventry: [52.4068, -1.5197],
  tamworth: [52.6335, -1.6947],
  nuneaton: [52.5231, -1.4677],
  redditch: [52.3057, -1.9428],
  bromsgrove: [52.3357, -2.0611],
  kidderminster: [52.3891, -2.2494],
  worcester: [52.1936, -2.2216],
  cannock: [52.6883, -2.0311],
  coalbrookdale: [52.6267, -2.4839],
  stoke_on_trent: [53.0027, -2.1794],
  stone: [52.9022, -2.1522],
  leek: [53.1039, -2.0233],
  stourbridge: [52.4573, -2.1483],
  warrington: [53.39, -2.5972],
  shrewsbury: [52.7069, -2.7527],
  nottingham: [52.9548, -1.1581],
  gloucester: [51.8642, -2.2382],
  oxford: [51.752, -1.2577],
  farm_brewery_north: [52.735, -2.09],
  farm_brewery_south: [52.27, -2.29],
};
const FALLBACK_COORD: readonly [number, number] = [52.3, -2.0];

/** Projects every location's real-world lat/lon onto a fixed-size viewport (simple linear
 * scaling, not a great-circle projection — accurate enough at this scale and keeps a
 * landscape aspect ratio that fits the layout better than a geographically exact one), then
 * runs `declutter` to pry apart nodes that land too close together for their labels to stay
 * readable. Deterministic — same board in, same layout out, no randomness — so it's safe to
 * recompute on every render without the map "jittering". */
export function computeMapLayout(board: BoardSummary): Map<string, Point> {
  const ids = board.locations.map((l) => l.id);
  const coords = ids.map((id) => LOCATION_COORDS[id] ?? FALLBACK_COORD);
  const lats = coords.map((c) => c[0]);
  const lons = coords.map((c) => c[1]);
  const latMin = Math.min(...lats);
  const latMax = Math.max(...lats);
  const lonMin = Math.min(...lons);
  const lonMax = Math.max(...lons);
  const latSpan = latMax - latMin || 1;
  const lonSpan = lonMax - lonMin || 1;

  const anchors = new Map<string, Point>();
  for (const id of ids) {
    const [lat, lon] = LOCATION_COORDS[id] ?? FALLBACK_COORD;
    const x = MAP_PADDING + ((lon - lonMin) / lonSpan) * (MAP_WIDTH - 2 * MAP_PADDING);
    // Latitude grows northward; SVG y grows downward, so invert.
    const y = MAP_PADDING + ((latMax - lat) / latSpan) * (MAP_HEIGHT - 2 * MAP_PADDING);
    anchors.set(id, { x, y });
  }

  const nodes = new Map(anchors);
  declutter(nodes, anchors);
  return nodes;
}

/**
 * Real-world town spacing is wildly uneven (several West Midlands towns sit only a few km
 * apart, while others the board also names — Nottingham, Oxford, Warrington — are 50-100km
 * out), so the raw geographic projection above packs a cluster of ~8 towns close enough that
 * their circles and labels overlap and it stops being clear which name belongs to which point
 * — the exact complaint this fixes. This mutates `nodes` in place, in two alternating steps
 * per iteration: push any pair inside each other's `MIN_SEPARATION_X`/`_Y` ellipse apart by
 * half their overlap each, then pull every node a small, constant amount back toward its true
 * geographic anchor. The spring keeps the result anchored to "the real map" instead of
 * drifting into an unrelated layout; running enough iterations lets the pushes and springs
 * settle into a layout with no remaining overlaps that's still recognizably the geographic one.
 */
function declutter(nodes: Map<string, Point>, anchors: ReadonlyMap<string, Point>): void {
  const ids = [...nodes.keys()];
  for (let iteration = 0; iteration < DECLUTTER_ITERATIONS; iteration++) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const idA = ids[i]!;
        const idB = ids[j]!;
        const a = nodes.get(idA)!;
        const b = nodes.get(idB)!;
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
      const p = nodes.get(id)!;
      const anchor = anchors.get(id)!;
      nodes.set(id, {
        x: p.x + (anchor.x - p.x) * ANCHOR_SPRING,
        y: p.y + (anchor.y - p.y) * ANCHOR_SPRING,
      });
    }
  }
}
