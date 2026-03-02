'use client';

import { useState, useMemo } from 'react';

const GENERAL_INFLATION = 0.03;
const WITHDRAWAL_RATE   = 0.04; // 4% rule → 25x multiplier

const PRESETS = [
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

function formatDollars(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function projectSpending(
  monthlySpending: number,
  lifestyleRate: number,
  years: number
): number {
  // Compound general inflation and lifestyle inflation multiplicatively each year
  const annualRate = (1 + GENERAL_INFLATION) * (1 + lifestyleRate) - 1;
  return monthlySpending * Math.pow(1 + annualRate, years);
}

function nestEggTarget(futureMonthlySpending: number): number {
  return (futureMonthlySpending * 12) / WITHDRAWAL_RATE;
}

export default function RetirementTarget({ age }: { age: number }) {
  const [monthlySpending, setMonthlySpending] = useState('');
  const [presetIndex, setPresetIndex]         = useState(1); // default: Moderate
  const [useCustom, setUseCustom]             = useState(false);
  const [customRate, setCustomRate]           = useState('');

  const spending = parseFloat(monthlySpending);
  const lifestyleRate = useCustom
    ? parseFloat(customRate) / 100
    : PRESETS[presetIndex].rate;

  const isValid =
    !isNaN(spending) && spending > 0 &&
    !isNaN(lifestyleRate) && lifestyleRate >= 0 && lifestyleRate <= 0.2;

  const totalAnnualRate = isValid
    ? ((1 + GENERAL_INFLATION) * (1 + lifestyleRate) - 1) * 100
    : null;

  const result59 = useMemo(() => {
    if (!isValid || age >= 59) return null;
    const futureMonthly = projectSpending(spending, lifestyleRate, 59 - age);
    return { futureMonthly, target: nestEggTarget(futureMonthly) };
  }, [isValid, spending, lifestyleRate, age]);

  const result65 = useMemo(() => {
    if (!isValid || age >= 65) return null;
    const futureMonthly = projectSpending(spending, lifestyleRate, 65 - age);
    return { futureMonthly, target: nestEggTarget(futureMonthly) };
  }, [isValid, spending, lifestyleRate, age]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-7">

        {/* Monthly spending input */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-600">
            Current monthly spending
          </label>
          <div className="relative max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
              $
            </span>
            <input
              type="number"
              value={monthlySpending}
              onChange={(e) => setMonthlySpending(e.target.value)}
              placeholder="5000"
              className="w-full rounded-lg border border-slate-200 pl-7 pr-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        {/* Lifestyle inflation selector */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-600">
            Lifestyle inflation
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PRESETS.map((preset, i) => (
              <button
                key={preset.label}
                onClick={() => { setPresetIndex(i); setUseCustom(false); }}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  !useCustom && presetIndex === i
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="text-sm font-semibold text-slate-900">{preset.label}</div>
                <div className="text-xs font-medium text-slate-400 mt-0.5">
                  +{preset.rate * 100}% / yr
                </div>
                <div className="text-xs text-slate-500 mt-1.5 leading-snug">
                  {preset.description}
                </div>
              </button>
            ))}
          </div>

          {/* Custom rate option */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setUseCustom(true)}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                useCustom
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
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
                  className="w-24 rounded-lg border border-slate-200 pl-3 pr-7 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  %
                </span>
              </div>
            )}
          </div>

          {totalAnnualRate !== null && (
            <p className="text-xs text-slate-400">
              Total spending growth: ~{totalAnnualRate.toFixed(1)}% per year
              &nbsp;(3% general inflation + {(lifestyleRate * 100).toFixed(1)}% lifestyle)
            </p>
          )}
        </div>
      </div>

      {/* Results */}
      {isValid && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {result59 ? (
              <TargetCard
                title="Target at age 59"
                subtitle={`${59 - age} years away`}
                target={result59.target}
                futureMonthly={result59.futureMonthly}
              />
            ) : (
              <SkippedCard message="Already past age 59" />
            )}
            {result65 ? (
              <TargetCard
                title="Target at age 65"
                subtitle={`${65 - age} years away`}
                target={result65.target}
                futureMonthly={result65.futureMonthly}
              />
            ) : (
              <SkippedCard message="Already past age 65" />
            )}
          </div>

          <p className="text-xs text-slate-400 text-center pb-4">
            Target is 25× projected annual spending (4% withdrawal rate). Values in future dollars.
          </p>
        </>
      )}
    </div>
  );
}

function TargetCard({
  title,
  subtitle,
  target,
  futureMonthly,
}: {
  title: string;
  subtitle: string;
  target: number;
  futureMonthly: number;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-3">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-400">{subtitle}</p>
      </div>
      <div className="text-3xl font-bold tracking-tight text-slate-900">
        {formatDollars(target)}
      </div>
      <p className="text-xs text-slate-400">
        Covers {formatDollars(futureMonthly)}/month at retirement
      </p>
    </div>
  );
}

function SkippedCard({ message }: { message: string }) {
  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-8 flex items-center justify-center text-slate-400 text-sm">
      {message}
    </div>
  );
}
