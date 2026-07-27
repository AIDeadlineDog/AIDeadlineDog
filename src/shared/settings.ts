/** chrome.storage-backed user settings with change notifications. */
import { DEFAULT_SETTINGS, type UserSettings } from './types';

const KEY = 'settings';

export async function getSettings(): Promise<UserSettings> {
  const stored = await chrome.storage.local.get(KEY);
  return { ...DEFAULT_SETTINGS, ...((stored[KEY] ?? {}) as Partial<UserSettings>) };
}

export async function updateSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}

export function onSettingsChanged(cb: (s: UserSettings) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[KEY]) {
      cb({ ...DEFAULT_SETTINGS, ...(changes[KEY].newValue as Partial<UserSettings>) });
    }
  });
}
