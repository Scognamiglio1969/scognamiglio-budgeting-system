import { describe, expect, it } from 'vitest';
import { createSeedProject } from './seed';
import { buildAnonymousBenchmark, calculateCoproductionAllocation, calculateScheduleImpact, simulateBudgetRisk, solveTargetBudget } from './innovation';

describe('innovation engines', () => {
  it('allocates the full budget across coproducers', () => {
    const result = calculateCoproductionAllocation(createSeedProject());
    expect(result.unallocated).toBeCloseTo(0, 2);
    expect(result.rows).toHaveLength(2);
  });

  it('produces deterministic ordered Monte Carlo percentiles', () => {
    const result = simulateBudgetRisk(createSeedProject(), 500, 42);
    expect(result.p10).toBeLessThanOrEqual(result.p50);
    expect(result.p50).toBeLessThanOrEqual(result.p90);
    expect(simulateBudgetRisk(createSeedProject(), 500, 42).p90).toBe(result.p90);
  });

  it('solves only the required target gap', () => {
    const project = createSeedProject();
    project.intelligence!.targetBudget = 270000;
    const result = solveTargetBudget(project);
    expect(result.suggestions.reduce((sum, item) => sum + item.saving, 0)).toBeCloseTo(result.required - result.remaining, 2);
  });

  it('links schedule changes to formula totals', () => {
    const project = createSeedProject();
    project.intelligence!.schedule.shootDays = 30;
    expect(calculateScheduleImpact(project).delta).toBeGreaterThan(0);
  });

  it('builds only coarse anonymous metrics', () => {
    const benchmark = buildAnonymousBenchmark(createSeedProject());
    expect(benchmark).not.toHaveProperty('projectId');
    expect(benchmark).not.toHaveProperty('title');
    expect(benchmark.accountShares.length).toBeGreaterThan(0);
  });
});
