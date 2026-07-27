/**
 * Classifies what a detected date *means* (abstract deadline, notification, …)
 * from its surrounding text, and detects the conference/venue for grouping.
 */
import type { Category } from '../shared/types';
import { CATEGORY_LABELS } from '../shared/types';

interface Rule {
  category: Category;
  re: RegExp;
  weight: number;
}

// Ordered by specificity — first strong hit wins ties via weight.
const RULES: Rule[] = [
  { category: 'camera-ready', re: /camera[- ]ready|final (?:version|paper|manuscript)|camera ready|カメラレディ|最終原稿|最終版|versi[oó]n (?:final|definitiva)/i, weight: 10 },
  { category: 'abstract', re: /abstract(?:\s+(?:submission|registration|deadline))?|アブストラクト|概要(?:提出|投稿)?|res[uú]men(?:es)?/i, weight: 9 },
  { category: 'supplementary', re: /supplementar|appendix deadline/i, weight: 9 },
  { category: 'rebuttal', re: /rebuttal|author (?:response|feedback|discussion)|author[- ]reviewer discussion|リバッタル|著者(?:回答|応答)|反論期間|respuesta de (?:los )?autores|r[eé]plica/i, weight: 9 },
  { category: 'review', re: /reviews? (?:released|release|available|sent|posted|due)|reviewing deadline|review period|査読(?:結果|期間)|revisiones (?:publicadas|disponibles)/i, weight: 8 },
  { category: 'notification', re: /notification|decisions? (?:released|announced|sent|posted|available)|acceptance notification|accept\/reject|採否|採録通知|結果(?:通知|発表)|通知日|notificaci[oó]n|aceptaci[oó]n/i, weight: 9 },
  { category: 'registration', re: /registration|early[- ]bird|register (?:by|before)|参加登録|事前登録|登録(?:期限|締切)|inscripci[oó]n|registro/i, weight: 8 },
  { category: 'workshop', re: /workshop|tutorial|ワークショップ|チュートリアル|taller/i, weight: 5 },
  { category: 'rebuttal', re: /discussion period|議論期間/i, weight: 6 },
  { category: 'submission', re: /(?:paper|full paper|submission|manuscript|proposal)s?\s+(?:deadline|due|submission)|submission (?:deadline|due|closes?|site)|(?:papers?|submissions?) due|deadline for (?:paper|submission)|call for papers|論文(?:投稿|提出)|投稿締[め]?切|提出(?:期限|締切)|原稿締[め]?切|fecha l[ií]mite de (?:env[ií]o|presentaci[oó]n)|env[ií]o de (?:art[ií]culos|trabajos|res[uú]menes)|presentaci[oó]n de (?:art[ií]culos|trabajos)|convocatoria de art[ií]culos/i, weight: 7 },
  { category: 'conference', re: /(?:main )?conference(?:\s+dates)?|takes? place|will be held|held in|dates? of the conference|convenes|convention cent(?:er|re)|congress cent(?:er|re)|開催(?:日|期間)?|会期|se celebrar[aá]|tendr[aá] lugar|congreso/i, weight: 4 },
  { category: 'submission', re: /\bsubmissions?\b/i, weight: 3 },
];

export function classify(context: string): { category: Category; score: number } {
  let best: { category: Category; score: number } = { category: 'other', score: 0 };
  for (const rule of RULES) {
    if (rule.re.test(context) && rule.weight > best.score) {
      best = { category: rule.category, score: rule.weight };
    }
  }
  return best;
}

const DEADLINE_HINT = /deadline|due\b|closes?\b|commitment|cycle end|early pricing|before this date|締切|締め切り|期限|期日|fecha l[ií]mite|plazo|vence/i;
const OPENING_HINT = /\bopens?\b|\bopening\b|launched|is out\b|start of|\bstarts?\s*:|se abre/i;

/**
 * Important = upcoming, and either a known deadline type or explicitly a deadline.
 * News / "opens" rows are not.
 */
export function isImportantDate(
  d: { category: Category; context: string; startDate: string; endDate?: string },
  todayIso: string,
): boolean {
  if ((d.endDate ?? d.startDate) < todayIso) return false;
  if (DEADLINE_HINT.test(d.context)) return true;
  if (OPENING_HINT.test(d.context)) return false;
  return d.category !== 'other';
}

/** Pages whose text is quoted from elsewhere — never trust dates here. */
const QUOTED_CONTENT_HOSTS = new Set([
  'mail.google.com', 'news.google.com', 'outlook.live.com', 'outlook.office.com',
  'youtube.com', 'twitter.com', 'x.com', 'facebook.com', 'reddit.com',
  'linkedin.com', 'instagram.com', 'duckduckgo.com', 'search.yahoo.com',
]);

export function isExcludedPage(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const host = u.hostname.replace(/^www\./, '');
  if (QUOTED_CONTENT_HOSTS.has(host)) return true;
  // Search engines: results quote snippets from many sites at once.
  if (/(^|\.)google\.[a-z.]{2,6}$/.test(host) && (u.pathname === '/' || u.pathname === '/search' || u.pathname === '/webhp')) return true;
  if (host === 'bing.com' && u.pathname.startsWith('/search')) return true;
  if (host === 'baidu.com' && u.pathname === '/s') return true;
  return false;
}

