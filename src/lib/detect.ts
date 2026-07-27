/**
 * Detection orchestrator: turns text blocks into DetectedDate records.
 */
import { parseDates, toISODate, toISOTime, type ParseOptions } from './dateParser';
import { classify, buildTitle, detectConference } from './classify';
import { mergeDetections } from './dedupe';
import type { DetectedDate } from '../shared/types';

export interface TextBlock {
  text: string;
  heading?: string;
}

export interface PageInfo {
  url: string;
  title?: string;
}

let counter = 0;
function nextId(): string {
  return `dd-${Date.now().toString(36)}-${(counter++).toString(36)}`;
}

export function detectInBlocks(blocks: TextBlock[], page: PageInfo, opts: ParseOptions = {}): DetectedDate[] {
  const pageConference = detectConference(page.title);
  const out: DetectedDate[] = [];

  for (const block of blocks) {
    const text = block.text;
    if (text.length < 4 || text.length > 4000) continue;
    for (const m of parseDates(text, opts)) {
      const ctxStart = Math.max(0, text.lastIndexOf('\n', m.index) + 1);
      const ctxEndNl = text.indexOf('\n', m.index + m.length);
      const ctxEnd = ctxEndNl === -1 ? text.length : ctxEndNl;
      const context = text.slice(ctxStart, ctxEnd).trim().slice(0, 300);

      // Classify from the row itself; heading is only a weak fallback when
      // the row has no label of its own.
      const labelled = /[A-Za-zぁ-んァ-ン一-龥]{4,}/.test(context.split(/[—–:|]/)[0] ?? '');
      let { category, score } = classify(context);
      if (category === 'other' && !labelled && block.heading) {
        const fromHeading = classify(block.heading);
        if (fromHeading.category !== 'other') {
          category = fromHeading.category;
          score = Math.min(fromHeading.score, 4);
        }
      }
      const conference = detectConference(block.heading, context, page.title) ?? pageConference;

      // News-feed timestamps ("Nov 7: Abstract deadline extended") are the
      // announcement's date, not the deadline itself — and being year-less,
      // their inferred year is unreliable. Demote them so they never become
      // wrong calendar entries. Real "May 15, 2026: papers due" rows keep
      // their year and are unaffected.
      const newsPrefix = m.index <= 2 && !m.hadYear && /^\s*:/.test(text.slice(m.index + m.length));
      if (newsPrefix) {
        category = 'other';
        score = 0;
      }

      let confidence = m.confidence;
      if (score >= 7) confidence = Math.min(1, confidence + 0.05);
      if (category === 'other') confidence -= 0.1;
      if (newsPrefix) confidence = Math.min(confidence, 0.5);

      out.push({
        id: nextId(),
        title: buildTitle(category, conference, context),
        category,
        conference,
        startDate: toISODate(m.start),
        endDate: m.end ? toISODate(m.end) : undefined,
        time: m.time ? toISOTime(m.time) : undefined,
        timezone: m.timezone,
        timezoneLabel: m.timezoneLabel,
        rawText: m.text,
        context,
        url: page.url,
        pageTitle: page.title,
        confidence: Math.max(0.1, Math.min(1, confidence)),
        source: 'regex',
      });
    }
  }
  return mergeDetections(out);
}
