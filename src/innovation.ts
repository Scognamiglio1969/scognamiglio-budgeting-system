import { calculateBudgetTotals, evaluateBudget } from './engine';
import { normalizeIntelligence } from './intelligence';
import type { BudgetData, BudgetProject, LineItem, ProductionEntity } from './types';

const activeData = (project: BudgetProject) => project.scenarios.find((item) => item.id === project.activeScenarioId)?.data ?? project.scenarios[0].data;
const defaultFlexibility = (item: LineItem) => Math.min(100, Math.max(0, item.flexibilityPercent ?? ({ labor: 5, equipment: 15, travel: 12, other: 10 }[item.kind])));

export function calculateCoproductionAllocation(project: BudgetProject) {
  const intelligence = normalizeIntelligence(project.intelligence);
  const entries = evaluateBudget(activeData(project));
  const entities = intelligence.productionEntities;
  const totalShares = entities.reduce((sum, entity) => sum + Math.max(0, entity.sharePercent), 0) || 100;
  const rows = entities.map((entity) => {
    let explicit = 0;
    let shared = 0;
    entries.forEach((entry) => {
      if (entry.item.entityId === entity.id) explicit += entry.total;
      else if (!entry.item.entityId) shared += entry.total * Math.max(0, entity.sharePercent) / totalShares;
    });
    return { entity, explicit, shared, total: explicit + shared };
  });
  const allocated = rows.reduce((sum, row) => sum + row.total, 0);
  return { rows, allocated, unallocated: Math.max(0, entries.reduce((sum, entry) => sum + entry.total, 0) - allocated) };
}

export interface TaxOptimizationSuggestion { itemId: string; description: string; from: string; to: string; saving: number }

export function optimizeTaxCredits(project: BudgetProject) {
  const data = activeData(project);
  const currentNet = calculateBudgetTotals(data).net;
  const locations = [...new Set(data.incentives.flatMap((item) => item.locations))];
  const suggestions: TaxOptimizationSuggestion[] = [];
  for (const item of data.items) {
    let best = { location: item.location, net: currentNet };
    for (const location of locations) {
      if (location === item.location) continue;
      const candidate = structuredClone(data);
      const target = candidate.items.find((value) => value.id === item.id)!;
      target.location = location;
      const net = calculateBudgetTotals(candidate).net;
      if (net < best.net) best = { location, net };
    }
    if (best.location !== item.location && currentNet - best.net > 0.01) suggestions.push({ itemId: item.id, description: item.description, from: item.location, to: best.location, saving: currentNet - best.net });
  }
  suggestions.sort((a, b) => b.saving - a.saving);
  const optimized = structuredClone(data);
  suggestions.forEach((suggestion) => { const item = optimized.items.find((value) => value.id === suggestion.itemId); if (item) item.location = suggestion.to; });
  const optimizedNet = calculateBudgetTotals(optimized).net;
  return { currentNet, optimizedNet, potentialSaving: Math.max(0, currentNet - optimizedNet), suggestions };
}

export function applyTaxOptimizationPlan(project: BudgetProject) {
  const plan = optimizeTaxCredits(project);
  const data = activeData(project);
  let applied = 0;
  plan.suggestions.forEach((suggestion) => {
    const item = data.items.find((value) => value.id === suggestion.itemId);
    if (item && item.location !== suggestion.to) { item.location = suggestion.to; applied += 1; }
  });
  return { applied, before: plan.currentNet, after: calculateBudgetTotals(data).net };
}

function mulberry32(seed: number) {
  return () => { let value = seed += 0x6D2B79F5; value = Math.imul(value ^ value >>> 15, value | 1); value ^= value + Math.imul(value ^ value >>> 7, value | 61); return ((value ^ value >>> 14) >>> 0) / 4294967296; };
}

function triangular(random: () => number, minimum: number, mode: number, maximum: number) {
  if (maximum <= minimum) return mode;
  const value = random();
  const split = (mode - minimum) / (maximum - minimum);
  return value < split
    ? minimum + Math.sqrt(value * (maximum - minimum) * (mode - minimum))
    : maximum - Math.sqrt((1 - value) * (maximum - minimum) * (maximum - mode));
}

