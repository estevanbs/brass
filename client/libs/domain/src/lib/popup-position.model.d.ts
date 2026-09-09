/** Where the small action-choice popup should render: anchored at a specific pixel (a map
 * node/link the user clicked) or pinned to a screen corner (the "other actions" bar, which
 * has nothing to visually anchor to on the map). Plain numeric coordinates, not tied to any
 * rendering framework, so it can be shared state between presentation components without
 * `application` depending on `presentation`. */
export type PopupPosition = {
    readonly mode: 'anchored';
    readonly left: number;
    readonly top: number;
} | {
    readonly mode: 'corner';
};
//# sourceMappingURL=popup-position.model.d.ts.map