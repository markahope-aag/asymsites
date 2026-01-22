import { describe, it, expect } from 'vitest';
import { calculateHealthScore, getHealthStatus } from '@/lib/auditor/scoring';

describe('calculateHealthScore', () => {
  it('returns 100 for no issues', () => {
    expect(calculateHealthScore([])).toBe(100);
  });

  it('deducts 15 for critical issues', () => {
    expect(calculateHealthScore([{ severity: 'critical' }])).toBe(85);
  });

  it('deducts 5 for warning issues', () => {
    expect(calculateHealthScore([{ severity: 'warning' }])).toBe(95);
  });

  it('deducts 1 for info issues', () => {
    expect(calculateHealthScore([{ severity: 'info' }])).toBe(99);
  });

  it('handles multiple issues', () => {
    const issues = [
      { severity: 'critical' as const },
      { severity: 'critical' as const },
      { severity: 'warning' as const },
      { severity: 'info' as const },
    ];
    expect(calculateHealthScore(issues)).toBe(100 - 15 - 15 - 5 - 1);
  });

  it('never goes below 0', () => {
    const issues = Array(10).fill({ severity: 'critical' as const });
    expect(calculateHealthScore(issues)).toBe(0);
  });
});

describe('getHealthStatus', () => {
  it('returns healthy for 90+', () => {
    expect(getHealthStatus(90)).toBe('healthy');
    expect(getHealthStatus(100)).toBe('healthy');
  });

  it('returns attention for 70-89', () => {
    expect(getHealthStatus(70)).toBe('attention');
    expect(getHealthStatus(89)).toBe('attention');
  });

  it('returns critical for below 70', () => {
    expect(getHealthStatus(69)).toBe('critical');
    expect(getHealthStatus(0)).toBe('critical');
  });
});
