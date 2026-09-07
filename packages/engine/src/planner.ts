import type {
  ConversationContext,
  ParseResult,
  TripPlan,
} from '@orca/contracts';
import { CONFIG } from './config';
import { FIXTURES } from './fixtures';

export const TASKS: TripPlan['tasks'] = [
  { id: 'marine', tool: 'marine_snapshot + pfz_candidates', dependsOn: [] },
  { id: 'weather', tool: 'weather_snapshot', dependsOn: [] },
  {
    id: 'gis',
    tool: 'geofence_lookup + route_sampling',
    dependsOn: ['marine', 'weather'],
  },
  { id: 'decision', tool: 'score_candidates', dependsOn: ['gis'] },
  {
    id: 'routes',
    tool: 'compare_routes + rank_zones',
    dependsOn: ['decision'],
  },
  { id: 'explanation', tool: 'explain_decision', dependsOn: ['routes'] },
];
export function parseIntent(
  message: string,
  previous: ConversationContext = {},
  clock: string = CONFIG.replayClock,
): ParseResult {
  const text = message.trim().toLowerCase();
  const context = { ...previous };
  const respond = (
    status: 'CLARIFICATION' | 'UNSUPPORTED',
    message: string,
  ): ParseResult => ({ status, message, context });
  if (!text || text.length > 2000)
    return respond('UNSUPPORTED', 'Enter a query of up to 2,000 characters.');
  const from = text
    .match(
      /\bfrom\s+(.+?)(?=\s+(?:tomorrow|today|on|at|next|to)\b|[.,?!]|$)/,
    )?.[1]
    ?.trim();
  if (from && from !== 'nagapattinam')
    return respond(
      'UNSUPPORTED',
      'This replay covers departures from Nagapattinam only.',
    );
  if (/\bnagapattinam\b/.test(text)) context.originName = 'Nagapattinam';
  if (
    /\b(?:next week|next month|monday|tuesday|wednesday|thursday|friday|saturday|sunday|yesterday|tonight)\b/.test(
      text,
    )
  ) {
    return respond(
      'CLARIFICATION',
      'Use today, tomorrow, or an explicit YYYY-MM-DD date and a departure time.',
    );
  }
  const followUp =
    /\bwhy\b/.test(text) &&
    /\b(?:nearest|closest|shortest|zone a)\b/.test(text);
  const isTimeFollowup =
    /\b(?:later|earlier|instead|leave|depart|at)\b/.test(text) &&
    !!previous.originName;
  const isPlan =
    /\b(?:fish|fishing|route|sea|sail)\b/.test(text) ||
    !!from ||
    (!!context.originName && !previous.originName);
  const isClarificationReply =
    !!previous.originName &&
    /(?:\btomorrow\b|\btoday\b|\bam\b|\bpm\b|\d{2}:\d{2}|\d{4}-\d{2}-\d{2})/.test(
      text,
    );
  if (!followUp && !isPlan && !isTimeFollowup && !isClarificationReply) {
    return respond(
      'UNSUPPORTED',
      'This milestone supports fishing trip and route planning from Nagapattinam, plus “why not nearest?” follow-ups.',
    );
  }
  if (
    /\b(?:ignore|override|bypass)\b/.test(text) ||
    /\b(?:even if|very high)\b/.test(text)
  ) {
    return respond(
      'UNSUPPORTED',
      'Safety and restricted-area gates cannot be overridden. Submit a trip to inspect the evidence and rejected options.',
    );
  }
  const base = new Date(Date.parse(clock) + 330 * 60000);
  let day = text.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1];
  if (/\btomorrow\b/.test(text)) {
    base.setUTCDate(base.getUTCDate() + 1);
    day = base.toISOString().slice(0, 10);
  } else if (/\btoday\b/.test(text)) day = base.toISOString().slice(0, 10);
  if (day) context.day = day;
  const twelve = text.match(
    /\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)(?=\s|[.,?!]|$)/,
  );
  const twentyFour = text.match(/\b(\d{1,2}):(\d{2})\b/);
  if (twelve) {
    const hour = Number(twelve[1]),
      minute = Number(twelve[2] ?? 0);
    if (hour < 1 || hour > 12 || minute > 59)
      return respond(
        'CLARIFICATION',
        'Enter a valid departure time, such as 5 AM or 17:30.',
      );
    context.hour = (hour % 12) + (twelve[3].startsWith('p') ? 12 : 0);
    context.minute = minute;
  } else if (twentyFour) {
    const hour = Number(twentyFour[1]),
      minute = Number(twentyFour[2]);
    if (hour > 23 || minute > 59)
      return respond('CLARIFICATION', 'Enter a valid 24-hour time.');
    context.hour = hour;
    context.minute = minute;
  } else if (/\bat\s+\d+\b/.test(text)) {
    return respond(
      'CLARIFICATION',
      'Specify AM or PM, or use a 24-hour time such as 05:00.',
    );
  }
  const shift = text.match(/\b(\d{1,2})\s+hours?\s+(later|earlier)\b/);
  if (shift && previous.departureTime) {
    const shifted = new Date(
      Date.parse(previous.departureTime) +
        Number(shift[1]) * (shift[2] === 'later' ? 1 : -1) * 3600000 +
        330 * 60000,
    );
    context.day = shifted.toISOString().slice(0, 10);
    context.hour = shifted.getUTCHours();
    context.minute = shifted.getUTCMinutes();
  }
  if (!context.originName)
    return respond(
      'CLARIFICATION',
      'What is your departure location? This replay covers Nagapattinam.',
    );
  if (!context.day && previous.departureTime)
    context.day = new Date(Date.parse(previous.departureTime) + 330 * 60000)
      .toISOString()
      .slice(0, 10);
  if (!context.day)
    return respond(
      'CLARIFICATION',
      'Which departure date? The replay clock is 6 September 2026; “tomorrow” means 7 September.',
    );
  if (context.hour === undefined)
    return respond(
      'CLARIFICATION',
      'What time are you leaving? Include AM/PM or use a 24-hour time.',
    );
  const local =
    context.day +
    'T' +
    String(context.hour).padStart(2, '0') +
    ':' +
    String(context.minute ?? 0).padStart(2, '0') +
    ':00+05:30';
  if (
    !Number.isFinite(Date.parse(local)) ||
    new Date(Date.parse(local) + 330 * 60000).toISOString().slice(0, 10) !==
      context.day
  ) {
    return respond(
      'CLARIFICATION',
      'That calendar date is invalid. Enter a valid YYYY-MM-DD date.',
    );
  }
  context.departureTime = local;
  return {
    status: 'READY',
    context,
    plan: {
      intent: followUp ? 'EXPLAIN_NEAREST' : 'FISHING_TRIP_PLAN',
      origin: FIXTURES.origin,
      departureTime: local,
      timezone: 'Asia/Kolkata',
      replayClock: clock,
      tasks: TASKS,
    },
  };
}
