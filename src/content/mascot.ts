/**
 * The AI Deadline Dog mascot: a small draggable helper in a shadow DOM (page CSS
 * can't break it). It appears only when deadlines are detected on the page,
 * announces them, and can be moved, minimized, muted, or disabled entirely.
 */
import type { DetectedDate } from '../shared/types';
import { getSettings, updateSettings, onSettingsChanged } from '../shared/settings';
import { initI18n, t } from '../shared/i18n';
import { dogSvg } from '../shared/dogArt';
import { currentCountdown, onTrackedChanged, type DueReminder } from '../shared/tracked';

const HOST_ID = 'deadline-dog-host';


const CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
  .dd-wrap {
    position: fixed; z-index: 2147483646; width: 64px;
    user-select: none; -webkit-user-select: none;
  }
  .dd-dog {
    cursor: grab; border: none; background: none; padding: 4px; border-radius: 50%;
    transition: transform .15s ease;
  }
  .dd-dog:hover { transform: scale(1.08); }
  .dd-dog:focus-visible { outline: 3px solid #4a90d9; }
  .dd-dog.dragging { cursor: grabbing; }
  .dd-bubble {
    position: absolute; bottom: 66px; right: 0; width: 260px;
    background: var(--bg, #fff); color: var(--fg, #1c1917);
    border: 1px solid var(--border, #d6d3d1); border-radius: 14px;
    box-shadow: 0 6px 24px rgba(0,0,0,.18); padding: 12px; font-size: 13px; line-height: 1.45;
  }
  .dd-bubble.dark { --bg: #292524; --fg: #f5f5f4; --border: #57534e; }
  .dd-bubble p { margin: 0 0 8px; }
  .dd-actions { display: flex; gap: 6px; flex-wrap: wrap; }
  .dd-btn {
    font-size: 12px; padding: 5px 10px; border-radius: 8px; cursor: pointer;
    border: 1px solid var(--border, #d6d3d1); background: transparent; color: inherit;
  }
  .dd-btn.primary { background: #e8833a; border-color: #e8833a; color: #fff; }
  .dd-btn:focus-visible { outline: 2px solid #4a90d9; }
  .dd-menu {
    position: absolute; bottom: 66px; right: 0; background: var(--bg, #fff); color: var(--fg, #1c1917);
    border: 1px solid var(--border, #d6d3d1); border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,.18);
    display: flex; flex-direction: column; min-width: 160px; overflow: hidden;
  }
  .dd-menu.dark { --bg: #292524; --fg: #f5f5f4; --border: #57534e; }
  .dd-bubble.darker, .dd-menu.darker { --bg: #1d2021; --fg: #d8d4cf; --border: #2b2f31; }
  .dd-bubble.darker .dd-btn.primary, .dd-menu.darker .dd-btn.primary { background: #c9772e; border-color: #c9772e; color: #fff; }
  .dd-bubble.dracula, .dd-menu.dracula { --bg: #282a36; --fg: #f8f8f2; --border: #44475a; }
  .dd-bubble.dracula .dd-btn.primary, .dd-menu.dracula .dd-btn.primary { background: #bd93f9; border-color: #bd93f9; color: #21222c; }
  .dd-bubble.github-dark, .dd-menu.github-dark { --bg: #161b22; --fg: #e6edf3; --border: #30363d; }
  .dd-bubble.github-dark .dd-btn.primary, .dd-menu.github-dark .dd-btn.primary { background: #58a6ff; border-color: #58a6ff; color: #0d1117; }
  .dd-bubble.tokyo-night, .dd-menu.tokyo-night { --bg: #24283b; --fg: #c0caf5; --border: #292e42; }
  .dd-bubble.tokyo-night .dd-btn.primary, .dd-menu.tokyo-night .dd-btn.primary { background: #7aa2f7; border-color: #7aa2f7; color: #16161e; }
  .dd-menu button { text-align: left; border: none; background: none; color: inherit; padding: 8px 12px; font-size: 13px; cursor: pointer; }
  .dd-menu button:hover, .dd-menu button:focus-visible { background: rgba(128,128,128,.15); outline: none; }
  .dd-min { width: 30px; height: 30px; border-radius: 50%; background: transparent; border: none;
    cursor: pointer; padding: 2px; line-height: 0; }
  .dd-min:hover { background: rgba(232,131,58,.2); }
  .dd-count {
    position: absolute; top: -2px; right: -2px; min-width: 20px; height: 18px;
    padding: 0 5px; border-radius: 999px; background: #e8833a; color: #fff;
    font-size: 11px; font-weight: 700; line-height: 18px; text-align: center;
    pointer-events: none; box-shadow: 0 1px 4px rgba(0,0,0,.25);
  }
`;

export class Mascot {
  private host?: HTMLDivElement;
  private root!: ShadowRoot;
  private wrap!: HTMLDivElement;
  private dates: DetectedDate[] = [];
  private mounted = false;
  private muted = false;
  private minimized = false;
  private theme: '' | 'dark' | 'darker' | 'dracula' | 'github-dark' | 'tokyo-night' = '';
  private lastAnnounced = 0;

  /**
   * Called after every scan. The dog only appears on pages where deadlines
   * were actually found; it announces once per (new) count.
   */
  async setDates(dates: DetectedDate[]): Promise<void> {
    this.dates = dates;
    if (dates.length === 0) return;
    if (!this.mounted) {
      await this.mount();
      if (!this.mounted) return; // disabled in settings
    }
    if (!this.muted && !this.minimized && dates.length !== this.lastAnnounced) {
      this.lastAnnounced = dates.length;
      this.say(t('mascotFound', { n: dates.length }), [
        {
          label: t('showMe'),
          primary: true,
          onClick: () => {
            chrome.runtime.sendMessage({ kind: 'OPEN_PANEL' }).catch(() => {});
            this.closePopups();
          },
        },
        { label: t('dismiss'), onClick: () => this.closePopups() },
      ]);
    }
  }

  /** The dog appears (on any page) and announces a booked deadline. */
  async announceReminder(r: DueReminder): Promise<void> {
    if (!this.mounted) {
      await this.mount();
      if (!this.mounted) return; // disabled in settings
    }
    if (this.muted || this.minimized) return;
    const msg =
      r.daysLeft === 0
        ? t('reminderToday', { title: r.deadline.title, date: r.deadline.startDate })
        : t('reminderMsg', { title: r.deadline.title, n: r.daysLeft, date: r.deadline.startDate });
    this.say(msg, [
      {
        label: t('openPage'),
        primary: true,
        onClick: () => {
          window.open(r.deadline.sourceUrl, '_blank', 'noopener');
          this.closePopups();
        },
      },
      { label: t('dismiss'), onClick: () => this.closePopups() },
    ]);
  }

  private async mount(): Promise<void> {
    const settings = await getSettings();
    if (!settings.mascotEnabled) return;
    initI18n(settings.language);
    this.muted = settings.mascotMuted;
    if (settings.darkMode === 'darker' || settings.darkMode === 'dracula' || settings.darkMode === 'github-dark' || settings.darkMode === 'tokyo-night') {
      this.theme = settings.darkMode;
    } else {
      const dark =
        settings.darkMode === 'dark' ||
        (settings.darkMode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
      this.theme = dark ? 'dark' : '';
    }

    this.host = document.createElement('div');
    this.host.id = HOST_ID;
    this.root = this.host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = CSS;
    this.root.appendChild(style);

    this.wrap = document.createElement('div');
    this.wrap.className = 'dd-wrap';
    const pos = settings.mascotPos ?? { x: window.innerWidth - 90, y: window.innerHeight - 100 };
    this.setPos(pos.x, pos.y);

    const dog = document.createElement('button');
    dog.className = 'dd-dog';
    dog.setAttribute('aria-label', 'AI Deadline Dog assistant. Press Enter to open menu, drag to move.');
    dog.innerHTML = dogSvg(52);
    dog.addEventListener('click', (e) => {
      if (!this.dragMoved) this.toggleMenu();
      e.stopPropagation();
    });
    this.makeDraggable(dog);
    this.wrap.appendChild(dog);
    this.root.appendChild(this.wrap);
    document.documentElement.appendChild(this.host);
    this.mounted = true;

    void this.refreshCountdown();
    onTrackedChanged(() => void this.refreshCountdown());
    onSettingsChanged(() => void this.refreshCountdown());
  }

  /**
   * Small pill over the dog — shown only when the toolbar icon is NOT
   * pinned (otherwise the badge already displays the countdown, and the
   * page stays free of duplicate counters).
   */
  private async refreshCountdown(): Promise<void> {
    if (!this.mounted) return;
    this.wrap.querySelector('.dd-count')?.remove();
    const pinned = await chrome.runtime
      .sendMessage({ kind: 'GET_PINNED' })
      .then((r: { ok: boolean; value?: boolean }) => r?.ok === true && r.value === true)
      .catch(() => false);
    if (pinned) return;
    const cc = await currentCountdown();
    if (!cc) return;
    const pill = document.createElement('span');
    pill.className = 'dd-count';
    pill.textContent = cc.countdown.text;
    pill.style.background = cc.countdown.color;
    pill.title = `${cc.next.title} — ${cc.next.startDate}${cc.inferred ? ' (auto-detected)' : ''}`;
    this.wrap.appendChild(pill);
  }

  private say(text: string, buttons: Array<{ label: string; primary?: boolean; onClick: () => void }>): void {
    this.closePopups();
    const bubble = document.createElement('div');
    bubble.className = 'dd-bubble' + (this.theme ? ` ${this.theme}` : '');
    bubble.setAttribute('role', 'dialog');
    bubble.setAttribute('aria-label', 'AI Deadline Dog message');
    const p = document.createElement('p');
    p.textContent = text;
    bubble.appendChild(p);

    const actions = document.createElement('div');
    actions.className = 'dd-actions';
    for (const b of buttons) {
      const btn = document.createElement('button');
      btn.className = 'dd-btn' + (b.primary ? ' primary' : '');
      btn.textContent = b.label;
      btn.addEventListener('click', b.onClick);
      actions.appendChild(btn);
    }
    bubble.appendChild(actions);
    bubble.addEventListener('keydown', (e) => e.key === 'Escape' && this.closePopups());
    this.wrap.appendChild(bubble);
  }

  private toggleMenu(): void {
    if (this.root.querySelector('.dd-menu')) {
      this.closePopups();
      return;
    }
    this.closePopups();
    const menu = document.createElement('div');
    menu.className = 'dd-menu' + (this.theme ? ` ${this.theme}` : '');
    menu.setAttribute('role', 'menu');
    const item = (label: string, onClick: () => void) => {
      const b = document.createElement('button');
      b.setAttribute('role', 'menuitem');
      b.textContent = label;
      b.addEventListener('click', onClick);
      menu.appendChild(b);
    };
    item(t('menuShow', { n: this.dates.length }), () => {
      chrome.runtime.sendMessage({ kind: 'OPEN_PANEL' }).catch(() => {});
      this.closePopups();
    });
    item(this.muted ? t('menuUnmute') : t('menuMute'), async () => {
      this.muted = !this.muted;
      await updateSettings({ mascotMuted: this.muted });
      this.closePopups();
    });
    item(t('menuMinimize'), () => this.minimize());
    item(t('menuDisable'), async () => {
      await updateSettings({ mascotEnabled: false });
      this.destroy();
    });
    menu.querySelectorAll('button').forEach((b) =>
      b.addEventListener('keydown', (e) => (e as KeyboardEvent).key === 'Escape' && this.closePopups()),
    );
    this.wrap.appendChild(menu);
    (menu.querySelector('button') as HTMLButtonElement)?.focus();
  }

  private minimize(): void {
    this.minimized = true;
    this.closePopups();
    const dog = this.wrap.querySelector('.dd-dog') as HTMLElement;
    dog.style.display = 'none';
    const min = document.createElement('button');
    min.className = 'dd-min';
    min.innerHTML = dogSvg(22);
    min.setAttribute('aria-label', 'Restore AI Deadline Dog');
    min.addEventListener('click', () => {
      this.minimized = false;
      min.remove();
      dog.style.display = '';
    });
    this.wrap.appendChild(min);
  }

  private closePopups(): void {
    this.root.querySelectorAll('.dd-bubble, .dd-menu').forEach((el) => el.remove());
  }

  destroy(): void {
    this.host?.remove();
    this.mounted = false;
  }

  // --- dragging ---
  private dragMoved = false;

  private setPos(x: number, y: number): void {
    const cx = Math.max(4, Math.min(window.innerWidth - 68, x));
    const cy = Math.max(4, Math.min(window.innerHeight - 68, y));
    this.wrap.style.left = `${cx}px`;
    this.wrap.style.top = `${cy}px`;
  }

  private makeDraggable(handle: HTMLElement): void {
    let startX = 0, startY = 0, origX = 0, origY = 0;
    handle.addEventListener('pointerdown', (e) => {
      this.dragMoved = false;
      startX = e.clientX;
      startY = e.clientY;
      const rect = this.wrap.getBoundingClientRect();
      origX = rect.left;
      origY = rect.top;
      handle.setPointerCapture(e.pointerId);
      handle.classList.add('dragging');

      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
        if (Math.abs(dx) + Math.abs(dy) > 4) this.dragMoved = true;
        if (this.dragMoved) this.setPos(origX + dx, origY + dy);
      };
      const up = async () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.classList.remove('dragging');
        if (this.dragMoved) {
          const rect = this.wrap.getBoundingClientRect();
          await updateSettings({ mascotPos: { x: rect.left, y: rect.top } });
        }
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
    });
  }
}
