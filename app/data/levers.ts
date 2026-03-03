import raw from './levers.json';

export type LeverImpact = 'high' | 'medium' | 'low';
export type LeverEffort = 'high' | 'medium' | 'low';

export interface Lever {
  id: string;
  label: string;
  detail: string;
  impact: LeverImpact;
  effort: LeverEffort;
}

export interface AgeLeverSet {
  headline: string;
  levers: Lever[];
}

export type AgeRange = '20s' | '30s' | '40s' | '50s' | '60+';
export type LeverTier = 'ahead' | 'on-track' | 'slightly-behind' | 'behind';

const data = raw as { tiers: Record<LeverTier, Record<AgeRange, AgeLeverSet>> };

export function getAgeRange(age: number): AgeRange {
  if (age < 30) return '20s';
  if (age < 40) return '30s';
  if (age < 50) return '40s';
  if (age < 60) return '50s';
  return '60+';
}

export function getLeverSet(tier: LeverTier, age: number): AgeLeverSet {
  const ageRange = getAgeRange(age);
  return data.tiers[tier][ageRange];
}
