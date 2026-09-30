import type { PlayerWithOverall } from './types';

/**
 * Coaching engine.
 *
 * Turns a player's live stats + sheet weights/targets into plain-language
 * "how to improve" feedback. It runs on whatever data the Apps Script returns,
 * so the feedback updates automatically every time the sheet refreshes.
 *
 * Scoring mirrors overall.ts: each metric earns weight × min(1, value / target),
 * divided by the total weight. "Points available" is what a metric would add
 * to the overall score if it reached 100% of target.
 */

export type CoachLevel = 'focus' | 'watch';

export interface CoachItem {
  key: string;
  title: string;
  /** Overall points gained if this metric reaches target. */
  points: number;
  /** One-line "what to do", with the numbers filled in. */
  action: string;
  /** Short supporting detail (current vs target, rule of thumb). */
  detail: string;
  level: CoachLevel;
}

export interface Coaching {
  headline: string;
  focus: CoachItem[];
  watch: CoachItem[];
  strengths: string[];
  nextTier: { label: string; threshold: number; pointsNeeded: number } | null;
  /** Overall score if every Focus item hits target. */
  potential: number;
  notes: string[];
}

const TIERS: { label: string; threshold: number }[] = [
  { label: 'Silver', threshold: 70 },
  { label: 'Gold', threshold: 80 },
  { label: 'Diamond', threshold: 90 },
];

const NAMES: Record<string, string> = {
  appts: 'Appointments',
  contracts: 'Contracts Sent',
  icp5: '5+ ICP',
  arip: 'ARIP %',
  dealReview: 'Deal Review %',
  dealReviewLM: 'Deal Review % (LM)',
  dealReviewLLM: 'Deal Review % (LLM)',
  closedPct: 'Closed %',
  closedRevAttr: 'Closed Revenue (Attributed)',
  closedRevQtr: 'Closed Revenue',
  pipeline: 'Projected Pipeline',
};

const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;

function money(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (a >= 10_000) return `$${Math.round(v / 1_000)}K`;
  if (a >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v)}`;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Builds the action/detail text for one metric that is below target. */
function describe(
  key: string,
  value: number,
  target: number,
  pointsPerUnit: number, // overall points per 1.0 of ratio
  appts: number,
  isVP: boolean,
): { action: string; detail: string } {
  const apptWord = isVP ? 'attended appointments' : 'appointments set';

  switch (key) {
    case 'arip': {
      if (appts > 0) {
        const have = Math.round(value * appts);
        const need = Math.max(1, Math.ceil(target * appts) - have);
        const ruleOf = Math.max(1, Math.round(1 / target));
        const current = value > 0 ? `1 in ${Math.round(1 / value)}` : 'none yet';
        const perArip = round1(pointsPerUnit / (target * appts));
        return {
          action: `Get ${plural(need, 'more ARIP')} to reach ${pct(target)}. Each one is worth about +${perArip} pts.`,
          detail: `Rule of thumb: 1 ARIP for every ${ruleOf} ${apptWord}. You're at ${current} (${pct(value)}). Convert more of the meetings you already have before booking more.`,
        };
      }
      return {
        action: `Raise ARIP rate from ${pct(value)} to ${pct(target)}.`,
        detail: `Rule of thumb: 1 ARIP for every ${Math.round(1 / target)} ${apptWord}.`,
      };
    }

    case 'closedPct': {
      if (appts > 0) {
        const have = Math.round(value * appts);
        const need = Math.max(1, Math.ceil(target * appts) - have);
        const perClose = round1(pointsPerUnit / (target * appts));
        return {
          action: `Close ${plural(need, 'more deal')} to reach ${pct(target)}. Each close is worth about +${perClose} pts.`,
          detail: `${plural(have, 'close')} on ${appts.toLocaleString()} ${apptWord} so far (${pct(value, 2)}). Walk every open deal to the finish line weekly.`,
        };
      }
      return { action: `Raise closed rate from ${pct(value, 2)} to ${pct(target, 2)}.`, detail: '' };
    }

    case 'dealReview':
    case 'dealReviewLM':
    case 'dealReviewLLM': {
      const role = key === 'dealReviewLLM' ? ' where you are the Legacy LM' : key === 'dealReviewLM' ? ' where you are the LM' : '';
      return {
        action: `Move more ARIP deals${role} into Deal Review: ${pct(value, 0)} → ${pct(target, 0)}.`,
        detail: `Review every deal that left ARIP for any stage other than Deal Review and what stopped it.`,
      };
    }

    case 'closedRevQtr':
    case 'closedRevAttr': {
      const gap = target - value;
      const perPoint = pointsPerUnit > 0 ? target / pointsPerUnit : 0;
      return {
        action: `Close ${money(gap)} more to hit the ${money(target)} target.`,
        detail: `${money(value)} closed so far. Every ${money(perPoint)} closed ≈ +1 pt. Prioritize the biggest deals with the nearest close dates.`,
      };
    }

    case 'pipeline': {
      const gap = target - value;
      const perPoint = pointsPerUnit > 0 ? target / pointsPerUnit : 0;
      return {
        action: value > 0
          ? `Add ${money(gap)} of open pipeline to reach ${money(target)}.`
          : `Build ${money(target)} of open pipeline. It's at $0 right now.`,
        detail: `Every ${money(perPoint)} of pipeline ≈ +1 pt. Deals leave pipeline when they close, so keep adding new ones. Put a forecast $ and close date on every ARIP.`,
      };
    }

    default: {
      const isMoney = key.toLowerCase().includes('rev') || key === 'pipeline';
      return {
        action: `Raise ${NAMES[key] ?? key} to target.`,
        detail: isMoney
          ? `${money(value)} of ${money(target)}.`
          : `${value.toLocaleString(undefined, { maximumFractionDigits: 3 })} of ${target.toLocaleString()}.`,
      };
    }
  }
}

