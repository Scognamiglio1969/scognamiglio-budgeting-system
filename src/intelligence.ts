import { calculateBudgetTotals, evaluateBudget } from './engine';
import type { BudgetProject, CashFlowEntry, ProjectIntelligence } from './types';

export interface CountryProfile {
  code: string;
  name: string;
  eu: boolean;
  authority: string;
  portalUrl: string;
  structuredSearch: boolean;
}

export const COUNTRY_PROFILES: CountryProfile[] = [
  { code: 'IT', name: 'Italia', eu: true, authority: 'Normattiva / Gazzetta Ufficiale', portalUrl: 'https://www.normattiva.it/', structuredSearch: true },
  { code: 'FR', name: 'Francia', eu: true, authority: 'Légifrance', portalUrl: 'https://www.legifrance.gouv.fr/', structuredSearch: false },
  { code: 'DE', name: 'Germania', eu: true, authority: 'Gesetze im Internet', portalUrl: 'https://www.gesetze-im-internet.de/', structuredSearch: false },
  { code: 'ES', name: 'Spagna', eu: true, authority: 'Boletín Oficial del Estado', portalUrl: 'https://www.boe.es/buscar/', structuredSearch: false },
  { code: 'GB', name: 'Regno Unito', eu: false, authority: 'legislation.gov.uk', portalUrl: 'https://www.legislation.gov.uk/', structuredSearch: false },
  { code: 'US', name: 'Stati Uniti', eu: false, authority: 'Congress.gov / eCFR', portalUrl: 'https://www.ecfr.gov/search', structuredSearch: false },
  { code: 'CA', name: 'Canada', eu: false, authority: 'Justice Laws Website', portalUrl: 'https://laws-lois.justice.gc.ca/', structuredSearch: false },
];

export const DEFAULT_INTELLIGENCE: ProjectIntelligence = {
  jurisdiction: {
    countryCode: 'IT', countryName: 'Italia', region: '', effectiveDate: new Date().toISOString().slice(0, 10),
    euApplicable: true, lastLegalCheckAt: null, lastLegalQuery: '',
  },
  productionEntities: [], cashFlow: [], targetBudget: null, benchmarkOptIn: false,
  productionType: 'film', benchmarkSubmittedAt: null,
  schedule: { startDate: new Date().toISOString().slice(0, 10), prepWeeks: 4, shootDays: 20, wrapWeeks: 2, workDaysPerWeek: 5 },
  departmentRooms: [],
};

export function normalizeIntelligence(value: ProjectIntelligence | undefined): ProjectIntelligence {
  return {
    ...structuredClone(DEFAULT_INTELLIGENCE), ...(value ?? {}),
    jurisdiction: { ...DEFAULT_INTELLIGENCE.jurisdiction, ...(value?.jurisdiction ?? {}) },
    schedule: { ...DEFAULT_INTELLIGENCE.schedule, ...(value?.schedule ?? {}) },
    productionEntities: value?.productionEntities ?? [], cashFlow: value?.cashFlow ?? [],
    departmentRooms: value?.departmentRooms ?? [],
  };
}

export interface HealthFinding {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
}

const daysSince = (date: string) => (Date.now() - new Date(date).getTime()) / 86_400_000;

