import { normalizeIntelligence } from './intelligence';
import type { BudgetProject } from './types';

export const OPEN_SBS_FORMAT = 'open-sbs-budget' as const;
export const OPEN_SBS_SCHEMA_VERSION = '2.0.0' as const;

export interface OpenSbsEnvelope {
  format: typeof OPEN_SBS_FORMAT;
  schemaVersion: typeof OPEN_SBS_SCHEMA_VERSION;
  exportedAt: string;
  generator: { name: 'Scognamiglio Budgeting System'; version: string };
  project: BudgetProject;
}

function isProject(value: unknown): value is BudgetProject {
  if (!value || typeof value !== 'object') return false;
  const project = value as Partial<BudgetProject>;
  return typeof project.id === 'string' && typeof project.title === 'string' && typeof project.currency === 'string' &&
    Array.isArray(project.scenarios) && project.scenarios.length > 0 && project.scenarios.every((scenario) =>
      scenario && typeof scenario.id === 'string' && scenario.data && Array.isArray(scenario.data.accounts) &&
      Array.isArray(scenario.data.categories) && Array.isArray(scenario.data.items) && Array.isArray(scenario.data.globals));
}

export function migrateOpenSbsProject(project: BudgetProject): BudgetProject {
  const migrated = structuredClone(project);
  migrated.intelligence = normalizeIntelligence(migrated.intelligence);
  migrated.changeLog ??= [];
  migrated.libraries ??= [];
  migrated.scenarios.forEach((scenario) => {
    scenario.branchStatus ??= scenario.isBase ? 'merged' : 'working';
    scenario.mergedAt ??= scenario.isBase ? scenario.createdAt : null;
    scenario.data.exchangeRates ??= [{ id: 'fx-base', currency: migrated.currency, name: migrated.currency, rateToBase: 1, updatedAt: new Date().toISOString() }];
    scenario.data.incentives ??= [];
    scenario.data.fringes ??= [];
    scenario.data.groups ??= [];
  });
  if (!migrated.scenarios.some((scenario) => scenario.id === migrated.activeScenarioId)) migrated.activeScenarioId = migrated.scenarios[0].id;
  return migrated;
}

export function createOpenSbsEnvelope(project: BudgetProject): OpenSbsEnvelope {
  return { format: OPEN_SBS_FORMAT, schemaVersion: OPEN_SBS_SCHEMA_VERSION, exportedAt: new Date().toISOString(), generator: { name: 'Scognamiglio Budgeting System', version: '2.0' }, project: migrateOpenSbsProject(project) };
}

export function parseOpenSbsProject(value: unknown): BudgetProject {
  if (value && typeof value === 'object' && (value as Partial<OpenSbsEnvelope>).format === OPEN_SBS_FORMAT) {
    const envelope = value as Partial<OpenSbsEnvelope>;
    if (envelope.schemaVersion !== OPEN_SBS_SCHEMA_VERSION) throw new Error(`Versione Open SBS non supportata: ${envelope.schemaVersion ?? 'assente'}`);
    if (!isProject(envelope.project)) throw new Error('Progetto Open SBS non valido');
    return migrateOpenSbsProject(envelope.project);
  }
  if (!isProject(value)) throw new Error('Struttura budget non riconosciuta');
  return migrateOpenSbsProject(value);
}

export function serializeOpenSbs(project: BudgetProject) {
  return JSON.stringify(createOpenSbsEnvelope(project), null, 2);
}
