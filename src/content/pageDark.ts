/**
 * Optional readable dark theme for the current page: invert + hue-rotate,
 * with media elements re-inverted so photos/videos look normal.
 */
const STYLE_ID = 'deadline-dog-page-dark';

export function setPageDark(enabled: boolean): void {
  const existing = document.getElementById(STYLE_ID);
  if (!enabled) {
    existing?.remove();
    return;
  }
  if (existing) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    html { filter: invert(0.92) hue-rotate(180deg) !important; background: #111 !important; }
    img, video, canvas, picture, svg image, [style*="background-image"] {
      filter: invert(1) hue-rotate(180deg) !important;
    }
    #deadline-dog-host { filter: invert(0.92) hue-rotate(180deg) !important; }
  `;
  document.documentElement.appendChild(style);
}

export function isPageDark(): boolean {
  return document.getElementById(STYLE_ID) !== null;
}
