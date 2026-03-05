'use client';

import { useState, useMemo, useEffect } from 'react';
import { formatDollars } from './Calculator';

export const WITHDRAWAL_RATE = 0.04;

export const PRESETS = [
  {
    label: 'Conservative',
    rate: 0.005,
    description: 'Spending stays roughly flat in real terms',
  },
  {
    label: 'Moderate',
    rate: 0.015,
    description: 'Gradual lifestyle upgrades — dining, travel, comfort',
  },
  {
    label: 'Aggressive',
    rate: 0.03,
    description: 'Significant lifestyle expansion over time',
  },
];

// BLS Consumer Expenditure Survey 2022 — monthly spending by age bracket (Table 1300)
export const BLS_BENCHMARKS: Array<{ maxAge: number; bracket: string; monthly: number }> = [
  { maxAge: 24,  bracket: 'under 25', monthly: 2704 },
  { maxAge: 34,  bracket: '25–34',    monthly: 4366 },
  { maxAge: 44,  bracket: '35–44',    monthly: 5971 },
  { maxAge: 54,  bracket: '45–54',    monthly: 6429 },
  { maxAge: 64,  bracket: '55–64',    monthly: 5739 },
  { maxAge: 74,  bracket: '65–74',    monthly: 4818 },
  { maxAge: 999, bracket: '75+',      monthly: 3703 },
];

// BLS-implied real lifestyle growth rate by age
export function getDefaultPresetIndex(age: number): number {
  if (age < 35) return 2; // Aggressive ~3% real
  if (age < 45) return 1; // Moderate  ~1.5% real
  return 0;               // Conservative ~0.5% real
}

export function getBLSBenchmark(age: number) {
  return BLS_BENCHMARKS.find((b) => age <= b.maxAge) ?? null;
}

// In real terms: only apply lifestyle inflation (general inflation is already baked out)
export function projectSpendingReal(monthlySpending: number, lifestyleRate: number, years: number): number {
  return monthlySpending * Math.pow(1 + lifestyleRate, years);
}

export function nestEggTarget(futureRealMonthlySpending: number): number {
  return (futureRealMonthlySpending * 12) / WITHDRAWAL_RATE;
}

export type TargetResults = {
  at59: number | null;
  at65: number | null;
};