export function coach(player: PlayerWithOverall): Coaching {
  const isVP = player.role.includes('Vice');
  const appts = Number(player.stats.appts ?? 0);
  const entries = Object.entries(player.breakdown);
  const totalWeight = entries.reduce((s, [, b]) => s + (b.weight || 0), 0);

  const focusAll: CoachItem[] = [];
  const strengths: string[] = [];

  if (totalWeight > 0) {
    for (const [key, b] of entries) {
      if (!b.weight || b.weight <= 0 || !b.target || b.target <= 0) continue;
      const pointsPerUnit = (b.weight / totalWeight) * 100;
      const points = pointsPerUnit * (1 - b.ratio);
      if (b.ratio >= 1) {
        strengths.push(NAMES[key] ?? key);
        continue;
      }
      const { action, detail } = describe(key, b.value, b.target, pointsPerUnit, appts, isVP);
      focusAll.push({
        key,
        title: NAMES[key] ?? key,
        points: round1(points),
        action,
        detail,
        level: 'focus',
      });
    }
  }

  focusAll.sort((a, b) => b.points - a.points);
  const meaningful = focusAll.filter(i => i.points >= 0.5);
  const focus = meaningful.slice(0, 3);
  const watch = meaningful.slice(3).map(i => ({ ...i, level: 'watch' as const }));

  const next = TIERS.find(t => player.overall < t.threshold) ?? null;
  const nextTier = next
    ? { label: next.label, threshold: next.threshold, pointsNeeded: next.threshold - player.overall }
    : null;

  const potential = Math.min(100, Math.round(player.overall + focus.reduce((s, i) => s + i.points, 0)));

  let headline: string;
  if (totalWeight === 0) {
    headline = 'Feedback appears once weights and targets load from the sheet.';
  } else if (focus.length === 0) {
    headline = 'At or above target on every scored metric. Protect the lead.';
  } else {
    const top = focus[0];
    headline = `Biggest lever: ${top.title}, worth +${top.points} pts.`;
    const reach = [...TIERS].reverse().find(t => player.overall < t.threshold && potential >= t.threshold);
    if (reach) {
      headline += ` Hitting the top ${focus.length === 1 ? 'item' : `${focus.length} items`} gets you to ${reach.label}.`;
    }
  }

  return { headline, focus, watch, strengths, nextTier, potential, notes: player.notes ?? [] };
}
