'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

const RATES = [
  { key: 'rate8',  label: '8%',  value: 0.08, color: '#94a3b8' },
  { key: 'rate9',  label: '9%',  value: 0.09, color: '#3b82f6' },
  { key: 'rate10', label: '10%', value: 0.10, color: '#6366f1' },
];

interface Breakpoint {
  age: string;
  monthlySavings: string;
  raiseRate: string;
}

// FV of one period: growing monthly contributions on top of a compounding portfolio.
// Uses the growing annuity FV formula compounded monthly.
function periodFV(
  startPortfolio: number,
  startMonthlySavings: number,
  annualReturnRate: number,
  annualRaiseRate: number,
  years: number
): number {
  if (years <= 0) return startPortfolio;
  const r = Math.pow(1 + annualReturnRate, 1 / 12) - 1; // monthly return rate
  const g = Math.pow(1 + annualRaiseRate,  1 / 12) - 1; // monthly raise rate
  const n = Math.round(years * 12);

  const fvPortfolio = startPortfolio * Math.pow(1 + r, n);

  // Growing annuity FV; special-case when r ≈ g to avoid division by ~0
  const fvContributions =
    Math.abs(r - g) < 1e-10
      ? startMonthlySavings * n * Math.pow(1 + r, n - 1)
      : startMonthlySavings * (Math.pow(1 + r, n) - Math.pow(1 + g, n)) / (r - g);

  return fvPortfolio + fvContributions;
}

// Calculate portfolio value at targetAge by chaining periods defined by breakpoints.
function portfolioAtAge(
  currentAge: number,
  currentSavings: number,
  baseMonthlySavings: number,
  baseAnnualRaise: number,
  breakpoints: Breakpoint[],
  annualReturnRate: number,
  targetAge: number
): number {
  if (targetAge <= currentAge) return currentSavings;

  // Build a sorted list of valid breakpoints within range
  const validBPs = breakpoints
    .map((bp) => ({
      age:     parseInt(bp.age, 10),
      monthly: parseFloat(bp.monthlySavings),
      raise:   parseFloat(bp.raiseRate) / 100,
    }))
    .filter(
      (bp) =>
        !isNaN(bp.age) && bp.age > currentAge && bp.age < targetAge &&
        !isNaN(bp.monthly) && bp.monthly >= 0 &&
        !isNaN(bp.raise) && bp.raise >= 0
    )
    .sort((a, b) => a.age - b.age);

  // Walk through periods
  let portfolio  = currentSavings;
  let lastAge    = currentAge;
  let lastMonthly = baseMonthlySavings;
  let lastRaise  = baseAnnualRaise;

  for (const bp of validBPs) {
    if (bp.age <= lastAge) continue;
    portfolio   = periodFV(portfolio, lastMonthly, annualReturnRate, lastRaise, bp.age - lastAge);
    lastAge     = bp.age;
    lastMonthly = bp.monthly;
    lastRaise   = bp.raise;
  }

  return periodFV(portfolio, lastMonthly, annualReturnRate, lastRaise, targetAge - lastAge);
}

