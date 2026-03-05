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
  'ahead':       'text-green-600',
  'on-track':    'text-green-600',
  'moderate':    'text-orange-600',
  'significant': 'text-orange-600',
};

const TIER_DOT: Record<Tier, string> = {
  'ahead':       'bg-green-500',
  'on-track':    'bg-green-500',
  'moderate':    'bg-orange-500',
  'significant': 'bg-orange-500',
};

// ─── Lever helpers ────────────────────────────────────────────────────────────

function tierToLeverTier(tier: Tier): LeverTier {
  if (tier === 'moderate') return 'slightly-behind';
  if (tier === 'significant') return 'behind';
  return tier;
}

const IMPACT_BADGE: Record<LeverImpact, string> = {
  high:   'bg-green-50 text-green-700',
  medium: 'bg-blue-50 text-blue-600',
  low:    'bg-stone-100 text-stone-500',
};

// ─── Main component ───────────────────────────────────────────────────────────

function applyMultiplierToProjections(
  projections: ScenarioResult[],
  multiplier: number
): ScenarioResult[] {
  return projections.map((p) => ({ ...p, amount: p.amount * multiplier }));
}

export default function GapAnalysis({
  projections,
  targets,
  age,
  targetRetAge = 65,
  afterTaxMultiplier,
  ssActive,
}: {
  projections: ProjectionResults;
  targets: TargetResults;
  age: number | null;
  targetRetAge?: number;
  afterTaxMultiplier?: number | null;
  ssActive?: boolean;
}) {
  const has59    = projections.at59 !== null && targets.at59 !== null && age !== null;
  const hasTarget = projections.at65 !== null && targets.at65 !== null && age !== null;
  const showToggle = has59 && hasTarget;

  // true = viewing age 59 (early), false = viewing target age
  const [viewEarly, setViewEarly] = useState(false);

  const activeIsEarly = showToggle && viewEarly;
  const activeAge         = activeIsEarly ? 59 : targetRetAge;
  const activeTarget      = activeIsEarly ? targets.at59     : targets.at65;

  // Apply after-tax multiplier to projections for tier/gap calculations
  const effectiveAt59 = projections.at59 && afterTaxMultiplier
    ? applyMultiplierToProjections(projections.at59, afterTaxMultiplier)
    : projections.at59;
  const effectiveAt65 = projections.at65 && afterTaxMultiplier
    ? applyMultiplierToProjections(projections.at65, afterTaxMultiplier)
    : projections.at65;
  const effectiveProjections: ProjectionResults = { at59: effectiveAt59, at65: effectiveAt65 };

  const activeProjections = activeIsEarly ? effectiveProjections.at59 : effectiveProjections.at65;

  if (!has59 && !hasTarget) {
    return (
      <div className="bg-white rounded-2xl border border-[#d4c4b0] p-12 flex items-center justify-center">
        <p className="text-sm text-stone-400 text-center max-w-xs">
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
          {([true, false] as const).map((isEarly) => {
            const proj     = isEarly ? effectiveProjections.at59 : effectiveProjections.at65;
            const tgt      = isEarly ? targets.at59              : targets.at65;
            const p6       = proj?.find((p) => p.key === 'rate6');
            const t        = p6 && tgt ? getTier(p6.amount, tgt) : null;
            const gap      = p6 && tgt ? p6.amount - tgt : null;
            const retAge   = isEarly ? 59 : targetRetAge;
            const isActive = activeIsEarly === isEarly;

            return (
              <button
                key={retAge}
                onClick={() => setViewEarly(isEarly)}
                className={`rounded-2xl border p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 ${
                  isActive
                    ? 'border-green-600 bg-green-50 hover:border-green-500'
                    : 'border-[#d4c4b0] hover:border-[#b8a090] bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-base font-semibold text-stone-900">Age {retAge}</p>
                    <p className="text-xs text-stone-400">
                      {isEarly ? 'Early retirement' : targetRetAge === 65 ? 'Traditional retirement' : 'Your target'}
                    </p>
                  </div>
                  {isActive && (
                    <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
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
                    <span className="text-xs text-stone-400">
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
          subtitle={`${yearsAway} years away · ${activeIsEarly ? 'early retirement' : targetRetAge === 65 ? 'traditional retirement' : 'target retirement'}`}
          target={activeTarget}
          projections={activeProjections}
          ssActive={ssActive}
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
  ssActive,
}: {
  title: string;
  subtitle: string;
  target: number;
  projections: ScenarioResult[];
  ssActive?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#d4c4b0] p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-stone-900">{title}</h3>
        <p className="text-sm text-stone-400">{subtitle}</p>
      </div>

      <div className="pb-3">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-xs text-stone-400 uppercase tracking-wide font-medium">Target</span>
          {ssActive && (
            <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full ml-2">SS adjusted</span>
          )}
          <span className="text-xl font-bold text-stone-900 ml-auto">{formatDollars(target)}</span>
        </div>
        <p className="text-xs text-stone-400 mt-0.5">Your retirement target at 25× annual spending</p>
      </div>

      <div className="space-y-3 pt-3 border-t border-[#e8d9c5]">
        {projections.map((p) => {
          const isAnchor = p.key === 'rate6';
          const gap      = p.amount - target;
          const isAhead  = gap >= 0;

          return (
            <div
              key={p.key}
              className={`rounded-lg ${isAnchor ? 'bg-[#faf6ef] px-3 py-2.5 -mx-3' : 'py-0.5'}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                  <span className={`text-sm ${isAnchor ? 'text-stone-700 font-medium' : 'text-stone-500'}`}>
                    {p.label} return
                  </span>
                  {isAnchor && <span className="text-xs text-stone-400">· historical avg</span>}
                </div>
                <span className={`font-semibold ${isAnchor ? 'text-base' : 'text-sm'} ${isAhead ? 'text-green-600' : 'text-orange-600'}`}>
                  {isAhead ? '+' : ''}{formatDollars(gap)}
                </span>
              </div>
              <p className="text-xs text-stone-400 ml-4 mt-0.5">
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
  const bgClass = (tier === 'ahead' || tier === 'on-track')
    ? 'bg-green-50 border-green-200'
    : 'bg-orange-50 border-orange-200';
  return (
    <div className={`rounded-2xl border p-6 space-y-4 ${bgClass}`}>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${TIER_DOT[tier]}`} />
        <p className="text-lg font-semibold text-stone-900">{narrative.headline}</p>
      </div>
      <p className="text-sm text-stone-500 leading-relaxed">{narrative.body}</p>

      {leverSet && (
        <div className="pt-4 mt-2 border-t border-[#e8d9c5] space-y-4">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Your options</p>
          <div className="space-y-4">
            {leverSet.levers.map((lever) => (
              <div key={lever.id} className="space-y-1.5 pb-4 border-b border-[#e8d9c5] last:border-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-stone-800">{lever.label}</p>
                  <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${IMPACT_BADGE[lever.impact]}`}>
                    {lever.impact} impact
                  </span>
                </div>
                <p className="text-xs text-stone-500 leading-relaxed">{lever.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
