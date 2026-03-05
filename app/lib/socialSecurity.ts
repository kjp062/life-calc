export const SS_QUICK_CALC_URL = 'https://www.ssa.gov/oact/quickcalc/';

export interface SSEstimate {
  pia: number;
  at62: number;
  at67: number;
  at70: number;
}

export function estimateSS({
  currentAge,
  careerStartAge,
  monthlyGrossIncome,
}: {
  currentAge: number;
  careerStartAge: number;
  monthlyGrossIncome: number;
}): SSEstimate {
  const WAGE_BASE = 176100;
  const annualIncome = Math.min(monthlyGrossIncome * 12, WAGE_BASE);

  // Always divide AIME by 35 (SSA rule)
  const totalYearsAtFRA = Math.min(67 - careerStartAge, 35);
  const careerYearsWorked = Math.max(0, currentAge - careerStartAge);
  const pastYearsUsed = Math.min(careerYearsWorked, totalYearsAtFRA);
  const futureYearsUsed = totalYearsAtFRA - pastYearsUsed;

  // Linear ramp: past earnings averaged at 75% of current (50%→100% midpoint)
  const totalEarnings = pastYearsUsed * annualIncome * 0.75 + futureYearsUsed * annualIncome;
  const AIME = totalEarnings / 35 / 12;

  // 2025 bend points
  const pia =
    0.90 * Math.min(AIME, 1226) +
    0.32 * Math.max(0, Math.min(AIME - 1226, 7391 - 1226)) +
    0.15 * Math.max(0, AIME - 7391);

  return {
    pia:  Math.round(pia),
    at62: Math.round(pia * 0.70),
    at67: Math.round(pia),
    at70: Math.round(pia * 1.24),
  };
}
