'use client';

import { useState } from 'react';
import { formatDollars, type ScenarioResult, type ProjectionResults } from './Calculator';
import { type TargetResults } from './RetirementTarget';
import { getLeverSet, type AgeLeverSet, type LeverTier, type LeverImpact } from '../data/levers';

// ─── Tier logic ──────────────────────────────────────────────────────────────

type Tier = 'ahead' | 'on-track' | 'moderate' | 'significant';

function getTier(projected: number, target: number): Tier {
  const ratio = projected / target;
  if (ratio >= 1.20) return 'ahead';
  if (ratio >= 1.00) return 'on-track';
  if (ratio >= 0.75) return 'moderate';
  return 'significant';
}

// ─── Narrative copy ───────────────────────────────────────────────────────────

interface Narrative {
  headline: string;
  body: string;
}

function getNarrative(tier: Tier, yearsAway: number): Narrative {
  const hasRunway = yearsAway > 15;

  switch (tier) {
    case 'ahead':
      return {
        headline: "You're in a really strong position.",
        body: "You could ease up and enjoy more of your money now, or explore what this extra savings buys you later — like retiring earlier or working less sooner.",
      };

    case 'on-track':
      return {
        headline: "You're on track.",
        body: hasRunway
          ? "Stay the course and you're likely to hit your target. You could also save a bit more to build in extra cushion."
          : "Keep going — you're on track to hit your target. This is a strong place to be.",
      };

    case 'moderate':
      return {
        headline: "You're close — a few adjustments could get you there.",
        body: hasRunway
          ? "You're within reach. Small increases to your savings rate, or a salary bump along the way, could close this gap without major lifestyle changes."
          : "You're reasonably close. Some focused adjustments over the next few years could make a meaningful difference.",
      };

    case 'significant':
      return {
        headline: "There's a real gap here, but you have more options than you think.",
        body: hasRunway
          ? "With time on your side, meaningful changes to your savings rate could shift this picture significantly. Small moves now compound over decades."
          : "With less runway ahead, closing this gap will take some real choices — adjusting your spending target, your retirement age, or both. That's not a bad thing; it's the honest picture.",
      };
  }
}

// ─── Tier display helpers ─────────────────────────────────────────────────────

const TIER_LABEL: Record<Tier, string> = {
  'ahead':       'Ahead of target',
  'on-track':    'On track',
  'moderate':    'Slightly behind',
  'significant': 'Behind target',
};

const TIER_COLOR: Record<Tier, string> = {
  'ahead':       'text-emerald-600',
  'on-track':    'text-emerald-600',
  'moderate':    'text-amber-600',
  'significant': 'text-amber-600',
};

const TIER_DOT: Record<Tier, string> = {
  'ahead':       'bg-emerald-400',
  'on-track':    'bg-emerald-400',
  'moderate':    'bg-amber-400',
  'significant': 'bg-amber-400',
};

// ─── Lever helpers ────────────────────────────────────────────────────────────

function tierToLeverTier(tier: Tier): LeverTier {
  if (tier === 'moderate') return 'slightly-behind';
  if (tier === 'significant') return 'behind';
  return tier;
}

