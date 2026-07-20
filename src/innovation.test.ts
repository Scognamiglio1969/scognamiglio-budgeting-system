import { describe, expect, it } from 'vitest';
import { createSeedProject } from './seed';
import { calculateBudgetTotals } from './engine';
import { applyPrudentRiskProfile, applyScheduleToData, applyTargetBudgetPlan, applyTaxOptimizationPlan, buildAnonymousBenchmark, calculateCoproductionAllocation, calculateScheduleImpact, simulateBudgetRisk, solveTargetBudget } from './innovation';

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

  it('applies the tax plan and produces the advertised optimized total', () => {
    const project = createSeedProject();
    project.scenarios[0].data.items[0].location = 'Remote';
    const receipt = applyTaxOptimizationPlan(project);
    expect(receipt.applied).toBeGreaterThan(0);
    expect(receipt.after).toBeLessThan(receipt.before);
    expect(calculateBudgetTotals(project.scenarios[0].data).net).toBeCloseTo(receipt.after, 2);
  });

  it('applies a feasible target plan to the actual line-item formulas', () => {
    const project = createSeedProject();
    project.intelligence!.targetBudget = calculateBudgetTotals(project.scenarios[0].data).net - 5000;
    const receipt = applyTargetBudgetPlan(project);
    expect(receipt.applied).toBeGreaterThan(0);
    expect(receipt.after).toBeLessThan(receipt.before);
  });

  it('creates missing schedule globals and applies the prudent risk profile', () => {
    const project = createSeedProject();
    project.scenarios[0].data.globals = [];
    const applied = applyScheduleToData(project.scenarios[0].data, project);
    expect(applied.map((item) => item.symbol)).toEqual(['SHOOT_DAYS', 'PREP_WEEKS', 'DAYS_WEEK']);
    expect(project.scenarios[0].data.globals).toHaveLength(3);
    expect(applyPrudentRiskProfile(project)).toBe(project.scenarios[0].data.items.length);
    expect(project.scenarios[0].data.items.every((item) => item.risk?.highPercent)).toBe(true);
  });

  it('keeps schedule calculations valid with invalid user inputs', () => {
    const project = createSeedProject();
    project.intelligence!.schedule.workDaysPerWeek = 0;
    project.intelligence!.schedule.shootDays = -5;
    const result = calculateScheduleImpact(project);
    expect(Number.isFinite(result.calendarDays)).toBe(true);
    expect(result.calendarDays).toBeGreaterThanOrEqual(0);
  });

  it('builds only coarse anonymous metrics', () => {
    const benchmark = buildAnonymousBenchmark(createSeedProject());
    expect(benchmark).not.toHaveProperty('projectId');
    expect(benchmark).not.toHaveProperty('title');
    expect(benchmark.accountShares.length).toBeGreaterThan(0);
  });
});
