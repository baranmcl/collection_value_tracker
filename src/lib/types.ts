export type Condition = 'loose' | 'cib' | 'new';

export const CONDITIONS: readonly Condition[] = ['loose', 'cib', 'new'] as const;

export const CONDITION_LABELS: Record<Condition, string> = {
  loose: 'Loose',
  cib: 'CIB',
  new: 'New'
};

export const GRADES = ['mint', 'near_mint', 'good', 'fair', 'poor'] as const;
export type Grade = (typeof GRADES)[number];

export function isCondition(v: string): v is Condition {
  return (CONDITIONS as readonly string[]).includes(v);
}
