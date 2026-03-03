'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  RATES,
  INFLATION,
  type Breakpoint,
  type ProjectionResults,
  type ScenarioResult,
  portfolioAtAge,
  ProjectionOutputs,
  formatDollars,
} from './Calculator';
import {
  PRESETS,
  type TargetResults,
  type TargetDetail,
  projectSpendingReal,
  nestEggTarget,
  getBLSBenchmark,
  getDefaultPresetIndex,
  TargetOutputs,
} from './RetirementTarget';
import GapAnalysis from './GapAnalysis';

const EMPTY_BP: Breakpoint = { age: '', monthlySavings: '', raiseRate: '' };

export default function LifeCalculator() {
  // ─── Calculator inputs ────────────────────────────────────────────────────────
  const [currentAge,     setCurrentAge]     = useState('');
  const [currentSavings, setCurrentSavings] = useState('');
  const [monthlySavings, setMonthlySavings] = useState('');
  const [raiseRate,      setRaiseRate]      = useState('');
  const [breakpoints,    setBreakpoints]    = useState<Breakpoint[]>([]);

  // ─── RetirementTarget inputs ──────────────────────────────────────────────────
  const [monthlySpending,  setMonthlySpending]  = useState('');
  const [presetIndex,      setPresetIndex]      = useState(1);
  const [useCustom,        setUseCustom]        = useState(false);
  const [customRate,       setCustomRate]       = useState('');
  const [userPickedPreset, setUserPickedPreset] = useState(false);

  const [copied, setCopied] = useState(false);
  const firstRender = useRef(true);

  // ─── Derived: calculator ──────────────────────────────────────────────────────
  const age          = parseInt(currentAge, 10);
  const savings      = parseFloat(currentSavings);
  const monthly      = parseFloat(monthlySavings);
  const nominalRaise = raiseRate === '' ? 0 : parseFloat(raiseRate) / 100;
  const raise        = (1 + nominalRaise) / (1 + INFLATION) - 1;
  const validAge     = !isNaN(age) && age > 0 && age < 80;

  const isCalcValid =
    validAge &&
    !isNaN(savings) && savings >= 0 &&
    !isNaN(monthly) && monthly >= 0 &&
    !isNaN(raise)   && raise >= 0;

  // ─── Derived: retirement target ───────────────────────────────────────────────
  const spending      = parseFloat(monthlySpending);
  const lifestyleRate = useCustom ? parseFloat(customRate) / 100 : PRESETS[presetIndex].rate;

  const isTargetValid =
    isCalcValid &&
    !isNaN(spending) && spending > 0 &&
    !isNaN(lifestyleRate) && lifestyleRate >= 0 && lifestyleRate <= 0.2;

  // Auto-select BLS-informed preset when age becomes available
  useEffect(() => {
    if (validAge && !userPickedPreset) {
      setPresetIndex(getDefaultPresetIndex(age));
    }
  }, [age, validAge, userPickedPreset]); // eslint-disable-line react-hooks/exhaustive-deps

  const benchmark = validAge ? getBLSBenchmark(age) : null;

  // ─── URL persistence ──────────────────────────────────────────────────────────

  // On mount: restore state from URL params
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (!p.size) return;

    const a  = p.get('a');  if (a)  setCurrentAge(a);
    const s  = p.get('s');  if (s)  setCurrentSavings(s);
    const m  = p.get('m');  if (m)  setMonthlySavings(m);
    const r  = p.get('r');  if (r)  setRaiseRate(r);
    const sp = p.get('sp'); if (sp) setMonthlySpending(sp);

    const cu = p.get('cu');
    const cr = p.get('cr');
    const pi = p.get('pi');
    if (cu === '1') {
      setUseCustom(true);
      setUserPickedPreset(true);
      if (cr) setCustomRate(cr);
    } else if (pi !== null) {
      setPresetIndex(Number(pi));
      setUserPickedPreset(true);
    }

    const bps: Breakpoint[] = [];
    for (let i = 1; i <= 3; i++) {
      const ba = p.get(`b${i}a`);
      const bm = p.get(`b${i}m`);
      const br = p.get(`b${i}r`);
      if (ba !== null || bm !== null || br !== null) {
        bps.push({ age: ba ?? '', monthlySavings: bm ?? '', raiseRate: br ?? '' });
      }
    }
    if (bps.length) setBreakpoints(bps);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // On state change: sync URL (skip first render to avoid overwriting params before read effect applies)
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }

    const p = new URLSearchParams();
    if (currentAge)      p.set('a',  currentAge);
    if (currentSavings)  p.set('s',  currentSavings);
    if (monthlySavings)  p.set('m',  monthlySavings);
    if (raiseRate)       p.set('r',  raiseRate);
    if (monthlySpending) p.set('sp', monthlySpending);
    if (presetIndex !== 1) p.set('pi', String(presetIndex));
    if (useCustom) {
      p.set('cu', '1');
      if (customRate) p.set('cr', customRate);
    }
    breakpoints.forEach((bp, i) => {
      if (bp.age)            p.set(`b${i + 1}a`, bp.age);
      if (bp.monthlySavings) p.set(`b${i + 1}m`, bp.monthlySavings);
      if (bp.raiseRate)      p.set(`b${i + 1}r`, bp.raiseRate);
    });

    const qs = p.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [currentAge, currentSavings, monthlySavings, raiseRate, monthlySpending, presetIndex, useCustom, customRate, breakpoints]);

  // ─── Projections ──────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!isCalcValid) return [];
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
  }, [age, savings, monthly, raise, breakpoints]); // eslint-disable-line react-hooks/exhaustive-deps

  const projections59 = useMemo((): ScenarioResult[] | null => {
    if (!isCalcValid || age >= 59) return null;
    return RATES.map((rate) => ({
      ...rate,
      amount: portfolioAtAge(age, savings, monthly, raise, breakpoints, rate.value, 59),
    }));
  }, [age, savings, monthly, raise, breakpoints]); // eslint-disable-line react-hooks/exhaustive-deps

  const projections65 = useMemo((): ScenarioResult[] | null => {
    if (!isCalcValid || age >= 65) return null;
    return RATES.map((rate) => ({
      ...rate,
      amount: portfolioAtAge(age, savings, monthly, raise, breakpoints, rate.value, 65),
    }));
  }, [age, savings, monthly, raise, breakpoints]); // eslint-disable-line react-hooks/exhaustive-deps

  const projections: ProjectionResults = { at59: projections59, at65: projections65 };

  // ─── Targets ──────────────────────────────────────────────────────────────────
  const result59 = useMemo((): TargetDetail | null => {
    if (!isTargetValid || age >= 59) return null;
    const futureReal = projectSpendingReal(spending, lifestyleRate, 59 - age);
    return { futureReal, target: nestEggTarget(futureReal) };
  }, [age, spending, lifestyleRate]); // eslint-disable-line react-hooks/exhaustive-deps

  const result65 = useMemo((): TargetDetail | null => {
    if (!isTargetValid || age >= 65) return null;
    const futureReal = projectSpendingReal(spending, lifestyleRate, 65 - age);
    return { futureReal, target: nestEggTarget(futureReal) };
  }, [age, spending, lifestyleRate]); // eslint-disable-line react-hooks/exhaustive-deps

  const targets: TargetResults = {
    at59: result59?.target ?? null,
    at65: result65?.target ?? null,
  };

  // ─── Breakpoint helpers ───────────────────────────────────────────────────────
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

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8">

      {/* ── Left panel: inputs ──────────────────────────────────────────────── */}
      <div className="lg:sticky lg:top-8 lg:h-fit space-y-4">

        {/* Savings */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Savings</p>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Age">
              <input
                type="number"
                value={currentAge}
                onChange={(e) => setCurrentAge(e.target.value)}
                placeholder="35"
                className={inputClass}
              />
            </Field>

            <Field label="Salary raise">
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

            <Field label="Savings">
              <div className="relative">
                <DollarSign />
                <input
                  type="number"
                  value={currentSavings}
                  onChange={(e) => setCurrentSavings(e.target.value)}
                  placeholder="50000"
                  className={`${inputClass} pl-8`}
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
                  className={`${inputClass} pl-8`}
                />
              </div>
            </Field>
          </div>

          {breakpoints.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Salary changes</p>
              {breakpoints.map((bp, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">Change {i + 1}</p>
                    <button
                      onClick={() => removeBreakpoint(i)}
                      className="text-slate-300 hover:text-slate-500 transition-colors text-lg leading-none"
                    >
                      ×
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">At age</p>
                      <input
                        type="number"
                        value={bp.age}
                        onChange={(e) => updateBreakpoint(i, 'age', e.target.value)}
                        placeholder="45"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Monthly</p>
                      <div className="relative">
                        <DollarSign />
                        <input
                          type="number"
                          value={bp.monthlySavings}
                          onChange={(e) => updateBreakpoint(i, 'monthlySavings', e.target.value)}
                          placeholder="3000"
                          className={`${inputClass} pl-8`}
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Raise</p>
                      <div className="relative">
                        <input
                          type="number"
                          value={bp.raiseRate}
                          onChange={(e) => updateBreakpoint(i, 'raiseRate', e.target.value)}
                          placeholder="3"
                          className={`${inputClass} pr-5`}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">
                          %
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={addBreakpoint}
            disabled={breakpoints.length >= 3}
            className="text-sm text-emerald-600 hover:text-emerald-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            + Add salary change
          </button>
        </div>

        {/* Spending */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Spending</p>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-600">Monthly spending</label>
            {benchmark && (
              <p className="text-xs text-slate-400">
                Ages {benchmark.bracket} typically spend {formatDollars(benchmark.monthly)}/mo · BLS 2022
              </p>
            )}
            <div className="relative mt-1">
              <DollarSign />
              <input
                type="number"
                value={monthlySpending}
                onChange={(e) => setMonthlySpending(e.target.value)}
                placeholder={benchmark ? String(benchmark.monthly) : '5000'}
                className={`${inputClass} pl-8`}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-600">Lifestyle inflation</label>
            <p className="text-xs text-slate-400">
              Real spending growth above inflation.
              {benchmark ? ' Pre-selected based on your age.' : ''}
            </p>
            <div className="space-y-2">
              {PRESETS.map((preset, i) => (
                <button
                  key={preset.label}
                  onClick={() => { setPresetIndex(i); setUseCustom(false); setUserPickedPreset(true); }}
                  className={`w-full rounded-xl border p-2.5 text-left transition-colors ${
                    !useCustom && presetIndex === i
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">{preset.label}</span>
                    <span className="text-xs text-slate-400">+{preset.rate * 100}%/yr</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 leading-snug">{preset.description}</div>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => { setUseCustom(true); setUserPickedPreset(true); }}
                className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                  useCustom
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
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
                    className="w-24 rounded-lg border border-slate-200 pl-3 pr-7 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                </div>
              )}
            </div>

            {isTargetValid && (
              <p className="text-xs text-slate-400">
                Your spending grows at {(lifestyleRate * 100).toFixed(1)}% per year in real terms (above 3% general inflation).
              </p>
            )}
          </div>
        </div>
        {/* Copy link */}
        <button
          onClick={copyLink}
          className="w-full text-sm py-2 flex items-center justify-center gap-1.5 text-slate-400 hover:text-slate-600 transition-colors"
        >
          {copied ? (
            <>
              <span>✓</span>
              <span>Link copied!</span>
            </>
          ) : (
            <>
              <span>↗</span>
              <span>Copy link to save</span>
            </>
          )}
        </button>
      </div>

      {/* ── Right panel: outputs ─────────────────────────────────────────────── */}
      <div className="space-y-6">

        {/* Gap analysis — narrative at top, then detail */}
        <GapAnalysis
          projections={projections}
          targets={targets}
          age={validAge ? age : null}
        />

        {/* Projection chart + scenario cards */}
        {isCalcValid ? (
          <ProjectionOutputs
            chartData={chartData}
            projections59={projections59}
            projections65={projections65}
            age={age}
          />
        ) : (
          <EmptyState message="Enter your age, current savings, and monthly savings to see your projection." />
        )}

        {/* Retirement target cards */}
        {isTargetValid && (
          <TargetOutputs result59={result59} result65={result65} age={age} />
        )}
      </div>
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-slate-600">{label}</label>}
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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-12 flex items-center justify-center">
      <p className="text-sm text-slate-400 text-center max-w-xs">{message}</p>
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm';
