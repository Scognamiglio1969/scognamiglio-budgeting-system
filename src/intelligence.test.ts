import { describe, expect, it } from 'vitest';
import { createSeedProject } from './seed';
import { calculateCashFlow, calculateTargetGap, runBudgetHealthCheck } from './intelligence';

describe('budget intelligence', () => {
  it('detects invalid coproduction shares and missing legal review', () => {
    const project = createSeedProject();
    project.intelligence!.productionEntities[0].sharePercent = 60;
    const findings = runBudgetHealthCheck(project);
    expect(findings.some((finding) => finding.id === 'shares')).toBe(true);
    expect(findings.some((finding) => finding.id === 'legal-check')).toBe(true);
  });

  it('flags invalid schedules and fiscal parameters', () => {
    const project = createSeedProject();
    project.intelligence!.schedule.workDaysPerWeek = 0;
    project.scenarios[0].data.incentives[0].rate = 120;
    const ids = runBudgetHealthCheck(project).map((item) => item.id);
    expect(ids).toContain('schedule-values');
    expect(ids).toContain('incentive-values');
  });

  it('calculates chronological cash need', () => {
    const result = calculateCashFlow([
      { id: '2', date: '2026-02-01', label: 'Funding', type: 'inflow', amount: 60, status: 'forecast' },
      { id: '1', date: '2026-01-01', label: 'Deposit', type: 'outflow', amount: 100, status: 'forecast' },
    ]);
    expect(result.peakFundingNeed).toBe(100);
    expect(result.closingBalance).toBe(-40);
  });

  it('does not let negative cash amounts invert their direction', () => {
    const result = calculateCashFlow([{ id: 'bad', date: '2026-01-01', label: 'Invalid', type: 'outflow', amount: -100, status: 'forecast' }]);
    expect(result.closingBalance).toBe(0);
    expect(result.timeline[0].amount).toBe(0);
  });

  it('reports a deterministic target gap', () => {
    const project = createSeedProject();
    expect(calculateTargetGap(project).gap).not.toBeNull();
  });
});
