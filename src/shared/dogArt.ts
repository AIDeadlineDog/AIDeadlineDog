/**
 * The one and only AI Deadline Dog artwork — single source of truth.
 * The page mascot, the minimized button, and the extension icons
 * (via tools/make-icons.mjs) are all rendered from these shapes.
 */

/** The dog face (transparent background), drawn in a 64×64 viewBox. */
export const DOG_FACE = `
  <path d="M14 18 Q8 4 18 8 L26 14 Z" fill="#b5651d"/>
  <path d="M50 18 Q56 4 46 8 L38 14 Z" fill="#b5651d"/>
  <circle cx="32" cy="30" r="20" fill="#e8a552"/>
  <circle cx="24" cy="26" r="3" fill="#2d2013"/>
  <circle cx="40" cy="26" r="3" fill="#2d2013"/>
  <circle cx="25" cy="25" r="1" fill="#fff"/>
  <circle cx="41" cy="25" r="1" fill="#fff"/>
  <ellipse cx="32" cy="36" rx="9" ry="7" fill="#f7dcb4"/>
  <ellipse cx="32" cy="33" rx="3.4" ry="2.6" fill="#2d2013"/>
  <path d="M32 36 Q32 40 28 41 M32 36 Q32 40 36 41" stroke="#2d2013" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <path d="M26 15 Q32 11 38 15" stroke="#c98a3b" stroke-width="2" fill="none" stroke-linecap="round"/>`;

/** Mascot rendering: face + soft ground shadow, at a given pixel size. */
export function dogSvg(size: number): string {
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">
  <ellipse cx="32" cy="60" rx="16" ry="3" fill="rgba(0,0,0,.15)"/>${DOG_FACE}
</svg>`;
}

/** Icon rendering: the same face on the orange disc (toolbar/store icons). */
export const ICON_SVG = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="32" fill="#e8833a"/>
  <g transform="translate(32 34) scale(1.15) translate(-32 -31)">${DOG_FACE}</g>
</svg>`;