const percentile = (sorted: number[], value: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(value * sorted.length) - 1))];

export function simulateBudgetRisk(project: BudgetProject, iterations = 2000, seed = 1969) {
  iterations = Math.min(100_000, Math.max(100, Math.round(iterations)));
  const data = activeData(project);
  const entries = evaluateBudget(data);
  const incentive = calculateBudgetTotals(data, entries).incentive;
  const random = mulberry32(seed);
  const samples = Array.from({ length: iterations }, () => entries.reduce((sum, entry) => {
    const low = 1 + (entry.item.risk?.lowPercent ?? 0) / 100;
    const high = 1 + (entry.item.risk?.highPercent ?? defaultFlexibility(entry.item)) / 100;
    return sum + entry.total * triangular(random, Math.min(low, 1), 1, Math.max(high, 1));
  }, -incentive)).sort((a, b) => a - b);
  const target = normalizeIntelligence(project.intelligence).targetBudget;
  const withinTarget = target === null ? null : samples.filter((value) => value <= target).length / samples.length;
  return { iterations, p10: percentile(samples, .1), p50: percentile(samples, .5), p80: percentile(samples, .8), p90: percentile(samples, .9), minimum: samples[0], maximum: samples.at(-1)!, withinTarget };
}

export function solveTargetBudget(project: BudgetProject) {
  const data = activeData(project);
  const intelligence = normalizeIntelligence(project.intelligence);
  const actual = calculateBudgetTotals(data).net;
  const target = intelligence.targetBudget;
  const required = target === null ? 0 : Math.max(0, actual - target);
  let remaining = required;
  const suggestions = evaluateBudget(data).map((entry) => ({
    itemId: entry.item.id, description: entry.item.description, available: entry.total * defaultFlexibility(entry.item) / 100,
    flexibilityPercent: defaultFlexibility(entry.item), kind: entry.item.kind,
  })).sort((a, b) => b.available - a.available).map((entry) => {
    const saving = Math.min(remaining, entry.available);
    remaining -= saving;
    return { ...entry, saving, appliedPercent: entry.available ? entry.flexibilityPercent * saving / entry.available : 0 };
  }).filter((entry) => entry.saving > 0);
  return { actual, target, required, remaining, feasible: remaining < .01, suggestions };
}

export function applyTargetBudgetPlan(project: BudgetProject) {
  const plan = solveTargetBudget(project);
  const data = activeData(project);
  let applied = 0;
  if (!plan.feasible) return { applied, before: plan.actual, after: plan.actual };
  plan.suggestions.forEach((suggestion) => {
    const item = data.items.find((value) => value.id === suggestion.itemId);
    if (item) {
      item.multiplier = `(${item.multiplier}) * ${(1 - suggestion.appliedPercent / 100).toFixed(6)}`;
      applied += 1;
    }
  });
  return { applied, before: plan.actual, after: calculateBudgetTotals(data).net };
}

export function applyPrudentRiskProfile(project: BudgetProject) {
  const data = activeData(project);
  data.items.forEach((item) => {
    item.risk = { lowPercent: 0, highPercent: item.kind === 'travel' ? 15 : item.kind === 'equipment' ? 10 : 6 };
  });
  return data.items.length;
}