function formatDollars(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatAxisDollars(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)     return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value}`;
}

const EMPTY_BP: Breakpoint = { age: '', monthlySavings: '', raiseRate: '' };

export default function Calculator({
  onAgeChange,
}: {
  onAgeChange?: (age: number | null) => void;
}) {
  const [currentAge,      setCurrentAge]      = useState('');
  const [currentSavings,  setCurrentSavings]  = useState('');
  const [monthlySavings,  setMonthlySavings]  = useState('');
  const [raiseRate,       setRaiseRate]        = useState('');
  const [breakpoints,     setBreakpoints]      = useState<Breakpoint[]>([]);

  const age     = parseInt(currentAge, 10);
  const savings = parseFloat(currentSavings);
  const monthly = parseFloat(monthlySavings);
  const raise   = raiseRate === '' ? 0 : parseFloat(raiseRate) / 100;

  const validAge = !isNaN(age) && age > 0 && age < 80;

  useEffect(() => {
    onAgeChange?.(validAge ? age : null);
  }, [age, validAge]); // eslint-disable-line react-hooks/exhaustive-deps

  const isValid =
    validAge &&
    !isNaN(savings) && savings >= 0 &&
    !isNaN(monthly) && monthly >= 0 &&
    !isNaN(raise)   && raise >= 0;

  const chartData = useMemo(() => {
    if (!isValid) return [];
    const endAge = Math.max(66, age + 2);
    return Array.from({ length: endAge - age + 1 }, (_, i) => {
      const a = age + i;
      const point: Record<string, number> = { age: a };
      for (const rate of RATES) {
        point[rate.key] = Math.round(
          portfolioAtAge(age, savings, monthly, raise, breakpoints, rate.value, a)
        );
      }
      return point;
    });
  }, [isValid, age, savings, monthly, raise, breakpoints]);

  const projections59 = useMemo(() => {
    if (!isValid || age >= 59) return null;
    return RATES.map((rate) => ({
      ...rate,
      amount: portfolioAtAge(age, savings, monthly, raise, breakpoints, rate.value, 59),
    }));
  }, [isValid, age, savings, monthly, raise, breakpoints]);

  const projections65 = useMemo(() => {
    if (!isValid || age >= 65) return null;
    return RATES.map((rate) => ({
      ...rate,
      amount: portfolioAtAge(age, savings, monthly, raise, breakpoints, rate.value, 65),
    }));
  }, [isValid, age, savings, monthly, raise, breakpoints]);

  function addBreakpoint() {
    if (breakpoints.length < 3) setBreakpoints([...breakpoints, { ...EMPTY_BP }]);
  }

  function updateBreakpoint(i: number, field: keyof Breakpoint, value: string) {
    const updated = [...breakpoints];
    updated[i] = { ...updated[i], [field]: value };
    setBreakpoints(updated);
  }

  function removeBreakpoint(i: number) {
    setBreakpoints(breakpoints.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <Field label="Current age">
            <input
              type="number"
              value={currentAge}
              onChange={(e) => setCurrentAge(e.target.value)}
              placeholder="35"
              className={inputClass}
            />
          </Field>
          <Field label="Current savings">
            <div className="relative">
              <DollarSign />
              <input
                type="number"
                value={currentSavings}
                onChange={(e) => setCurrentSavings(e.target.value)}
                placeholder="50000"
                className={`${inputClass} pl-7`}
              />
            </div>
          </Field>
          <Field label="Monthly savings">
            <div className="relative">
              <DollarSign />
              <input
                type="number"
                value={monthlySavings}
                onChange={(e) => setMonthlySavings(e.target.value)}
                placeholder="1000"
                className={`${inputClass} pl-7`}
              />
            </div>
          </Field>
          <Field label="Annual raise">
            <div className="relative">
              <input
                type="number"
                value={raiseRate}
                onChange={(e) => setRaiseRate(e.target.value)}
                placeholder="4"
                className={`${inputClass} pr-7`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
                %
              </span>
            </div>
          </Field>
        </div>

        {/* Salary change breakpoints */}
        {breakpoints.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Salary changes
            </p>
            {breakpoints.map((bp, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
                <Field label={i === 0 ? 'At age' : ''}>
                  <input
                    type="number"
                    value={bp.age}
                    onChange={(e) => updateBreakpoint(i, 'age', e.target.value)}
                    placeholder="45"
                    className={inputClass}
                  />
                </Field>
                <Field label={i === 0 ? 'New monthly savings' : ''}>
                  <div className="relative">
                    <DollarSign />
                    <input
                      type="number"
                      value={bp.monthlySavings}
                      onChange={(e) => updateBreakpoint(i, 'monthlySavings', e.target.value)}
                      placeholder="3000"
                      className={`${inputClass} pl-7`}
                    />
                  </div>
                </Field>
                <Field label={i === 0 ? 'New annual raise' : ''}>
                  <div className="relative">
                    <input
                      type="number"
                      value={bp.raiseRate}
                      onChange={(e) => updateBreakpoint(i, 'raiseRate', e.target.value)}
                      placeholder="3"
                      className={`${inputClass} pr-7`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
                      %
                    </span>
                  </div>
                </Field>
                <button
                  onClick={() => removeBreakpoint(i)}
                  className="mb-0.5 text-slate-300 hover:text-rose-400 transition-colors text-xl leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {breakpoints.length < 3 && (
          <button
            onClick={addBreakpoint}
            className="text-sm text-blue-500 hover:text-blue-600 transition-colors"
          >
            + Add salary change
          </button>
        )}
      </div>

      {isValid && (
        <>
          {/* Chart */}
          <div className="bg-white rounded-2xl border border-slate-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-semibold text-slate-700">Projected portfolio value</h2>
              <div className="flex items-center gap-5">
                {RATES.map((r) => (
                  <div key={r.key} className="flex items-center gap-1.5">
                    <span
                      className="w-3 h-0.5 rounded-full inline-block"
                      style={{ backgroundColor: r.color }}
                    />
                    <span className="text-xs text-slate-400">{r.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="age"
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: 'Age', position: 'insideBottomRight', offset: -4, fontSize: 11, fill: '#cbd5e1' }}
                />
                <YAxis
                  tickFormatter={formatAxisDollars}
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    const rate = RATES.find((r) => r.key === name);
                    return [formatDollars(value), `${rate?.label} return`];
                  }}
                  labelFormatter={(label) => `Age ${label}`}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: 13 }}
                />
                {age < 59 && (
                  <ReferenceLine
                    x={59}
                    stroke="#e2e8f0"
                    strokeDasharray="4 4"
                    label={{ value: '59', position: 'top', fontSize: 11, fill: '#94a3b8' }}
                  />
                )}
                {age < 65 && (
                  <ReferenceLine
                    x={65}
                    stroke="#e2e8f0"
                    strokeDasharray="4 4"
                    label={{ value: '65', position: 'top', fontSize: 11, fill: '#94a3b8' }}
                  />
                )}
                {RATES.map((rate) => (
                  <Line
                    key={rate.key}
                    type="monotone"
                    dataKey={rate.key}
                    stroke={rate.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Projection cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {projections59 ? (
              <ProjectionCard
                title="At age 59"
                subtitle={`${59 - age} years away`}
                projections={projections59}
              />
            ) : (
              <SkippedCard message="Already past age 59" />
            )}
            {projections65 ? (
              <ProjectionCard
                title="At age 65"
                subtitle={`${65 - age} years away`}
                projections={projections65}
              />
            ) : (
              <SkippedCard message="Already past age 65" />
            )}
          </div>

          <p className="text-xs text-slate-400 text-center pb-4">
            Nominal returns of 8%, 9%, and 10% assume 3% annual inflation.
            Values shown in future dollars.
          </p>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}

function DollarSign() {
  return (
    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
      $
    </span>
  );
}

function ProjectionCard({
  title,
  subtitle,
  projections,
}: {
  title: string;
  subtitle: string;
  projections: { key: string; label: string; color: string; amount: number }[];
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-400">{subtitle}</p>
      </div>
      <div className="space-y-4">
        {projections.map((p) => (
          <div key={p.key} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: p.color }}
              />
              <span className="text-sm text-slate-500">{p.label} return</span>
            </div>
            <span className="text-base font-semibold text-slate-900">
              {formatDollars(p.amount)}
            </span>
          </div>
        ))}
      </div>
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

const inputClass =
  'w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm';