export default function RetirementTarget({
  age,
  onTargetsChange,
}: {
  age: number | null;
  onTargetsChange?: (results: TargetResults) => void;
}) {
  const [monthlySpending,  setMonthlySpending]  = useState('');
  const [presetIndex,      setPresetIndex]      = useState(1);
  const [useCustom,        setUseCustom]        = useState(false);
  const [customRate,       setCustomRate]       = useState('');
  const [userPickedPreset, setUserPickedPreset] = useState(false);

  // Auto-select BLS-informed preset when age becomes available
  useEffect(() => {
    if (age !== null && !userPickedPreset) {
      setPresetIndex(getDefaultPresetIndex(age));
    }
  }, [age, userPickedPreset]);

  const benchmark = age !== null ? getBLSBenchmark(age) : null;

  const spending = parseFloat(monthlySpending);
  const lifestyleRate = useCustom
    ? parseFloat(customRate) / 100
    : PRESETS[presetIndex].rate;

  const isValid =
    age !== null &&
    !isNaN(spending) && spending > 0 &&
    !isNaN(lifestyleRate) && lifestyleRate >= 0 && lifestyleRate <= 0.2;

  const result59 = useMemo(() => {
    if (!isValid || age === null || age >= 59) return null;
    const futureReal = projectSpendingReal(spending, lifestyleRate, 59 - age);
    return { futureReal, target: nestEggTarget(futureReal) };
  }, [isValid, spending, lifestyleRate, age]);

  const result65 = useMemo(() => {
    if (!isValid || age === null || age >= 65) return null;
    const futureReal = projectSpendingReal(spending, lifestyleRate, 65 - age);
    return { futureReal, target: nestEggTarget(futureReal) };
  }, [isValid, spending, lifestyleRate, age]);

  // Lift targets to parent for gap analysis
  useEffect(() => {
    onTargetsChange?.({
      at59: result59?.target ?? null,
      at65: result65?.target ?? null,
    });
  }, [result59, result65]); // eslint-disable-line react-hooks/exhaustive-deps

  if (age === null) {
    return <EmptyState message="Enter your age in the savings section above to get started." />;
  }

  return (
    <div className="space-y-6">
      <div className="bg-stone-50 rounded-2xl border border-stone-200 p-8 space-y-7">

        {/* Monthly spending input */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-stone-600">
            Monthly spending
          </label>
          {benchmark && (
            <p className="text-xs text-stone-400">
              People aged {benchmark.bracket} typically spend {formatDollars(benchmark.monthly)}/month · BLS 2022
            </p>
          )}
          <div className="relative max-w-xs mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm pointer-events-none">
              $
            </span>
            <input
              type="number"
              value={monthlySpending}
              onChange={(e) => setMonthlySpending(e.target.value)}
              placeholder={benchmark ? String(benchmark.monthly) : '5000'}
              className="w-full rounded-lg border border-stone-300 bg-stone-100 pl-8 pr-4 py-2.5 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent text-sm"
            />
          </div>
        </div>

        {/* Lifestyle inflation selector */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-stone-600">
              Lifestyle inflation
            </label>
            <p className="text-xs text-stone-400 mt-0.5">
              How much your real spending grows each year above inflation.
              {benchmark ? ' Pre-selected based on your age.' : ''}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PRESETS.map((preset, i) => (
              <button
                key={preset.label}
                onClick={() => {
                  setPresetIndex(i);
                  setUseCustom(false);
                  setUserPickedPreset(true);
                }}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  !useCustom && presetIndex === i
                    ? 'border-green-600 bg-green-50'
                    : 'border-stone-200 hover:border-stone-300 bg-stone-50'
                }`}
              >
                <div className="text-sm font-semibold text-stone-900">{preset.label}</div>
                <div className="text-xs font-medium text-stone-400 mt-0.5">
                  +{preset.rate * 100}% / yr real
                </div>
                <div className="text-xs text-stone-500 mt-1.5 leading-snug">
                  {preset.description}
                </div>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => { setUseCustom(true); setUserPickedPreset(true); }}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                useCustom
                  ? 'border-green-600 bg-green-50 text-green-700'
                  : 'border-stone-200 text-stone-500 hover:border-stone-300'
              }`}
            >
              Custom
            </button>
            {useCustom && (
              <div className="relative">
                <input
                  type="number"
                  value={customRate}
                  onChange={(e) => setCustomRate(e.target.value)}
                  placeholder="2.0"
                  step="0.1"
                  min="0"
                  max="20"
                  className="w-24 rounded-lg border border-stone-300 bg-stone-100 pl-3 pr-7 py-1.5 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-green-600"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">%</span>
              </div>
            )}
          </div>

          {isValid && (
            <p className="text-xs text-stone-400">
              Your spending grows at {(lifestyleRate * 100).toFixed(1)}% per year in real terms (above 3% general inflation).
            </p>
          )}
        </div>
      </div>

      {isValid ? (
        <TargetOutputs result59={result59} result65={result65} age={age} />
      ) : (
        <EmptyState message="Enter your monthly spending above to see your retirement target." />
      )}
    </div>
  );
}

function TargetCard({
  title,
  subtitle,
  target,
  futureReal,
  ssResult,
  ssClaimAge,
  retireAge,
}: {
  title: string;
  subtitle: string;
  target: number;
  futureReal: number;
  ssResult?: { target: number; ssMonthly: number } | null;
  ssClaimAge?: 62 | 67 | 70;
  retireAge?: number;
}) {
  const bridgeYears =
    ssResult && ssClaimAge && retireAge && ssClaimAge > retireAge
      ? ssClaimAge - retireAge
      : null;
  return (
    <div className="bg-white rounded-2xl border border-[#d4c4b0] border-t-2 border-t-green-600 p-6 space-y-3">
      <div>
        <h3 className="text-lg font-semibold text-stone-900">{title}</h3>
        <p className="text-sm text-stone-400">{subtitle}</p>
      </div>
      {ssResult ? (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-stone-400">Without SS</span>
            <span className="text-xl font-semibold text-stone-400">{formatDollars(target)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-stone-400">With SS</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                SS reduces target
              </span>
              <span className="text-2xl font-bold text-green-700">{formatDollars(ssResult.target)}</span>
            </div>
          </div>
          <p className="text-xs font-medium text-green-600">
            ↓ {formatDollars(target - ssResult.target)} less needed with SS
          </p>
        </div>
      ) : (
        <div className="text-3xl font-bold tracking-tight text-stone-900">
          {formatDollars(target)}
        </div>
      )}
      <p className="text-xs text-stone-400">
        Covers {formatDollars(futureReal)}/month in today&apos;s dollars
      </p>
      {bridgeYears !== null && (
        <p className="text-xs text-orange-600">
          SS begins at {ssClaimAge} — budget for a {bridgeYears}-year bridge.
        </p>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#d4c4b0] p-10 flex items-center justify-center">
      <p className="text-sm text-stone-400 text-center max-w-xs">{message}</p>
    </div>
  );
}

function SkippedCard({ message }: { message: string }) {
  return (
    <div className="bg-[#faf6ef] rounded-2xl border border-[#d4c4b0] p-6 flex items-center justify-center text-stone-400 text-sm">
      {message}
    </div>
  );
}

export type TargetDetail = { futureReal: number; target: number };

export function TargetOutputs({
  result59,
  result65,
  age,
  targetRetAge = 65,
  ssResult59,
  ssResult65,
  ssClaimAge,
}: {
  result59: TargetDetail | null;
  result65: TargetDetail | null;
  age: number;
  targetRetAge?: number;
  ssResult59?: { target: number; ssMonthly: number } | null;
  ssResult65?: { target: number; ssMonthly: number } | null;
  ssClaimAge?: 62 | 67 | 70;
}) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {result59 ? (
          <TargetCard
            title="Target at age 59"
            subtitle={`${59 - age} years away · early retirement`}
            target={result59.target}
            futureReal={result59.futureReal}
            ssResult={ssResult59}
            ssClaimAge={ssClaimAge}
            retireAge={59}
          />
        ) : (
          <SkippedCard message="Already past age 59" />
        )}
        {result65 ? (
          <TargetCard
            title={`Target at age ${targetRetAge}`}
            subtitle={`${targetRetAge - age} years away · ${targetRetAge === 65 ? 'traditional retirement' : 'your target'}`}
            target={result65.target}
            futureReal={result65.futureReal}
            ssResult={ssResult65}
            ssClaimAge={ssClaimAge}
            retireAge={targetRetAge}
          />
        ) : (
          <SkippedCard message={`Already past age ${targetRetAge}`} />
        )}
      </div>
      <p className="text-xs text-stone-500 text-center pb-4">
        Target is 25× projected annual spending (4% withdrawal rate). All values in today&apos;s dollars.
      </p>
    </>
  );
}
