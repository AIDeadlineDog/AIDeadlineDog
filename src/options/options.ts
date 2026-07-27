/** Options page: load/save settings. */
import { getSettings, updateSettings } from '../shared/settings';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function load(): Promise<void> {
  const s = await getSettings();
  $<HTMLSelectElement>('language').value = s.language;
  $<HTMLSelectElement>('darkMode').value = s.darkMode;
  $<HTMLInputElement>('autoScan').checked = s.autoScan;
  $<HTMLInputElement>('strictMode').checked = s.strictMode;
  $<HTMLInputElement>('highlightDates').checked = s.highlightDates;
  $<HTMLInputElement>('mascotEnabled').checked = s.mascotEnabled;
  $<HTMLInputElement>('mascotMuted').checked = s.mascotMuted;
  $<HTMLInputElement>('reminderDays').value = s.reminderDays.join(', ');
  $<HTMLSelectElement>('numericDateOrder').value = s.numericDateOrder;

}

async function save(): Promise<void> {
  await updateSettings({
    language: $<HTMLSelectElement>('language').value as 'auto' | 'en' | 'ja' | 'es',
    darkMode: $<HTMLSelectElement>('darkMode').value as 'system' | 'light' | 'dark' | 'darker' | 'dracula' | 'github-dark' | 'tokyo-night',
    autoScan: $<HTMLInputElement>('autoScan').checked,
    strictMode: $<HTMLInputElement>('strictMode').checked,
    highlightDates: $<HTMLInputElement>('highlightDates').checked,
    mascotEnabled: $<HTMLInputElement>('mascotEnabled').checked,
    mascotMuted: $<HTMLInputElement>('mascotMuted').checked,
    reminderDays: $<HTMLInputElement>('reminderDays')
      .value.split(/[,\s]+/)
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 60)
      .sort((a, b) => b - a),
    numericDateOrder: $<HTMLSelectElement>('numericDateOrder').value as 'MDY' | 'DMY',
  });
  const saved = $('saved');
  saved.textContent = '✓ Saved';
  setTimeout(() => (saved.textContent = ''), 2000);
}

document.getElementById('save')!.addEventListener('click', () => void save());
void load();
