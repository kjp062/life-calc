'use client';

import { useState, useMemo } from 'react';
import { type Breakpoint, portfolioAtAge, formatDollars } from './Calculator';
import { projectSpendingReal, nestEggTarget } from './RetirementTarget';
import {
  type PathState,
  computeEarliestRetirement,
  computeCoastFI,
  computeSabbatical,
  computeSavingsReduction,
  computePayCut,
  type EarliestRetirementData,
  type CoastFIData,
  type SabbaticalData,
  type SavingsReductionData,
  type PayCutData,
} from '../lib/lifePlanMath';

interface LifePlanTabProps {
  age: number;
  savings: number;
  monthly: number;
  raiseReal: number;
  breakpoints: Breakpoint[];
  monthlySpending: number;
  lifestyleRate: number;
  income: number | null;
  targetRetAge: number;
  rate: number;
  isCalcValid: boolean;
  isTargetValid: boolean;
}

export default function LifePlanTab({
  age,
  savings,
  monthly,
  raiseReal,
  breakpoints,
  monthlySpending,
  lifestyleRate,
  income,
  targetRetAge,
  rate,
  isCalcValid,
  isTargetValid,
}: LifePlanTabProps) {
  const [sabbaticalMonths, setSabbaticalMonths] = useState(3);

  const isValid = isCalcValid && isTargetValid;

  const earliestRetirement = useMemo((): PathState<EarliestRetirementData> => {
    if (!isValid) return { status: 'not_calculable' };
    return computeEarliestRetirement(age, savings, monthly, raiseReal, breakpoints, monthlySpending, lifestyleRate, targetRetAge, rate);
  }, [isValid, age, savings, monthly, raiseReal, breakpoints, monthlySpending, lifestyleRate, targetRetAge, rate]);

  const coastFI = useMemo((): PathState<CoastFIData> => {
    if (!isValid) return { status: 'not_calculable' };
    return computeCoastFI(age, savings, monthly, raiseReal, breakpoints, monthlySpending, lifestyleRate, targetRetAge, rate);
  }, [isValid, age, savings, monthly, raiseReal, breakpoints, monthlySpending, lifestyleRate, targetRetAge, rate]);

  const sabbatical = useMemo((): PathState<SabbaticalData> => {
    if (!isValid) return { status: 'not_calculable' };
    return computeSabbatical(age, savings, monthly, raiseReal, breakpoints, monthlySpending, lifestyleRate, sabbaticalMonths, targetRetAge, rate);
  }, [isValid, age, savings, monthly, raiseReal, breakpoints, monthlySpending, lifestyleRate, sabbaticalMonths, targetRetAge, rate]);

  const savingsReduction = useMemo((): PathState<SavingsReductionData> => {
    if (!isValid) return { status: 'not_calculable' };
    return computeSavingsReduction(age, savings, monthly, raiseReal, breakpoints, monthlySpending, lifestyleRate, targetRetAge, rate);
  }, [isValid, age, savings, monthly, raiseReal, breakpoints, monthlySpending, lifestyleRate, targetRetAge, rate]);

  const payCut = useMemo((): PathState<PayCutData> => {
    if (!isValid || income === null) return { status: 'not_calculable' };
    return computePayCut(age, savings, monthly, raiseReal, breakpoints, monthlySpending, lifestyleRate, income, targetRetAge, rate);
  }, [isValid, age, savings, monthly, raiseReal, breakpoints, monthlySpending, lifestyleRate, income, targetRetAge, rate]);

  const portfolioAtTarget = useMemo(() => {
    if (!isCalcValid || age >= targetRetAge) return null;
    return portfolioAtAge(age, savings, monthly, raiseReal, breakpoints, rate, targetRetAge);
  }, [isCalcValid, age, savings, monthly, raiseReal, breakpoints, rate, targetRetAge]);

  const portfolio59 = useMemo(() => {
    if (!isCalcValid || age >= 59 || targetRetAge <= 59) return null;
    return portfolioAtAge(age, savings, monthly, raiseReal, breakpoints, rate, 59);
  }, [isCalcValid, age, savings, monthly, raiseReal, breakpoints, rate, targetRetAge]);

  const targetNestEgg = useMemo(() => {
    if (!isTargetValid || age >= targetRetAge) return null;
    return nestEggTarget(projectSpendingReal(monthlySpending, lifestyleRate, targetRetAge - age));
  }, [isTargetValid, monthlySpending, lifestyleRate, age, targetRetAge]);

  if (!isValid) {
    return (
      <div className="bg-white rounded-2xl border border-[#d4c4b0] p-10 flex items-center justify-center">
        <p className="text-sm text-stone-400 text-center max-w-xs">
          Fill in the panel above to see your life plan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Hero overview card */}
      <FinancialHealthOverview
        portfolio59={portfolio59}
        portfolioAtTarget={portfolioAtTarget}
        targetNestEgg={targetNestEgg}
        targetRetAge={targetRetAge}
        rate={rate}
        earliestRetirement={earliestRetirement}
        age={age}
      />

      {/* Group: Your horizon */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Your horizon</p>
        <EarliestRetirementCard state={earliestRetirement} />
        <CoastFICard state={coastFI} targetRetAge={targetRetAge} />
      </div>

      {/* Group: Your flexibility */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide pt-1">Your flexibility</p>
        <ReduceSavingsCard state={savingsReduction} monthly={monthly} targetRetAge={targetRetAge} />
        <PayCutCard state={payCut} monthlyIncome={income} />
        <SabbaticalCard
          state={sabbatical}
          months={sabbaticalMonths}
          onMonthsChange={setSabbaticalMonths}
          targetRetAge={targetRetAge}
        />
      </div>
    </div>
  );
}

// ─── Financial health overview (hero card) ────────────────────────────────────

function FinancialHealthOverview({
  portfolio59,
  portfolioAtTarget,
  targetNestEgg,
  targetRetAge,
  rate,
  earliestRetirement,
  age,
}: {
  portfolio59: number | null;
  portfolioAtTarget: number | null;
  targetNestEgg: number | null;
  targetRetAge: number;
  rate: number;
  earliestRetirement: PathState<EarliestRetirementData>;
  age: number;
}) {
  const ratePct = `${(rate * 100).toFixed(0)}%`;

  const summaryLine = earliestRetirement.status === 'achievable'
    ? `At ${ratePct} returns, you could retire as early as age ${earliestRetirement.data.retireAge}.`
    : `At ${ratePct} returns, you're on course for retirement at ${targetRetAge}.`;

  const stats = [
    portfolio59 !== null && { label: `Age 59 · ${59 - age}yr`, value: portfolio59 },
    portfolioAtTarget !== null && { label: `Age ${targetRetAge} · ${targetRetAge - age}yr`, value: portfolioAtTarget },
  ].filter(Boolean) as { label: string; value: number }[];

  const fundedPct = portfolioAtTarget !== null && targetNestEgg !== null
    ? Math.round((portfolioAtTarget / targetNestEgg) * 100)
    : null;
  const isFunded = fundedPct !== null && portfolioAtTarget !== null && targetNestEgg !== null && portfolioAtTarget >= targetNestEgg;

  return (
    <div className="rounded-2xl border border-green-950 bg-gradient-to-br from-green-950 to-green-900 p-6 space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Your financial trajectory</h2>
        <p className="text-sm text-green-300 mt-1">{summaryLine}</p>
      </div>

      {stats.length > 0 && (
        <div className="flex flex-wrap gap-6">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-xs text-green-400 font-medium">{s.label}</div>
              <div className="text-2xl font-bold text-white mt-0.5">{formatDollars(s.value)}</div>
            </div>
          ))}
        </div>
      )}

      {fundedPct !== null && targetNestEgg !== null && (
        <div className="pt-4 border-t border-green-700 space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-green-400">Target at {targetRetAge}</span>
            <span className="text-sm font-medium text-green-200">{formatDollars(targetNestEgg)}</span>
          </div>
          <div className={`text-lg font-bold ${isFunded ? 'text-green-300' : 'text-orange-300'}`}>
            {fundedPct}% {isFunded ? 'funded' : 'of target'}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Card primitives ──────────────────────────────────────────────────────────

type BadgeVariant = 'achievable' | 'achieved' | 'constrained' | 'muted';

function StatusBadge({ variant, label }: { variant: BadgeVariant; label: string }) {
  const cls = {
    achievable:  'bg-green-50 text-green-700',
    achieved:    'bg-green-50 text-green-700',
    constrained: 'bg-orange-50 text-orange-700',
    muted:       'bg-[#e8d9c5] text-stone-400',
  }[variant];
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
  );
}

function CardDot({ variant }: { variant: BadgeVariant }) {
  const cls = {
    achievable:  'bg-green-500',
    achieved:    'bg-green-500',
    constrained: 'bg-orange-500',
    muted:       'bg-stone-300',
  }[variant];
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cls}`} />;
}

function Card({
  dot,
  title,
  badge,
  children,
}: {
  dot: BadgeVariant;
  title: string;
  badge: { variant: BadgeVariant; label: string };
  children: React.ReactNode;
}) {
  const bgClass = dot === 'achieved' ? 'bg-green-50 border-green-300' : 'bg-white border-[#d4c4b0]';
  return (
    <div className={`rounded-2xl border p-5 space-y-3 ${bgClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CardDot variant={dot} />
          <span className="text-sm font-semibold text-stone-900">{title}</span>
        </div>
        <StatusBadge variant={badge.variant} label={badge.label} />
      </div>
      {children}
    </div>
  );
}

function NotCalculableCard({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-[#d4c4b0] bg-[#faf6ef] p-5">
      <div className="flex items-center gap-2">
        <CardDot variant="muted" />
        <span className="text-sm font-semibold text-stone-400">{title}</span>
      </div>
      <p className="text-sm text-stone-400 mt-2 ml-4">Fill in the panel above to unlock this.</p>
    </div>
  );
}

// ─── Life path cards ──────────────────────────────────────────────────────────

function EarliestRetirementCard({ state }: { state: PathState<EarliestRetirementData> }) {
  if (state.status === 'not_calculable') return <NotCalculableCard title="Earliest retirement" />;

  if (state.status === 'constrained') {
    return (
      <Card dot="constrained" title="Earliest retirement" badge={{ variant: 'constrained', label: 'Not in range' }}>
        <div>
          <p className="text-sm font-bold text-stone-900">Beyond age 80</p>
          <p className="text-sm text-stone-500 mt-1.5">{state.suggestion}</p>
        </div>
      </Card>
    );
  }

  if (state.status !== 'achievable') return null;
  const { retireAge, yearsAway } = state.data;
  return (
    <Card dot="achievable" title="Earliest retirement" badge={{ variant: 'achievable', label: 'Possible' }}>
      <div>
        <p className="text-sm font-bold text-stone-900">Age {retireAge}</p>
        <p className="text-sm text-stone-500 mt-1.5">
          {yearsAway} {yearsAway === 1 ? 'year' : 'years'} away at your current savings rate
        </p>
      </div>
    </Card>
  );
}

function CoastFICard({ state, targetRetAge }: { state: PathState<CoastFIData>; targetRetAge: number }) {
  if (state.status === 'not_calculable') return <NotCalculableCard title="Coast FI" />;

  if (state.status === 'already_achieved') {
    return (
      <Card dot="achieved" title="Coast FI" badge={{ variant: 'achieved', label: 'Already there' }}>
        <div>
          <p className="text-sm font-bold text-green-800">Your savings can carry you to retirement on their own.</p>
          <p className="text-sm text-green-700 mt-1.5">
            Even if you stopped contributing today, your portfolio would grow to cover retirement at {targetRetAge}.
          </p>
        </div>
      </Card>
    );
  }

  if (state.status === 'constrained') {
    return (
      <Card dot="constrained" title="Coast FI" badge={{ variant: 'constrained', label: 'Not yet' }}>
        <div>
          <p className="text-sm font-bold text-stone-900">Keep saving through {targetRetAge}</p>
          <p className="text-sm text-stone-500 mt-1.5">{state.suggestion}</p>
        </div>
      </Card>
    );
  }

  const { coastAge, yearsUntilCoast } = state.data;
  return (
    <Card dot="achievable" title="Coast FI" badge={{ variant: 'achievable', label: 'On track' }}>
      <div>
        <p className="text-sm font-bold text-stone-900">Age {coastAge}</p>
        <p className="text-sm text-stone-500 mt-1.5">
          In {yearsUntilCoast} {yearsUntilCoast === 1 ? 'year' : 'years'} you can stop contributing and still retire comfortably at {targetRetAge}.
        </p>
      </div>
    </Card>
  );
}

function ReduceSavingsCard({
  state,
  monthly,
  targetRetAge,
}: {
  state: PathState<SavingsReductionData>;
  monthly: number;
  targetRetAge: number;
}) {
  if (state.status === 'not_calculable') return <NotCalculableCard title="Reduce monthly savings" />;

  if (state.status === 'constrained') {
    return (
      <Card dot="constrained" title="Reduce monthly savings" badge={{ variant: 'constrained', label: 'At minimum' }}>
        <div>
          <p className="text-sm font-bold text-stone-900">Already at your floor</p>
          <p className="text-sm text-stone-500 mt-1.5">{(state as { status: string; suggestion: string }).suggestion}</p>
        </div>
      </Card>
    );
  }

  if (state.status !== 'achievable') return null;
  const { minSavings, reduction, reductionPct } = state.data;
  return (
    <Card dot="achievable" title="Reduce monthly savings" badge={{ variant: 'achievable', label: 'Possible' }}>
      <div>
        <p className="text-sm font-bold text-stone-900">
          You could free up {formatDollars(reduction)}/mo
        </p>
        <p className="text-sm text-stone-500 mt-1.5">
          That&apos;s a {Math.round(reductionPct * 100)}% reduction — drop to {formatDollars(minSavings)}/mo from {formatDollars(monthly)}/mo and still hit your age-{targetRetAge} target.
        </p>
      </div>
    </Card>
  );
}

function PayCutCard({
  state,
  monthlyIncome,
}: {
  state: PathState<PayCutData>;
  monthlyIncome: number | null;
}) {
  if (monthlyIncome === null) {
    return (
      <div className="rounded-2xl border-t-2 border-t-orange-300 border border-[#d4c4b0] bg-white p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0 bg-stone-300" />
          <span className="text-sm font-semibold text-stone-400">Affordable pay cut</span>
        </div>
        <p className="text-sm text-stone-400 ml-4">
          Add your gross income in Assumptions above to unlock this.
        </p>
      </div>
    );
  }

  if (state.status === 'not_calculable') return <NotCalculableCard title="Affordable pay cut" />;

  const annualIncome = monthlyIncome * 12;

  if (state.status === 'constrained') {
    return (
      <div className="rounded-2xl border-t-2 border-t-orange-300 border border-[#d4c4b0] bg-white p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0 bg-orange-500" />
            <span className="text-sm font-semibold text-stone-900">Affordable pay cut</span>
          </div>
          <StatusBadge variant="constrained" label="Tight" />
        </div>
        <div>
          <p className="text-sm text-stone-400">
            Gross income: {formatDollars(monthlyIncome)}/mo · {formatDollars(annualIncome)}/yr
          </p>
          <p className="text-sm font-bold text-stone-900 mt-2">No room for a pay cut</p>
          <p className="text-sm text-stone-500 mt-1.5">{(state as { status: string; suggestion: string }).suggestion}</p>
        </div>
      </div>
    );
  }

  if (state.status !== 'achievable') return null;
  const { maxPayCutDollars, maxPayCutPct, minIncome } = state.data;
  return (
    <div className="rounded-2xl border-t-2 border-t-orange-300 border border-[#d4c4b0] bg-white p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0 bg-orange-400" />
          <span className="text-sm font-semibold text-stone-900">Affordable pay cut</span>
        </div>
        <StatusBadge variant="achievable" label="Possible" />
      </div>
      <div>
        <p className="text-sm text-stone-400">
          Gross income: {formatDollars(monthlyIncome)}/mo · {formatDollars(annualIncome)}/yr
        </p>
        <p className="text-sm font-bold text-stone-900 mt-2">
          Up to {formatDollars(maxPayCutDollars)}/mo ({formatDollars(maxPayCutDollars * 12)}/yr)
        </p>
        <p className="text-sm text-stone-500 mt-1">
          That&apos;s a {Math.round(maxPayCutPct * 100)}% reduction — you need at least {formatDollars(minIncome)}/mo gross to stay on track.
        </p>
      </div>
    </div>
  );
}

function SabbaticalCard({
  state,
  months,
  onMonthsChange,
  targetRetAge,
}: {
  state: PathState<SabbaticalData>;
  months: number;
  onMonthsChange: (m: number) => void;
  targetRetAge: number;
}) {
  if (state.status === 'not_calculable') {
    return (
      <div className="rounded-2xl border-t-2 border-t-orange-300 border border-[#d4c4b0] bg-[#faf6ef] p-5">
        <div className="flex items-center gap-2">
          <CardDot variant="muted" />
          <span className="text-sm font-semibold text-stone-400">Sabbatical planner</span>
        </div>
        <p className="text-sm text-stone-400 mt-2 ml-4">Fill in the left panel to unlock this.</p>
      </div>
    );
  }

  const isAchievable = state.status === 'achievable';
  const variant: BadgeVariant = isAchievable ? 'achievable' : 'constrained';
  const badgeLabel = isAchievable ? 'Possible' : 'Too long';
  const data = (state as { status: string; data: SabbaticalData }).data;

  return (
    <div className="rounded-2xl border-t-2 border-t-orange-300 border border-[#d4c4b0] bg-white p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0 bg-orange-400" />
          <span className="text-sm font-semibold text-stone-900">Sabbatical planner</span>
        </div>
        <StatusBadge variant={variant} label={badgeLabel} />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => onMonthsChange(Math.max(1, months - 1))}
          disabled={months <= 1}
          className="w-8 h-8 rounded-lg border border-[#d4c4b0] flex items-center justify-center text-stone-600 hover:bg-[#faf6ef] transition-colors text-lg leading-none disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          −
        </button>
        <input
          type="number"
          value={months}
          min={1}
          max={36}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= 1 && v <= 36) onMonthsChange(v);
          }}
          className="w-16 text-center rounded-lg border border-[#d4c4b0] py-1.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <button
          onClick={() => onMonthsChange(Math.min(36, months + 1))}
          disabled={months >= 36}
          className="w-8 h-8 rounded-lg border border-[#d4c4b0] flex items-center justify-center text-stone-600 hover:bg-[#faf6ef] transition-colors text-lg leading-none disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          +
        </button>
        <span className="text-sm text-stone-500">months</span>
      </div>

      <div className="border-t border-[#e8d9c5] pt-3 space-y-1.5">
        <p className="text-sm font-bold text-stone-900">
          Cost: {formatDollars(Math.max(0, data.delta))} less at {targetRetAge}
        </p>
        {isAchievable ? (
          <p className="text-sm text-stone-500">
            A {months}-month break reduces your age-{targetRetAge} portfolio from{' '}
            {formatDollars(data.baselineAtTarget)} to {formatDollars(data.portfolioAtTarget)} — still on track.
          </p>
        ) : (
          <p className="text-sm text-orange-700">
            {(state as { status: string; suggestion: string }).suggestion}
          </p>
        )}
      </div>
    </div>
  );
}