const IMPACT_BADGE: Record<LeverImpact, string> = {
  high:   'bg-emerald-50 text-emerald-700',
  medium: 'bg-blue-50 text-blue-600',
  low:    'bg-slate-100 text-slate-500',
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function GapAnalysis({
  projections,
  targets,
  age,
}: {
  projections: ProjectionResults;
  targets: TargetResults;
  age: number | null;
}) {
  const has59 = projections.at59 !== null && targets.at59 !== null && age !== null;
  const has65 = projections.at65 !== null && targets.at65 !== null && age !== null;
  const showToggle = has59 && has65;

  const [selectedAge, setSelectedAge] = useState<59 | 65>(65);

  // If selected age loses its data, fall back to whichever is available
  const activeAge: 59 | 65 =
    selectedAge === 59 && !has59 ? 65 :
    selectedAge === 65 && !has65 ? 59 :
    selectedAge;

  const activeProjections = activeAge === 59 ? projections.at59 : projections.at65;
  const activeTarget      = activeAge === 59 ? targets.at59     : targets.at65;

  if (!has59 && !has65) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-12 flex items-center justify-center">
        <p className="text-sm text-slate-400 text-center max-w-xs">
          Complete both sections above to see how your savings compare to your retirement target.
        </p>
      </div>
    );
  }

  // Anchor scenario for tier + narrative (6% real, middle rate)
  const anchor6 = activeProjections?.find((p) => p.key === 'rate6');
  const tier = anchor6 && activeTarget ? getTier(anchor6.amount, activeTarget) : null;
  const yearsAway = age !== null ? activeAge - age : 0;
  const narrative = tier ? getNarrative(tier, yearsAway) : null;

  return (
    <div className="space-y-6">
      {/* Age selectors — only when both targets are available */}
      {showToggle && (
        <div className="grid grid-cols-2 gap-4">
          {([59, 65] as const).map((retAge) => {
            const proj  = retAge === 59 ? projections.at59 : projections.at65;
            const tgt   = retAge === 59 ? targets.at59     : targets.at65;
            const p6    = proj?.find((p) => p.key === 'rate6');
            const t     = p6 && tgt ? getTier(p6.amount, tgt) : null;
            const gap   = p6 && tgt ? p6.amount - tgt : null;
            const isActive = activeAge === retAge;

            return (
              <button
                key={retAge}
                onClick={() => setSelectedAge(retAge)}
                className={`rounded-2xl border p-5 text-left transition-colors ${
                  isActive
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-base font-semibold text-slate-900">Age {retAge}</p>
                    <p className="text-xs text-slate-400">
                      {retAge === 59 ? 'Early retirement' : 'Traditional retirement'}
                    </p>
                  </div>
                  {isActive && (
                    <span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                      Viewing
                    </span>
                  )}
                </div>
                {t && gap !== null && (
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TIER_DOT[t]}`} />
                    <span className={`text-xs font-medium ${TIER_COLOR[t]}`}>
                      {TIER_LABEL[t]}
                    </span>
                    <span className="text-xs text-slate-400">
                      · {gap >= 0 ? '+' : ''}{formatDollars(gap)} at 6%
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Narrative panel */}
      {narrative && tier && (
        <NarrativePanel
          narrative={narrative}
          tier={tier}
          leverSet={age !== null ? getLeverSet(tierToLeverTier(tier), age) : null}
        />
      )}

      {/* Gap detail for active age */}
      {activeProjections && activeTarget !== null && (
        <GapDetail
          title={`At age ${activeAge}`}
          subtitle={`${yearsAway} years away · ${activeAge === 59 ? 'early' : 'traditional'} retirement`}
          target={activeTarget}
          projections={activeProjections}
        />
      )}
    </div>
  );
}

// ─── Gap detail card ──────────────────────────────────────────────────────────

function GapDetail({
  title,
  subtitle,
  target,
  projections,
}: {
  title: string;
  subtitle: string;
  target: number;
  projections: ScenarioResult[];
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-8 space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-400">{subtitle}</p>
      </div>

      <div className="flex items-baseline gap-2 pb-1">
        <span className="text-xs text-slate-400 uppercase tracking-wide font-medium">Target</span>
        <span className="text-xl font-bold text-slate-900">{formatDollars(target)}</span>
      </div>

      <div className="space-y-3 pt-3 border-t border-slate-100">
        {projections.map((p) => {
          const isAnchor = p.key === 'rate6';
          const gap      = p.amount - target;
          const isAhead  = gap >= 0;

          return (
            <div
              key={p.key}
              className={`rounded-lg ${isAnchor ? 'bg-slate-50 px-3 py-2.5 -mx-3' : 'py-0.5'}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                  <span className={`text-sm ${isAnchor ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                    {p.label} return
                  </span>
                  {isAnchor && <span className="text-xs text-slate-400">· historical avg</span>}
                </div>
                <span className={`font-semibold ${isAnchor ? 'text-base' : 'text-sm'} ${isAhead ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {isAhead ? '+' : ''}{formatDollars(gap)}
                </span>
              </div>
              <p className="text-xs text-slate-400 ml-4 mt-0.5">
                Projected {formatDollars(p.amount)} · {isAhead ? 'on track' : `short by ${formatDollars(Math.abs(gap))}`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Narrative panel ──────────────────────────────────────────────────────────

function NarrativePanel({
  narrative,
  tier,
  leverSet,
}: {
  narrative: Narrative;
  tier: Tier;
  leverSet: AgeLeverSet | null;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-8 space-y-4">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${TIER_DOT[tier]}`} />
        <p className="text-lg font-semibold text-slate-900">{narrative.headline}</p>
      </div>
      <p className="text-sm text-slate-500 leading-relaxed">{narrative.body}</p>

      {leverSet && (
        <div className="pt-4 mt-2 border-t border-slate-100 space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Your options</p>
          <div className="space-y-4">
            {leverSet.levers.map((lever) => (
              <div key={lever.id} className="space-y-1.5 pb-4 border-b border-slate-50 last:border-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-800">{lever.label}</p>
                  <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${IMPACT_BADGE[lever.impact]}`}>
                    {lever.impact} impact
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{lever.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