export function calculateScheduleImpact(project: BudgetProject) {
  const data = activeData(project);
  const schedule = normalizeIntelligence(project.intelligence).schedule;
  const prepWeeks = Math.max(0, Number.isFinite(schedule.prepWeeks) ? schedule.prepWeeks : 0);
  const shootDays = Math.max(0, Number.isFinite(schedule.shootDays) ? schedule.shootDays : 0);
  const wrapWeeks = Math.max(0, Number.isFinite(schedule.wrapWeeks) ? schedule.wrapWeeks : 0);
  const workDaysPerWeek = Math.max(1, Number.isFinite(schedule.workDaysPerWeek) ? schedule.workDaysPerWeek : 1);
  const proposed = structuredClone(data);
  const setGlobal = (symbol: string, value: number) => { const global = proposed.globals.find((item) => item.symbol === symbol); if (global) global.value = value; };
  setGlobal('SHOOT_DAYS', shootDays);
  setGlobal('PREP_WEEKS', prepWeeks);
  setGlobal('DAYS_WEEK', workDaysPerWeek);
  const current = calculateBudgetTotals(data).net;
  const scheduled = calculateBudgetTotals(proposed).net;
  const calendarDays = Math.ceil(prepWeeks * 7 + shootDays / workDaysPerWeek * 7 + wrapWeeks * 7);
  const parsedStart = new Date(schedule.startDate);
  const endDate = Number.isNaN(parsedStart.getTime()) ? new Date() : parsedStart;
  endDate.setDate(endDate.getDate() + calendarDays);
  return { current, scheduled, delta: scheduled - current, calendarDays, endDate: endDate.toISOString().slice(0, 10), proposedData: proposed };
}

export function buildAnonymousBenchmark(project: BudgetProject) {
  const data = activeData(project);
  const entries = evaluateBudget(data);
  const totals = calculateBudgetTotals(data, entries);
  const intelligence = normalizeIntelligence(project.intelligence);
  const byKind = (kind: LineItem['kind']) => entries.filter((entry) => entry.item.kind === kind).reduce((sum, entry) => sum + entry.total, 0);
  const shootDays = Math.max(1, intelligence.schedule.shootDays);
  return {
    countryCode: intelligence.jurisdiction.countryCode,
    productionType: intelligence.productionType,
    budgetBand: totals.net < 500_000 ? 'micro' : totals.net < 2_000_000 ? 'small' : totals.net < 10_000_000 ? 'medium' : 'large',
    costPerShootDay: Math.round(totals.net / shootDays),
    laborShare: totals.total ? byKind('labor') / totals.total : 0,
    equipmentShare: totals.total ? byKind('equipment') / totals.total : 0,
    fringeShare: totals.total ? totals.fringe / totals.total : 0,
    incentiveShare: totals.total ? totals.incentive / totals.total : 0,
    accountShares: data.accounts.map((account) => {
      const categoryIds = new Set(data.categories.filter((category) => category.accountId === account.id).map((category) => category.id));
      const amount = entries.filter((entry) => categoryIds.has(entry.item.categoryId)).reduce((sum, entry) => sum + entry.total, 0);
      return { code: account.code, share: totals.total ? amount / totals.total : 0 };
    }),
  };
}

export function applyScheduleToData(target: BudgetData, project: BudgetProject) {
  const schedule = normalizeIntelligence(project.intelligence).schedule;
  const values = [
    { symbol: 'SHOOT_DAYS', name: 'Shooting days', value: Math.max(0, Number.isFinite(schedule.shootDays) ? schedule.shootDays : 0), unit: 'days', description: 'Principal photography days' },
    { symbol: 'PREP_WEEKS', name: 'Prep weeks', value: Math.max(0, Number.isFinite(schedule.prepWeeks) ? schedule.prepWeeks : 0), unit: 'weeks', description: 'Standard department preparation' },
    { symbol: 'DAYS_WEEK', name: 'Working week', value: Math.max(1, Number.isFinite(schedule.workDaysPerWeek) ? schedule.workDaysPerWeek : 1), unit: 'days', description: 'Paid days in a standard week' },
  ];
  values.forEach((next) => {
    const existing = target.globals.find((item) => item.symbol === next.symbol);
    if (existing) existing.value = next.value;
    else target.globals.push({ id: `global-${next.symbol.toLowerCase()}-${Date.now()}`, ...next });
  });
  return values;
}

export function entityLabel(entities: ProductionEntity[], id?: string | null) {
  return entities.find((entity) => entity.id === id)?.name ?? 'Ripartizione per quota';
}
