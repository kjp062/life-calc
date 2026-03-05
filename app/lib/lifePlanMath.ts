import { portfolioAtAge, type Breakpoint } from '../components/Calculator';
import { projectSpendingReal, nestEggTarget } from '../components/RetirementTarget';

export type PathState<T> =
  | { status: 'not_calculable' }
  | { status: 'already_achieved' }
  | { status: 'achievable'; data: T }
  | { status: 'constrained'; data: T; suggestion: string };

// Binary search for minimum monthly savings to hit targetNestEgg at targetRetAge
function minSavingsToHitTarget(
  age: number,
  savings: number,
  raiseReal: number,
  breakpoints: Breakpoint[],
  targetRetAge: number,
  rate: number,
  targetNestEgg: number
): number {
  let lo = 0, hi = 20000;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    portfolioAtAge(age, savings, mid, raiseReal, breakpoints, rate, targetRetAge) >= targetNestEgg
      ? (hi = mid)
      : (lo = mid);
  }
  return hi;
}

export type EarliestRetirementData = {
  retireAge: number;
  yearsAway: number;
};

export function computeEarliestRetirement(
  age: number,
  savings: number,
  monthly: number,
  raiseReal: number,
  breakpoints: Breakpoint[],
  spending: number,
  lifestyleRate: number,
  targetRetAge: number,
  rate: number
): PathState<EarliestRetirementData> {
  for (let retAge = age + 1; retAge <= 80; retAge++) {
    const portfolio = portfolioAtAge(age, savings, monthly, raiseReal, breakpoints, rate, retAge);
    const futureSpending = projectSpendingReal(spending, lifestyleRate, retAge - age);
    const target = nestEggTarget(futureSpending);
    if (portfolio >= target) {
      return {
        status: 'achievable',
        data: { retireAge: retAge, yearsAway: retAge - age },
      };
    }
  }
  return {
    status: 'constrained',
    data: { retireAge: 80, yearsAway: 80 - age },
    suggestion: 'Increasing your savings rate would move this date significantly.',
  };
}

export type CoastFIData = {
  coastAge: number;
  yearsUntilCoast: number;
};

export function computeCoastFI(
  age: number,
  savings: number,
  monthly: number,
  raiseReal: number,
  breakpoints: Breakpoint[],
  spending: number,
  lifestyleRate: number,
  targetRetAge: number,
  rate: number
): PathState<CoastFIData> {
  const targetNestEgg = nestEggTarget(projectSpendingReal(spending, lifestyleRate, targetRetAge - age));

  // Already coasting?
  if (savings * Math.pow(1 + rate, targetRetAge - age) >= targetNestEgg) {
    return { status: 'already_achieved' };
  }

  for (let coastAge = age + 1; coastAge <= targetRetAge; coastAge++) {
    const portfolioAtCoast = portfolioAtAge(age, savings, monthly, raiseReal, breakpoints, rate, coastAge);
    const coasted = portfolioAtCoast * Math.pow(1 + rate, targetRetAge - coastAge);
    if (coasted >= targetNestEgg) {
      return {
        status: 'achievable',
        data: { coastAge, yearsUntilCoast: coastAge - age },
      };
    }
  }

  return {
    status: 'constrained',
    data: { coastAge: targetRetAge, yearsUntilCoast: targetRetAge - age },
    suggestion: 'Growing your savings rate now would accelerate your coast date.',
  };
}

export type SabbaticalData = {
  delta: number;
  portfolioAtTarget: number;
  baselineAtTarget: number;
  safeDuration: number;
};

