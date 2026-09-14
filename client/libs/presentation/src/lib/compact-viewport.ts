/**
 * A phone in either orientation: narrow (portrait) or short (landscape). Must stay in sync with
 * the `@media (max-width: 700px), (max-height: 480px)` block in apps/web/src/styles.css.
 */
export const COMPACT_VIEWPORT_QUERY = '(max-width: 700px), (max-height: 480px)';

/**
 * Whether the overlay panels on top of the board (legend, log, player boards) should start
 * collapsed. On a phone the board area is only a few hundred pixels tall, and those panels
 * opening by default buried most of the map under them before the player touched anything.
 * `false` wherever `matchMedia` doesn't exist (jsdom, SSR), keeping the large-screen default.
 */
export function isCompactViewport(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(COMPACT_VIEWPORT_QUERY).matches;
}
