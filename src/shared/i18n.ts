/**
 * Lightweight UI translations (English / 日本語 / Español).
 * Language follows the browser UI by default, overridable in Options.
 */
export type Lang = 'en' | 'ja' | 'es';

const CATALOG: Record<Lang, Record<string, string>> = {
  en: {
    highlightToggle: 'Highlight dates on page',
    pageDarkToggle: 'Dark theme for this site',
    addSelected: 'Add selected to Google Calendar',
    addN: 'Add ${n} to Google Calendar',
    importantToggle: 'Only important deadlines',
    foundImportant: '${n} important deadline(s) — ${hidden} other date(s) hidden.',
    emptyNoImportant: 'No upcoming important deadlines here (${n} other dates hidden — uncheck "Only important deadlines" to see them).',
    weekReminder: '⏰ Remind me 1 week before',
    trackedTitle: '⏰ Tracked deadlines',
    nudgeSeen: 'Seen, not tracked:',
    autoNext: 'Auto-detected — not booked:',
    removeAuto: "Don't count this",
    trackTip: 'Track this deadline (adds it to the countdown badge)',
    untrackTip: 'Stop tracking',
    selectAll: 'Select all',
    clearAll: 'Clear',
    downloadIcs: '⬇ Download .ics (Apple / Outlook / any calendar)',
    downloadSeparate: '⬇ Separate .ics files',
    icsDone: 'Downloaded ${n} event file(s) — open to import into your calendar (includes reminders).',
    rescanTitle: 'Rescan page',
    themeTitle: 'Toggle dark mode',
    optionsTitle: 'Options',
    gatedMsg: "This doesn't look like a conference/deadline page, so results are hidden to avoid wrong matches.",
    scanAnyway: 'Scan anyway',
    emptyNoDates: 'No dates found on this page yet.',
    emptyHint: 'Try <strong>↻ Rescan</strong> after the page finishes loading.',
    foundOnPage: 'Found ${n} date(s) on this page.',
    openInGcal: 'Open in Google Calendar ↗',
    notScanned: 'This page has not been scanned (content script not loaded). Try reloading the tab.',
    openRegular: 'Open a regular webpage to scan for dates.',
    templateOpening: 'Opening Google Calendar with your Google account…',
    templateDone: 'Review and save each event in the opened Google Calendar tab(s).',
    mascotFound: 'Woof! ${n} deadline(s) on this page. Add them to your calendar?',
    reminderMsg: '⏰ Woof! ${title} — ${n} day(s) left (due ${date}).',
    reminderToday: '🚨 Woof woof! ${title} is due TODAY (${date})!',
    openPage: 'Open page',
    dayUnit: 'd',
    hourUnit: 'h',
    minUnit: 'm',
    showMe: 'Show me',
    dismiss: 'Dismiss',
    menuShow: '📋 Show detected dates (${n})',
    menuMute: '🔕 Mute notifications',
    menuUnmute: '🔔 Unmute notifications',
    menuMinimize: '➖ Minimize',
    menuDisable: '✖️ Disable mascot',
  },
  ja: {
    highlightToggle: 'ページ内の日付をハイライト',
    pageDarkToggle: 'このサイトをダークテーマに',
    addSelected: '選択した予定をGoogleカレンダーに追加',
    addN: '${n}件をGoogleカレンダーに追加',
    importantToggle: '重要な締め切りのみ',
    foundImportant: '重要な締め切り${n}件 — 他の日付${hidden}件は非表示。',
    emptyNoImportant: '今後の重要な締め切りはありません（他の日付${n}件は非表示）。',
    weekReminder: '⏰ 1週間前に通知',
    trackedTitle: '⏰ 追跡中の締め切り',
    nudgeSeen: '未追跡:',
    autoNext: '自動検出 — 未登録:',
    removeAuto: 'カウントしない',
    trackTip: 'この締め切りを追跡（バッジのカウントダウンに追加）',
    untrackTip: '追跡を解除',
    selectAll: 'すべて選択',
    clearAll: '選択解除',
    downloadIcs: '⬇ .icsをダウンロード（Apple / Outlook / 各種カレンダー対応）',
    downloadSeparate: '⬇ 個別の.icsファイル',
    icsDone: '${n}件のイベントファイルをダウンロードしました。開いてカレンダーに取り込んでください（通知付き）。',
    rescanTitle: '再スキャン',
    themeTitle: 'ダークモード切替',
    optionsTitle: '設定',
    gatedMsg: '学会・締切ページではないようなので、誤検出を避けるため結果を非表示にしています。',
    scanAnyway: 'それでもスキャン',
    emptyNoDates: 'このページには日付が見つかりませんでした。',
    emptyHint: 'ページの読み込み後に<strong>↻ 再スキャン</strong>をお試しください。',
    foundOnPage: 'このページで${n}件の日付が見つかりました。',
    openInGcal: 'Googleカレンダーで開く ↗',
    notScanned: 'このページはまだスキャンされていません。タブを再読み込みしてください。',
    openRegular: '日付をスキャンするには通常のウェブページを開いてください。',
    templateOpening: 'Googleカレンダーを開いています（ログイン未設定）…',
    templateDone: '開いたGoogleカレンダーのタブで各予定を確認して保存してください。',
    mascotFound: 'ワン！このページで${n}件の日付を見つけました。カレンダーに追加しますか？',
    reminderMsg: '⏰ ワン！${title} — 締め切りまであと${n}日です（${date}）。',
    reminderToday: '🚨 ワンワン！${title} は今日（${date}）が締め切りです！',
    openPage: 'ページを開く',
    dayUnit: '日',
    hourUnit: '時',
    minUnit: '分',
    showMe: '見せて',
    dismiss: '閉じる',
    menuShow: '📋 検出した日付を表示（${n}）',
    menuMute: '🔕 通知をミュート',
    menuUnmute: '🔔 ミュート解除',
    menuMinimize: '➖ 最小化',
    menuDisable: '✖️ マスコットを無効化',
  },
  es: {
    highlightToggle: 'Resaltar fechas en la página',
    pageDarkToggle: 'Tema oscuro para este sitio',
    addSelected: 'Añadir seleccionados a Google Calendar',
    addN: 'Añadir ${n} a Google Calendar',
    importantToggle: 'Solo fechas límite importantes',
    foundImportant: '${n} fecha(s) límite importantes — ${hidden} otras fechas ocultas.',
    emptyNoImportant: 'No hay fechas límite importantes próximas (${n} otras fechas ocultas).',
    weekReminder: '⏰ Recordarme 1 semana antes',
    trackedTitle: '⏰ Plazos seguidos',
    nudgeSeen: 'Visto, sin seguir:',
    autoNext: 'Detectado automáticamente — sin reservar:',
    removeAuto: 'No contar esto',
    trackTip: 'Seguir este plazo (se añade a la cuenta atrás del icono)',
    untrackTip: 'Dejar de seguir',
    selectAll: 'Seleccionar todo',
    clearAll: 'Quitar selección',
    downloadIcs: '⬇ Descargar .ics (Apple / Outlook / cualquier calendario)',
    downloadSeparate: '⬇ Archivos .ics separados',
    icsDone: '${n} archivo(s) descargados — ábrelos para importarlos a tu calendario (con recordatorios).',
    rescanTitle: 'Volver a escanear',
    themeTitle: 'Cambiar modo oscuro',
    optionsTitle: 'Opciones',
    gatedMsg: 'Esta página no parece de congresos/plazos; se ocultan los resultados para evitar coincidencias erróneas.',
    scanAnyway: 'Escanear de todos modos',
    emptyNoDates: 'Aún no se han encontrado fechas en esta página.',
    emptyHint: 'Prueba <strong>↻ Reescanear</strong> cuando la página termine de cargar.',
    foundOnPage: 'Se encontraron ${n} fecha(s) en esta página.',
    openInGcal: 'Abrir en Google Calendar ↗',
    notScanned: 'Esta página no se ha escaneado (script no cargado). Recarga la pestaña.',
    openRegular: 'Abre una página web normal para buscar fechas.',
    templateOpening: 'Abriendo Google Calendar (sin sesión configurada)…',
    templateDone: 'Revisa y guarda cada evento en las pestañas abiertas de Google Calendar.',
    mascotFound: '¡Guau! Encontré ${n} fecha(s) en esta página. ¿Quieres añadirlas a tu calendario?',
    reminderMsg: '⏰ ¡Guau! ${title} — quedan ${n} día(s) (vence ${date}).',
    reminderToday: '🚨 ¡Guau guau! ¡${title} vence HOY (${date})!',
    openPage: 'Abrir página',
    dayUnit: 'd',
    hourUnit: 'h',
    minUnit: 'm',
    showMe: 'Muéstrame',
    dismiss: 'Descartar',
    menuShow: '📋 Mostrar fechas detectadas (${n})',
    menuMute: '🔕 Silenciar notificaciones',
    menuUnmute: '🔔 Activar notificaciones',
    menuMinimize: '➖ Minimizar',
    menuDisable: '✖️ Desactivar mascota',
  },
};

let lang: Lang = 'en';

/** pref: 'auto' | 'en' | 'ja' | 'es' */
export function initI18n(pref: string): void {
  if (pref === 'ja' || pref === 'es' || pref === 'en') {
    lang = pref;
    return;
  }
  const ui = (typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage?.()) || 'en';
  lang = ui.startsWith('ja') ? 'ja' : ui.startsWith('es') ? 'es' : 'en';
}

export function currentLang(): Lang {
  return lang;
}

export function t(key: string, subs?: Record<string, string | number>): string {
  let s = CATALOG[lang][key] ?? CATALOG.en[key] ?? key;
  if (subs) {
    for (const [k, v] of Object.entries(subs)) s = s.replaceAll('${' + k + '}', String(v));
  }
  return s;
}
