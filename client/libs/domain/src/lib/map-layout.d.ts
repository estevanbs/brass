import type { BoardSummary } from './game-view.model';
export interface Point {
    readonly x: number;
    readonly y: number;
}
export declare const MAP_WIDTH = 900;
export declare const MAP_HEIGHT = 700;
/** Projects every location's real-world lat/lon onto a fixed-size viewport (simple linear
 * scaling, not a great-circle projection — accurate enough at this scale and keeps a
 * landscape aspect ratio that fits the layout better than a geographically exact one). */
export declare function computeMapLayout(board: BoardSummary): Map<string, Point>;
//# sourceMappingURL=map-layout.d.ts.map