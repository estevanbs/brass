import type { BoardSummary } from './game-view.model';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export const MAP_WIDTH = 900;
export const MAP_HEIGHT = 700;
const MAP_PADDING = 70;

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
 * landscape aspect ratio that fits the layout better than a geographically exact one). */
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

  const nodes = new Map<string, Point>();
  for (const id of ids) {
    const [lat, lon] = LOCATION_COORDS[id] ?? FALLBACK_COORD;
    const x = MAP_PADDING + ((lon - lonMin) / lonSpan) * (MAP_WIDTH - 2 * MAP_PADDING);
    // Latitude grows northward; SVG y grows downward, so invert.
    const y = MAP_PADDING + ((latMax - lat) / latSpan) * (MAP_HEIGHT - 2 * MAP_PADDING);
    nodes.set(id, { x, y });
  }
  return nodes;
}
