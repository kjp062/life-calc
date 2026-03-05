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
import LifePlanTab from './LifePlanTab';
import { estimateSS, SS_QUICK_CALC_URL } from '../lib/socialSecurity';

const EMPTY_BP: Breakpoint = { age: '', monthlySavings: '', raiseRate: '' };
const OUTLOOK_LABELS = ['Cautious', 'Moderate', 'Optimistic'];

export default function LifeCalculator() {
  // ─── Core inputs ──────────────────────────────────────────────────────────────
  const [currentAge,     setCurrentAge]     = useState('');
  const [currentSavings, setCurrentSavings] = useState('');
  const [monthlySavings, setMonthlySavings] = useState('');
  const [raiseRate,      setRaiseRate]      = useState('3');
  const [breakpoints,    setBreakpoints]    = useState<Breakpoint[]>([]);

  // ─── Retirement target inputs ─────────────────────────────────────────────────
  const [monthlySpending,  setMonthlySpending]  = useState('');
  const [presetIndex,      setPresetIndex]      = useState(1);
  const [useCustom,        setUseCustom]        = useState(false);
  const [customRate,       setCustomRate]       = useState('');
  const [userPickedPreset, setUserPickedPreset] = useState(false);

  // ─── Life plan inputs ─────────────────────────────────────────────────────────
  const [income,       setIncome]       = useState('');
  const [targetRetAge, setTargetRetAge] = useState('65');
  const [rateIndex,    setRateIndex]    = useState(1);

  // ─── Social Security inputs ───────────────────────────────────────────────────
  const [ssEnabled,     setSsEnabled]     = useState(false);
  const [ssCareerStart, setSsCareerStart] = useState('22');
  const [ssClaimAge,    setSsClaimAge]    = useState<62 | 67 | 70>(67);

  // ─── Tax account inputs ───────────────────────────────────────────────────────
  const [preTaxPct,        setPreTaxPct]         = useState('');
  const [rothPct,          setRothPct]           = useState('');
  const [effectiveTaxRate, setEffectiveTaxRate]  = useState('22');
  const [capGainsRate,     setCapGainsRate]      = useState('15');

  // ─── UI state ─────────────────────────────────────────────────────────────────
  const [activeTab,       setActiveTab]       = useState<'life-plan' | 'details'>('life-plan');
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const [scenariosOpen,   setScenariosOpen]   = useState(false);
  const [copied,          setCopied]          = useState(false);
  const [cardCollapsed,   setCardCollapsed]   = useState(false);
  const [mobileInputTab,  setMobileInputTab]  = useState<'situation' | 'assumptions' | 'whatif'>('situation');
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

  // ─── Derived: target age + rate ───────────────────────────────────────────────
  const tgtAgeNum   = parseInt(targetRetAge, 10);
  const validTgtAge = !isNaN(tgtAgeNum) && tgtAgeNum > (validAge ? age : 0) && tgtAgeNum <= 80
    ? tgtAgeNum : 65;
  const selectedRate = RATES[rateIndex].value;

  // ─── Derived: income ──────────────────────────────────────────────────────────
  const incomeNum    = income !== '' && !isNaN(parseFloat(income)) ? parseFloat(income) : null;
  const annualIncome = incomeNum !== null ? incomeNum * 12 : null;

  // ─── Derived: Social Security ─────────────────────────────────────────────────
  const ssResult = ssEnabled && incomeNum !== null && validAge
    ? estimateSS({ currentAge: age, careerStartAge: Number(ssCareerStart) || 22, monthlyGrossIncome: incomeNum })
    : null;
  const ssMonthly = ssResult ? ssResult[`at${ssClaimAge}` as 'at62' | 'at67' | 'at70'] : 0;

  // ─── Derived: tax account multiplier ─────────────────────────────────────────
  const preTaxN  = Number(preTaxPct) || 0;
  const rothN    = Number(rothPct)   || 0;
  const taxableN = Math.max(0, 100 - preTaxN - rothN);
  const hasTaxInfo = preTaxN + rothN + taxableN > 0 && (preTaxN > 0 || taxableN > 0);
  const etr  = (Number(effectiveTaxRate) || 22) / 100;
  const cgr  = (Number(capGainsRate)     || 15) / 100;
  const GAINS_FRACTION = 0.60;
  const afterTaxMultiplier = hasTaxInfo
    ? (preTaxN  / 100) * (1 - etr)
    + (rothN    / 100) * 1.0
    + (taxableN / 100) * (1 - cgr * GAINS_FRACTION)
    : null;

  // ─── Derived: SS-adjusted targets ────────────────────────────────────────────
  const targetsWithSS = useMemo((): {
    at59: { futureReal: number; target: number; ssMonthly: number } | null;
    at65: { futureReal: number; target: number; ssMonthly: number } | null;
  } | null => {
    if (!ssMonthly || !isTargetValid) return null;
    const compute = (retAge: number) => {
      const years = retAge - age;
      if (years <= 0) return null;
      const futureReal = projectSpendingReal(spending, lifestyleRate, years);
      const ssAdjustedSpending = Math.max(0, futureReal - ssMonthly);
      return { futureReal, target: nestEggTarget(ssAdjustedSpending), ssMonthly };
    };
    return { at59: compute(59), at65: compute(validTgtAge) };
  }, [ssMonthly, isTargetValid, age, spending, lifestyleRate, validTgtAge]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select BLS-informed preset
  useEffect(() => {
    if (validAge && !userPickedPreset) setPresetIndex(getDefaultPresetIndex(age));
  }, [age, validAge, userPickedPreset]); // eslint-disable-line react-hooks/exhaustive-deps

  const benchmark = validAge ? getBLSBenchmark(age) : null;

  // ─── URL persistence ──────────────────────────────────────────────────────────
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (!p.size) return;

    const a   = p.get('a');   if (a)   setCurrentAge(a);
    const s   = p.get('s');   if (s)   setCurrentSavings(s);
    const m   = p.get('m');   if (m)   setMonthlySavings(m);
    const r   = p.get('r');   if (r)   setRaiseRate(r);
    const sp  = p.get('sp');  if (sp)  setMonthlySpending(sp);
    const inc = p.get('inc'); if (inc) setIncome(inc);
    const tra = p.get('tra'); if (tra) setTargetRetAge(tra);
    const ri  = p.get('ri');  if (ri)  setRateIndex(Number(ri));

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

    // SS
    const sse  = p.get('sse');  if (sse === '1') setSsEnabled(true);
    const sscs = p.get('sscs'); if (sscs) setSsCareerStart(sscs);
    const ssca = p.get('ssca');
    if (ssca === '62') setSsClaimAge(62);
    else if (ssca === '70') setSsClaimAge(70);

    // Tax
    const ptp  = p.get('ptp');  if (ptp)  setPreTaxPct(ptp);
    const rp   = p.get('rp');   if (rp)   setRothPct(rp);
    const etrP = p.get('etr');  if (etrP) setEffectiveTaxRate(etrP);
    const cgrP = p.get('cgr');  if (cgrP) setCapGainsRate(cgrP);

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

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }

    const p = new URLSearchParams();
    if (currentAge)      p.set('a',  currentAge);
    if (currentSavings)  p.set('s',  currentSavings);
    if (monthlySavings)  p.set('m',  monthlySavings);
    if (raiseRate !== '3') p.set('r', raiseRate);
    if (monthlySpending) p.set('sp', monthlySpending);
    if (income)          p.set('inc', income);
    if (targetRetAge !== '65') p.set('tra', targetRetAge);
    if (rateIndex !== 1)       p.set('ri',  String(rateIndex));
    if (presetIndex !== 1) p.set('pi', String(presetIndex));
    if (useCustom) {
      p.set('cu', '1');
      if (customRate) p.set('cr', customRate);
    }
    // SS
    if (ssEnabled) p.set('sse', '1');
    if (ssCareerStart !== '22') p.set('sscs', ssCareerStart);
    if (ssClaimAge !== 67) p.set('ssca', String(ssClaimAge));
    // Tax
    if (preTaxPct)              p.set('ptp', preTaxPct);
    if (rothPct)                p.set('rp',  rothPct);
    if (effectiveTaxRate !== '22') p.set('etr', effectiveTaxRate);
    if (capGainsRate !== '15')     p.set('cgr', capGainsRate);

    breakpoints.forEach((bp, i) => {
      if (bp.age)            p.set(`b${i + 1}a`, bp.age);
      if (bp.monthlySavings) p.set(`b${i + 1}m`, bp.monthlySavings);
      if (bp.raiseRate)      p.set(`b${i + 1}r`, bp.raiseRate);
    });

    const qs = p.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [currentAge, currentSavings, monthlySavings, raiseRate, monthlySpending, income, targetRetAge, rateIndex, presetIndex, useCustom, customRate, breakpoints, ssEnabled, ssCareerStart, ssClaimAge, preTaxPct, rothPct, effectiveTaxRate, capGainsRate]);

  // ─── Projections ──────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!isCalcValid) return [];
    const endAge = Math.max(validTgtAge + 1, age + 2);
    return Array.from({ length: endAge - age + 1 }, (_, i) => {
      const a = age + i;
      const point: Record<string, number> = { age: a };
      for (const rate of RATES) {
        point[rate.key] = Math.round(portfolioAtAge(age, savings, monthly, raise, breakpoints, rate.value, a));
      }
      return point;
    });
  }, [age, savings, monthly, raise, breakpoints, validTgtAge]); // eslint-disable-line react-hooks/exhaustive-deps

  const projections59 = useMemo((): ScenarioResult[] | null => {
    if (!isCalcValid || age >= 59 || validTgtAge <= 59) return null;
    return RATES.map((rate) => ({ ...rate, amount: portfolioAtAge(age, savings, monthly, raise, breakpoints, rate.value, 59) }));
  }, [age, savings, monthly, raise, breakpoints, validTgtAge]); // eslint-disable-line react-hooks/exhaustive-deps

  const projectionsTarget = useMemo((): ScenarioResult[] | null => {
    if (!isCalcValid || age >= validTgtAge) return null;
    return RATES.map((rate) => ({ ...rate, amount: portfolioAtAge(age, savings, monthly, raise, breakpoints, rate.value, validTgtAge) }));
  }, [age, savings, monthly, raise, breakpoints, validTgtAge]); // eslint-disable-line react-hooks/exhaustive-deps

  const projections: ProjectionResults = { at59: projections59, at65: projectionsTarget };

  // ─── Targets ──────────────────────────────────────────────────────────────────
  const result59 = useMemo((): TargetDetail | null => {
    if (!isTargetValid || age >= 59 || validTgtAge <= 59) return null;
    const futureReal = projectSpendingReal(spending, lifestyleRate, 59 - age);
    return { futureReal, target: nestEggTarget(futureReal) };
  }, [age, spending, lifestyleRate, validTgtAge]); // eslint-disable-line react-hooks/exhaustive-deps

  const resultTarget = useMemo((): TargetDetail | null => {
    if (!isTargetValid || age >= validTgtAge) return null;
    const futureReal = projectSpendingReal(spending, lifestyleRate, validTgtAge - age);
    return { futureReal, target: nestEggTarget(futureReal) };
  }, [age, spending, lifestyleRate, validTgtAge]); // eslint-disable-line react-hooks/exhaustive-deps

  const targets: TargetResults = {
    at59: result59?.target ?? null,
    at65: resultTarget?.target ?? null,
  };

  const gapTargets: TargetResults = targetsWithSS
    ? { at59: targetsWithSS.at59?.target ?? null, at65: targetsWithSS.at65?.target ?? null }
    : targets;

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

  const lifestyleDisplay = useCustom
    ? `${customRate || '0'}%/yr (custom)`
    : `${(PRESETS[presetIndex].rate * 100).toFixed(1)}%/yr · ${PRESETS[presetIndex].label}`;

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Sticky floating input card ──────────────────────────────────────── */}
      <div className="sticky top-0 z-10 -mx-4 px-4 pt-3 pb-2 md:pt-4 md:pb-3 bg-[#f0e6d5]">
        <div className="bg-white rounded-2xl border border-[#d4c4b0] shadow-lg shadow-stone-400/15 p-3 md:p-4 space-y-2 md:space-y-3">
          {/* ── Card header (always visible) ─────────────────────────────── */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCardCollapsed(!cardCollapsed)}
              className="sm:hidden flex-shrink-0 text-stone-400 hover:text-stone-600 transition-colors"
              aria-label={cardCollapsed ? 'Expand inputs' : 'Collapse inputs'}
            >
              <span className={`inline-block transition-transform duration-150 text-[10px] ${cardCollapsed ? '' : 'rotate-90'}`}>▶</span>
            </button>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide flex-1">Your situation</p>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex gap-0.5 sm:gap-1 bg-[#e8d9c5] rounded-xl p-0.5 sm:p-1">
                <button
                  onClick={() => setActiveTab('life-plan')}
                  className={`rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium transition-colors ${
                    activeTab === 'life-plan'
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  Life Plan
                </button>
                <button
                  onClick={() => setActiveTab('details')}
                  className={`rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium transition-colors ${
                    activeTab === 'details'
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  Details
                </button>
              </div>
              <button
                onClick={copyLink}
                className="text-xs text-stone-400 hover:text-stone-600 transition-colors flex items-center gap-1"
              >
                {copied ? (
                  <span className="text-green-600">✓ Saved</span>
                ) : (
                  <span>↗ Share</span>
                )}
              </button>
            </div>
          </div>

          {/* ── Mobile input tab bar ────────────────────────────────────── */}
          {!cardCollapsed && (
            <div className="sm:hidden flex bg-[#e8d9c5] rounded-xl p-0.5">
              {(['situation', 'assumptions', 'whatif'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setMobileInputTab(tab)}
                  className={`flex-1 rounded-lg py-1 text-xs font-medium transition-colors ${
                    mobileInputTab === tab ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  {tab === 'situation' ? 'Situation' : tab === 'assumptions' ? 'Assumptions' : 'What-if'}
                </button>
              ))}
            </div>
          )}

          {/* ── 6-item input grid (2 rows of 3 on desktop) ─────────────────── */}
          <div className={`sm:block ${(!cardCollapsed && mobileInputTab === 'situation') ? '' : 'hidden'}`}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3">
            <Field label="Age">
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

            <Field label="Monthly spending">
              <div className="relative">
                <DollarSign />
                <input
                  type="number"
                  value={monthlySpending}
                  onChange={(e) => setMonthlySpending(e.target.value)}
                  placeholder={benchmark ? String(benchmark.monthly) : '5000'}
                  className={`${inputClass} pl-8`}
                />
              </div>
              {benchmark && (
                <p className="text-xs text-stone-400">
                  Ages {benchmark.bracket} avg {formatDollars(benchmark.monthly)}/mo · BLS 2022
                </p>
              )}
            </Field>

            <Field label="Retire at age">
              <input
                type="number"
                value={targetRetAge}
                onChange={(e) => setTargetRetAge(e.target.value)}
                placeholder="65"
                min={validAge ? age + 1 : 30}
                max={80}
                className={`${inputClass} text-center`}
              />
            </Field>

            <Field label="Monthly gross income">
              <div className="relative">
                <DollarSign />
                <input
                  type="number"
                  value={income}
                  onChange={(e) => setIncome(e.target.value)}
                  placeholder="8000"
                  className={`${inputClass} pl-8`}
                />
              </div>
              {annualIncome !== null ? (
                <p className="text-xs text-stone-400">Annual: {formatDollars(annualIncome)} gross</p>
              ) : (
                <p className="text-xs text-stone-400">Unlocks SS estimate and pay cut</p>
              )}
            </Field>
          </div>
          </div>{/* end input grid wrapper */}

          {/* ── Desktop toggles row ─────────────────────────────────────── */}
          <div className="hidden sm:flex sm:items-center gap-2 border-t border-[#e8d9c5] pt-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setAssumptionsOpen(!assumptionsOpen)}
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1 whitespace-nowrap ${
                  assumptionsOpen
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-stone-300 bg-white text-stone-600 hover:border-stone-400 hover:bg-stone-50'
                }`}
              >
                <span className={`transition-transform duration-150 inline-block text-[10px] ${assumptionsOpen ? 'rotate-90' : ''}`}>▶</span>
                Assumptions
                {!assumptionsOpen && (ssEnabled || hasTaxInfo) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                )}
              </button>

              <button
                onClick={() => setScenariosOpen(!scenariosOpen)}
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1 whitespace-nowrap ${
                  scenariosOpen
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-stone-300 bg-white text-stone-600 hover:border-stone-400 hover:bg-stone-50'
                }`}
              >
                <span className={`transition-transform duration-150 inline-block text-[10px] ${scenariosOpen ? 'rotate-90' : ''}`}>▶</span>
                What-if
                {breakpoints.length > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                    scenariosOpen ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'
                  }`}>
                    {breakpoints.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Disclaimer note */}
          <p className="hidden sm:block text-xs text-stone-400 text-center px-1">
            Excludes emergency funds, liquid savings, and alternative assets (crypto, etc.).
          </p>

          {/* ── Assumptions content ────────────────────────────────────────── */}
          <div className={`${assumptionsOpen ? 'sm:block' : 'sm:hidden'} ${(!cardCollapsed && mobileInputTab === 'assumptions') ? '' : 'hidden'}`}>
            <div className="sm:border-t sm:border-[#e8d9c5] sm:pt-4 space-y-5 max-h-[50vh] sm:max-h-64 overflow-y-auto">

              {/* Return outlook */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-stone-500">Return outlook</label>
                <div className="flex gap-1.5">
                  {RATES.map((rate, i) => (
                    <button
                      key={rate.key}
                      onClick={() => setRateIndex(i)}
                      className={`flex-1 rounded-lg border py-2.5 text-xs font-medium transition-colors leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1 ${
                        rateIndex === i
                          ? 'border-green-600 bg-green-50 text-green-700'
                          : 'border-[#d4c4b0] bg-white text-stone-500 hover:border-[#b8a090]'
                      }`}
                    >
                      <div>{OUTLOOK_LABELS[i]}</div>
                      <div className="font-normal opacity-70">{rate.label} real</div>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-stone-400">Affects projection chart and all dollar amounts</p>
              </div>

              {/* Annual salary raise */}
              <Field label="Annual salary raise">
                <div className="relative">
                  <input
                    type="number"
                    value={raiseRate}
                    onChange={(e) => setRaiseRate(e.target.value)}
                    placeholder="3"
                    className={`${inputClass} pr-7`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm pointer-events-none">
                    %
                  </span>
                </div>
              </Field>

              {/* Social Security estimate */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { if (incomeNum !== null) setSsEnabled(!ssEnabled); }}
                    disabled={incomeNum === null}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${
                      ssEnabled && incomeNum !== null ? 'bg-green-600' : 'bg-stone-300'
                    } ${incomeNum === null ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${ssEnabled && incomeNum !== null ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <span className="text-xs text-stone-500">
                    {incomeNum === null
                      ? 'Social Security — add gross income above to enable'
                      : 'Social Security estimate'}
                  </span>
                  {ssEnabled && ssResult && (
                    <span className="ml-auto text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                      ~{formatDollars(ssMonthly)}/mo at {ssClaimAge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-400">Reduces your retirement target and gap analysis</p>

                {ssEnabled && incomeNum !== null && (
                  <div className="space-y-3 pl-3 border-l-2 border-[#e8d9c5]">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Career started at age">
                        <input
                          type="number"
                          value={ssCareerStart}
                          onChange={(e) => setSsCareerStart(e.target.value)}
                          placeholder="22"
                          className={inputClass}
                        />
                      </Field>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-stone-500">Claim at age</label>
                        <div className="flex gap-1">
                          {([62, 67, 70] as const).map((claimAge) => (
                            <button
                              key={claimAge}
                              onClick={() => setSsClaimAge(claimAge)}
                              className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${
                                ssClaimAge === claimAge
                                  ? 'border-green-600 bg-green-50 text-green-700'
                                  : 'border-[#d4c4b0] bg-white text-stone-500 hover:border-[#b8a090]'
                              }`}
                            >
                              {claimAge}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-stone-400">
                      Estimate based on current income and career length.{' '}
                      <a href={SS_QUICK_CALC_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-stone-600">
                        SSA Quick Calculator
                      </a>
                    </p>
                  </div>
                )}
              </div>

              {/* Account type (tax mix) */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Account type</p>
                <p className="text-xs text-stone-400">Shows after-tax estimates in projection cards</p>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Pre-tax %">
                    <input
                      type="number"
                      value={preTaxPct}
                      onChange={(e) => setPreTaxPct(e.target.value)}
                      placeholder="0"
                      min="0"
                      max="100"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Roth %">
                    <input
                      type="number"
                      value={rothPct}
                      onChange={(e) => setRothPct(e.target.value)}
                      placeholder="0"
                      min="0"
                      max="100"
                      className={inputClass}
                    />
                  </Field>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-stone-500">Taxable</label>
                    <div className={`${inputClass} text-stone-400 cursor-default`}>{taxableN}%</div>
                  </div>
                </div>
                {preTaxN + rothN > 100 && (
                  <p className="text-xs text-red-600">Exceeds 100%</p>
                )}
                {hasTaxInfo && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {preTaxN > 0 && (
                      <Field label="Effective tax rate in retirement">
                        <select
                          value={effectiveTaxRate}
                          onChange={(e) => setEffectiveTaxRate(e.target.value)}
                          className={inputClass}
                        >
                          <option value="12">12%</option>
                          <option value="22">22%</option>
                          <option value="30">30%</option>
                        </select>
                      </Field>
                    )}
                    {taxableN > 0 && (
                      <Field label="Long-term cap gains rate">
                        <select
                          value={capGainsRate}
                          onChange={(e) => setCapGainsRate(e.target.value)}
                          className={inputClass}
                        >
                          <option value="0">0%</option>
                          <option value="15">15%</option>
                          <option value="20">20%</option>
                        </select>
                      </Field>
                    )}
                  </div>
                )}
                {hasTaxInfo && (
                  <p className="text-xs text-stone-400">
                    Taxable estimate assumes ~60% of balance is appreciation (~13 yrs at 7% returns).
                  </p>
                )}
              </div>

              {/* Lifestyle inflation */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-stone-500">Lifestyle inflation</label>
                <p className="text-xs text-stone-400">Affects your retirement spending target</p>
                <p className="text-xs text-stone-400">
                  Real spending growth above inflation.{benchmark ? ' Pre-selected for your age.' : ''}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {PRESETS.map((preset, i) => (
                    <button
                      key={preset.label}
                      onClick={() => { setPresetIndex(i); setUseCustom(false); setUserPickedPreset(true); }}
                      className={`rounded-xl border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1 ${
                        !useCustom && presetIndex === i
                          ? 'border-green-600 bg-green-50 hover:bg-green-100'
                          : 'border-[#d4c4b0] hover:border-[#b8a090] bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-stone-900">{preset.label}</span>
                        <span className="text-xs text-stone-400">+{preset.rate * 100}%/yr</span>
                      </div>
                      <div className="text-xs text-stone-500 mt-0.5 leading-snug">{preset.description}</div>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setUseCustom(true); setUserPickedPreset(true); }}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${
                      useCustom
                        ? 'border-green-600 bg-green-50 text-green-700'
                        : 'border-[#d4c4b0] text-stone-500 hover:border-[#b8a090]'
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
                        className="w-24 rounded-lg border border-[#d4c4b0] bg-[#faf6ef] pl-3 pr-7 py-1.5 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-green-600"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">%</span>
                    </div>
                  )}
                </div>

                {isTargetValid && (
                  <p className="text-xs text-stone-400">
                    Spending grows {(lifestyleRate * 100).toFixed(1)}%/yr in real terms, above 3% general inflation.
                  </p>
                )}
              </div>

            </div>
          </div>

          {/* ── What-if content (breakpoints) ─────────────────────────────── */}
          <div className={`${scenariosOpen ? 'sm:block' : 'sm:hidden'} ${(!cardCollapsed && mobileInputTab === 'whatif') ? '' : 'hidden'}`}>
            <div className="sm:border-t sm:border-[#e8d9c5] sm:pt-4 space-y-2 max-h-[50vh] sm:max-h-64 overflow-y-auto">
              <label className="block text-xs font-medium text-stone-500">Planned change in savings</label>
              {breakpoints.length > 0 && (
                <div className="space-y-3">
                  {breakpoints.map((bp, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-stone-400">Change {i + 1}</p>
                        <button
                          onClick={() => removeBreakpoint(i)}
                          className="text-stone-300 hover:text-stone-500 transition-colors text-lg leading-none"
                        >
                          ×
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <p className="text-xs text-stone-400 mb-1">At age</p>
                          <input
                            type="number"
                            value={bp.age}
                            onChange={(e) => updateBreakpoint(i, 'age', e.target.value)}
                            placeholder="45"
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <p className="text-xs text-stone-400 mb-1">Monthly</p>
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
                          <p className="text-xs text-stone-400 mb-1">Raise</p>
                          <div className="relative">
                            <input
                              type="number"
                              value={bp.raiseRate}
                              onChange={(e) => updateBreakpoint(i, 'raiseRate', e.target.value)}
                              placeholder="3"
                              className={`${inputClass} pr-5`}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 text-xs pointer-events-none">
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
                className="text-xs text-green-600 hover:text-green-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                + Add planned change
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      {activeTab === 'life-plan' ? (
        <LifePlanTab
          age={validAge ? age : 0}
          savings={savings}
          monthly={monthly}
          raiseReal={raise}
          breakpoints={breakpoints}
          monthlySpending={spending}
          lifestyleRate={lifestyleRate}
          income={incomeNum}
          targetRetAge={validTgtAge}
          rate={selectedRate}
          isCalcValid={isCalcValid}
          isTargetValid={isTargetValid}
        />
      ) : (
        <div className="space-y-6">
          <GapAnalysis
            projections={projections}
            targets={gapTargets}
            age={validAge ? age : null}
            targetRetAge={validTgtAge}
            afterTaxMultiplier={afterTaxMultiplier}
            ssActive={!!targetsWithSS}
          />
          {isCalcValid ? (
            <ProjectionOutputs
              chartData={chartData}
              projections59={projections59}
              projections65={projectionsTarget}
              age={age}
              targetRetAge={validTgtAge}
              afterTaxMultiplier={afterTaxMultiplier}
            />
          ) : (
            <EmptyState message="Fill in the panel above to see your projection." />
          )}
          {isTargetValid && (
            <TargetOutputs
              result59={result59}
              result65={resultTarget}
              age={age}
              targetRetAge={validTgtAge}
              ssResult59={targetsWithSS?.at59}
              ssResult65={targetsWithSS?.at65}
              ssClaimAge={ssEnabled ? ssClaimAge : undefined}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1 md:space-y-1.5">
      {label && <label className="block text-xs font-medium text-stone-500">{label}</label>}
      {children}
    </div>
  );
}

function DollarSign() {
  return (
    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm pointer-events-none">
      $
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#d4c4b0] p-10 flex items-center justify-center">
      <p className="text-sm text-stone-400 text-center max-w-xs">{message}</p>
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-[#d4c4b0] bg-[#faf6ef] px-4 py-2.5 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent text-sm';