export function runBudgetHealthCheck(project: BudgetProject): HealthFinding[] {
  const intelligence = project.intelligence ?? DEFAULT_INTELLIGENCE;
  const data = project.scenarios.find((item) => item.id === project.activeScenarioId)?.data ?? project.scenarios[0].data;
  const evaluated = evaluateBudget(data);
  const findings: HealthFinding[] = [];

  const formulaErrors = evaluated.reduce((sum, item) => sum + item.errors.length, 0);
  if (formulaErrors) findings.push({ id: 'formulas', severity: 'critical', title: `${formulaErrors} formule non valide`, detail: 'Il calcolo contiene valori nulli o riferimenti globali mancanti.' });
  if (!intelligence.jurisdiction.countryCode) findings.push({ id: 'country', severity: 'critical', title: 'Paese operativo assente', detail: 'Nessuna verifica normativa è affidabile senza una giurisdizione principale.' });
  if (!intelligence.jurisdiction.lastLegalCheckAt) findings.push({ id: 'legal-check', severity: 'warning', title: 'Verifica normativa mai eseguita', detail: 'Esegui una ricerca e registra la data di controllo prima di approvare il budget.' });
  else if (daysSince(intelligence.jurisdiction.lastLegalCheckAt) > 30) findings.push({ id: 'legal-stale', severity: 'warning', title: 'Verifica normativa scaduta', detail: 'L’ultima verifica ha più di 30 giorni.' });

  const undocumentedFringes = data.fringes.filter((item) => !item.provenance);
  if (undocumentedFringes.length) findings.push({ id: 'fringes-source', severity: 'warning', title: `${undocumentedFringes.length} contributi senza fonte`, detail: 'Aliquota, massimale e decorrenza devono essere collegati a una fonte verificabile.' });
  const undocumentedIncentives = data.incentives.filter((item) => !item.provenance);
  if (undocumentedIncentives.length) findings.push({ id: 'incentives-source', severity: 'critical', title: `${undocumentedIncentives.length} incentivi senza fonte`, detail: 'Non includere crediti fiscali non documentati nel costo netto approvato.' });
  const staleFx = data.exchangeRates.filter((rate) => rate.currency !== project.currency && daysSince(rate.updatedAt) > 30);
  if (staleFx.length) findings.push({ id: 'fx-stale', severity: 'warning', title: `${staleFx.length} cambi da aggiornare`, detail: `Tassi oltre 30 giorni: ${staleFx.map((rate) => rate.currency).join(', ')}.` });
  const shares = intelligence.productionEntities.reduce((sum, entity) => sum + entity.sharePercent, 0);
  if (intelligence.productionEntities.length && Math.abs(shares - 100) > 0.01) findings.push({ id: 'shares', severity: 'critical', title: `Quote di coproduzione al ${shares.toFixed(1)}%`, detail: 'Le quote delle entità devono totalizzare il 100%.' });
  if (intelligence.productionEntities.some((entity) => entity.sharePercent < 0)) findings.push({ id: 'negative-shares', severity: 'critical', title: 'Quote di coproduzione negative', detail: 'Ogni quota deve essere maggiore o uguale a zero.' });
  if (intelligence.schedule.workDaysPerWeek <= 0 || intelligence.schedule.shootDays < 0 || intelligence.schedule.prepWeeks < 0 || intelligence.schedule.wrapWeeks < 0) findings.push({ id: 'schedule-values', severity: 'critical', title: 'Calendario non valido', detail: 'Durate e giorni di lavoro devono essere positivi; i giorni per settimana non possono essere zero.' });
  if (intelligence.cashFlow.some((entry) => entry.amount < 0)) findings.push({ id: 'cash-values', severity: 'critical', title: 'Movimenti di cassa negativi', detail: 'Usa Entrata/Uscita per la direzione e inserisci importi sempre positivi.' });
  if (data.incentives.some((item) => item.rate < 0 || item.rate > 100 || (item.cap !== null && item.cap < 0))) findings.push({ id: 'incentive-values', severity: 'critical', title: 'Parametri fiscali non validi', detail: 'Le aliquote devono essere tra 0 e 100 e i massimali non possono essere negativi.' });
  if (data.items.some((item) => !item.location.trim())) findings.push({ id: 'locations', severity: 'warning', title: 'Location mancanti', detail: 'Le location sono necessarie per territorialità, incentivi e comparazione.' });
  if (!findings.length) findings.push({ id: 'healthy', severity: 'info', title: 'Controlli strutturali superati', detail: 'Non sono emerse anomalie automatiche. Resta necessaria la revisione professionale.' });
  return findings;
}

export function calculateRiskRange(project: BudgetProject) {
  const data = project.scenarios.find((item) => item.id === project.activeScenarioId)?.data ?? project.scenarios[0].data;
  const evaluated = evaluateBudget(data);
  const baseline = calculateBudgetTotals(data, evaluated).net;
  const low = evaluated.reduce((sum, entry) => sum + entry.total * (1 + (entry.item.risk?.lowPercent ?? 0) / 100), 0);
  const high = evaluated.reduce((sum, entry) => sum + entry.total * (1 + (entry.item.risk?.highPercent ?? 0) / 100), 0);
  const incentive = calculateBudgetTotals(data, evaluated).incentive;
  return { baseline, low: low - incentive, high: high - incentive };
}

export function calculateCashFlow(entries: CashFlowEntry[]) {
  const ordered = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let balance = 0;
  let minimumBalance = 0;
  const timeline = ordered.map((entry) => {
    const amount = Math.max(0, Number.isFinite(entry.amount) ? entry.amount : 0);
    balance += entry.type === 'inflow' ? amount : -amount;
    minimumBalance = Math.min(minimumBalance, balance);
    return { ...entry, amount, balance };
  });
  return { timeline, closingBalance: balance, peakFundingNeed: Math.abs(minimumBalance) };
}

export function calculateTargetGap(project: BudgetProject) {
  const data = project.scenarios.find((item) => item.id === project.activeScenarioId)?.data ?? project.scenarios[0].data;
  const actual = calculateBudgetTotals(data).net;
  const target = project.intelligence?.targetBudget ?? null;
  return { actual, target, gap: target === null ? null : actual - target };
}
