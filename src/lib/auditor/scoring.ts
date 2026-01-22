import { THRESHOLDS } from '@/lib/constants/thresholds';
import { Issue } from '@/lib/types';

type IssueLike = Pick<Issue, 'severity'>;

export function calculateHealthScore(issues: IssueLike[]): number {
  let score = 100;

  for (const issue of issues) {
    const deduction = THRESHOLDS.severity_deduction[issue.severity] || 0;
    score -= deduction;
  }

  return Math.max(0, Math.min(100, score));
}

export function getHealthStatus(score: number): 'healthy' | 'attention' | 'critical' {
  if (score >= 90) return 'healthy';
  if (score >= 70) return 'attention';
  return 'critical';
}

export function getHealthColor(score: number): string {
  if (score >= 90) return 'green';
  if (score >= 70) return 'yellow';
  return 'red';
}