export function computeSabbatical(
  age: number,
  savings: number,
  monthly: number,
  raiseReal: number,
  breakpoints: Breakpoint[],
  monthlySpending: number,
  lifestyleRate: number,
  sabbaticalMonths: number,
  targetRetAge: number,
  rate: number
): PathState<SabbaticalData> {
  const targetNestEgg = nestEggTarget(projectSpendingReal(monthlySpending, lifestyleRate, targetRetAge - age));
  const baselineAtTarget = portfolioAtAge(age, savings, monthly, raiseReal, breakpoints, rate, targetRetAge);

  const mr = Math.pow(1 + rate, 1 / 12) - 1;

  // Simulate sabbatical: compound portfolio, subtract spending each month (no contributions)
  let portfolioMid = savings;
  for (let m = 0; m < sabbaticalMonths; m++) {
    portfolioMid = portfolioMid * (1 + mr) - monthlySpending;
  }
  portfolioMid = Math.max(0, portfolioMid);

  // Post-sabbatical: resume normal savings from fractional start age
  // Use original breakpoints — they filter by age, so they apply correctly from startAge
  const startAge = age + sabbaticalMonths / 12;
  const portfolioAtTarget = startAge >= targetRetAge
    ? portfolioMid
    : portfolioAtAge(startAge, portfolioMid, monthly, raiseReal, breakpoints, rate, targetRetAge);

  const delta = baselineAtTarget - portfolioAtTarget;

  // Find max safe duration where postAtTarget >= targetNestEgg
  let safeDuration = 0;
  for (let m = 1; m <= 36; m++) {
    let pMid = savings;
    for (let k = 0; k < m; k++) {
      pMid = pMid * (1 + mr) - monthlySpending;
    }
    pMid = Math.max(0, pMid);
    const testStartAge = age + m / 12;
    const testAtTarget = testStartAge >= targetRetAge
      ? pMid
      : portfolioAtAge(testStartAge, pMid, monthly, raiseReal, breakpoints, rate, targetRetAge);
    if (testAtTarget >= targetNestEgg) {
      safeDuration = m;
    }
  }

  if (portfolioAtTarget >= targetNestEgg) {
    return {
      status: 'achievable',
      data: { delta, portfolioAtTarget, baselineAtTarget, safeDuration },
    };
  }

  return {
    status: 'constrained',
    data: { delta, portfolioAtTarget, baselineAtTarget, safeDuration },
    suggestion: safeDuration > 0
      ? `A ${safeDuration}-month break keeps you on track.`
      : 'Focus on building your base savings before taking a break.',
  };
}

export type SavingsReductionData = {
  minSavings: number;
  reduction: number;
  reductionPct: number;
};

export function computeSavingsReduction(
  age: number,
  savings: number,
  monthly: number,
  raiseReal: number,
  breakpoints: Breakpoint[],
  spending: number,
  lifestyleRate: number,
  targetRetAge: number,
  rate: number
): PathState<SavingsReductionData> {
  const targetNestEgg = nestEggTarget(projectSpendingReal(spending, lifestyleRate, targetRetAge - age));
  const minSavings = minSavingsToHitTarget(age, savings, raiseReal, breakpoints, targetRetAge, rate, targetNestEgg);
  const reduction = monthly - minSavings;

  if (reduction <= 0) {
    return {
      status: 'constrained',
      data: { minSavings, reduction: 0, reductionPct: 0 },
      suggestion: 'You are already saving at the minimum needed to reach your goal.',
    };
  }

  return {
    status: 'achievable',
    data: { minSavings, reduction, reductionPct: reduction / monthly },
  };
}

export type PayCutData = {
  maxPayCutDollars: number;
  maxPayCutPct: number;
  minIncome: number;
};

export function computePayCut(
  age: number,
  savings: number,
  monthly: number,
  raiseReal: number,
  breakpoints: Breakpoint[],
  spending: number,
  lifestyleRate: number,
  income: number,
  targetRetAge: number,
  rate: number
): PathState<PayCutData> {
  const targetNestEgg = nestEggTarget(projectSpendingReal(spending, lifestyleRate, targetRetAge - age));
  const minSavings = minSavingsToHitTarget(age, savings, raiseReal, breakpoints, targetRetAge, rate, targetNestEgg);
  const minIncome = minSavings + spending;
  const maxPayCutDollars = income - minIncome;

  if (maxPayCutDollars <= 0) {
    return {
      status: 'constrained',
      data: { maxPayCutDollars: 0, maxPayCutPct: 0, minIncome },
      suggestion: 'Your current income is already at or below the minimum needed to stay on track.',
    };
  }

  return {
    status: 'achievable',
    data: {
      maxPayCutDollars,
      maxPayCutPct: maxPayCutDollars / income,
      minIncome,
    },
  };
}