const PAGE_HINT = /dates?|deadline|call.?for.?papers|cfp|submission|conference|workshop|symposium|congreso|学会|大会|締切|募集/i;

/**
 * Precision gate: only treat a page as deadline-relevant when it clearly is —
 * a venue in the title/URL plus labeled deadlines, or several well-classified
 * deadlines on a page that talks about dates/CFPs. Search engines, webmail,
 * and social feeds are always out (their text is quoted from other sites).
 */
export function isConferencePage(
  url: string,
  title: string,
  dates: Array<{ category: Category; confidence: number }>,
): boolean {
  if (isExcludedPage(url)) return false;
  const venue = detectConference(title, decodeURIComponent(url));
  const hints = PAGE_HINT.test(`${title} ${url}`);
  const strong = dates.filter((d) => d.category !== 'other' && d.confidence >= 0.75).length;
  const confident = dates.filter((d) => d.confidence >= 0.85).length;
  // A recognized venue plus at least one solid date (labeled or highly
  // confident, e.g. "August 9-13, 2026" on a conference homepage).
  if (venue && (strong >= 1 || confident >= 1)) return true;
  if (hints && strong >= 3) return true;
  return false;
}

/**
 * "All information present": a recognized deadline type with solid confidence,
 * or structured data, or a very confident labeled row. Filters out the vague
 * matches that produce wrong calendar entries.
 */
export function isCompleteDetection(d: { category: Category; confidence: number; source: string }): boolean {
  if (d.source === 'structured') return true;
  if (d.category !== 'other' && d.confidence >= 0.7) return true;
  return d.confidence >= 0.85;
}

const ACTIONABLE_CATEGORIES: Set<Category> = new Set([
  'abstract', 'submission', 'supplementary', 'rebuttal', 'camera-ready', 'registration',
]);

/**
 * A date the user must ACT on before it passes — used for the automatic
 * countdown pool. "Reviews released", notifications, and conference dates
 * are informational, not actionable.
 */
export function isActionableDeadline(d: { category: Category; context: string }): boolean {
  if (OPENING_HINT.test(d.context) && !DEADLINE_HINT.test(d.context)) return false;
  if (ACTIONABLE_CATEGORIES.has(d.category)) return true;
  return d.category !== 'other' && DEADLINE_HINT.test(d.context);
}

/** Build a human title like "NeurIPS 2026 — Paper submission". */
export function buildTitle(category: Category, conference: string | undefined, context: string): string {
  const label = CATEGORY_LABELS[category];
  if (category === 'other') {
    const line = context.split(/[\n.—–|:•]/)[0]?.trim().slice(0, 60);
    return conference ? `${conference} — ${line || 'Date'}` : line || 'Date found on page';
  }
  return conference ? `${conference} — ${label}` : label;
}

const KNOWN_VENUES =
  'AAAI|IJCAI|ICML|NeurIPS|NIPS|ICLR|COLM|ACL|EMNLP|NAACL|EACL|COLING|ARR|CoNLL|LREC|CVPR|ICCV|ECCV|WACV|BMVC|ICDAR|ICPR|SIGGRAPH|AISTATS|UAI|COLT|KDD|WSDM|WWW|TheWebConf|SIGIR|CIKM|ECIR|RecSys|CHI|UIST|CSCW|INTERSPEECH|ICASSP|ISMIR|ICRA|IROS|CoRL|RSS|SIGMOD|VLDB|ICDE|PODS|OSDI|SOSP|NSDI|USENIX|IEEE S&P|CCS|NDSS|PLDI|POPL|ICSE|FSE|ASE|ISCA|MICRO|ASPLOS|HPCA|SC|MLSys';

const VENUE_RE = new RegExp(`\\b(${KNOWN_VENUES})\\b[\\s'’-]*((?:19|20)?\\d{2})?`, 'i');
const GENERIC_RE = /\b([A-Z][A-Za-z]{1,9}(?:[-*][A-Z]+)?)\s*[''\s-]?((?:20)\d{2})\b/;

export function detectConference(...sources: Array<string | undefined>): string | undefined {
  for (const src of sources) {
    if (!src) continue;
    if (/ACL Rolling Review/i.test(src)) {
      const y = /((?:20)\d{2})/.exec(src);
      return y ? `ARR ${y[1]}` : 'ARR';
    }
    const known = VENUE_RE.exec(src);
    if (known) {
      let year = known[2];
      if (year && year.length === 2) year = `20${year}`;
      const name = known[1].toUpperCase() === 'NIPS' ? 'NeurIPS' : known[1];
      return year ? `${name} ${year}` : name;
    }
  }
  for (const src of sources) {
    if (!src) continue;
    const gen = GENERIC_RE.exec(src);
    if (gen && !/^(Deadline|Date|Call|The|Home|About|January|February|March|April|May|June|July|August|September|October|November|December)$/i.test(gen[1])) {
      return `${gen[1]} ${gen[2]}`;
    }
  }
  return undefined;
}
