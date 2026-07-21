import { calculateBudgetTotals, calculateIncentives, evaluateBudget, sumEvaluated } from './engine';
import { accountItems } from './helpers';
import { calculateCashFlow, calculateRiskRange, normalizeIntelligence, runBudgetHealthCheck } from './intelligence';
import { calculateCoproductionAllocation, calculateScheduleImpact, simulateBudgetRisk } from './innovation';
import type { BudgetProject, BudgetScenario } from './types';

export type ExportFormat = 'xlsx' | 'docx' | 'pdf' | 'pptx';
export type ReportSectionId =
  | 'executive' | 'topsheet' | 'productionPhases' | 'categories' | 'details' | 'fringes' | 'incentives'
  | 'laborPlan'
  | 'globals' | 'currencies' | 'coproduction' | 'schedule' | 'cashflow' | 'risk'
  | 'scenarios' | 'provenance' | 'notes';

export interface ReportSectionDefinition {
  id: ReportSectionId;
  group: 'Sintesi' | 'Budget analitico' | 'Regole e assunzioni' | 'Produzione e controllo';
  label: string;
  description: string;
  recommended: boolean;
  formats: ExportFormat[];
}

export const REPORT_SECTIONS: ReportSectionDefinition[] = [
  { id: 'executive', group: 'Sintesi', label: 'Executive summary', description: 'KPI, costo netto, incentivi e stato del budget', recommended: true, formats: ['xlsx', 'docx', 'pdf', 'pptx'] },
  { id: 'topsheet', group: 'Sintesi', label: 'Topsheet per account', description: 'Macro-voci e incidenza percentuale', recommended: true, formats: ['xlsx', 'docx', 'pdf', 'pptx'] },
  { id: 'productionPhases', group: 'Sintesi', label: 'Fasi di produzione', description: 'Pre-produzione, produzione e post-produzione', recommended: true, formats: ['xlsx', 'docx', 'pdf', 'pptx'] },
  { id: 'categories', group: 'Budget analitico', label: 'Riepilogo categorie', description: 'Sotto-livelli per reparto e categoria', recommended: true, formats: ['xlsx', 'docx', 'pdf', 'pptx'] },
  { id: 'details', group: 'Budget analitico', label: 'Dettaglio completo', description: 'Quantità, unità, tariffe, fringe e location', recommended: true, formats: ['xlsx', 'docx', 'pdf'] },
  { id: 'laborPlan', group: 'Budget analitico', label: 'Piano personale', description: 'Persone, giorni e settimane lavorative per ruolo e reparto', recommended: true, formats: ['xlsx', 'docx', 'pdf'] },
  { id: 'fringes', group: 'Regole e assunzioni', label: 'Fringe e gruppi', description: 'Aliquote, cap e gruppi di applicazione', recommended: true, formats: ['xlsx', 'docx', 'pdf', 'pptx'] },
  { id: 'incentives', group: 'Regole e assunzioni', label: 'Incentivi fiscali', description: 'Eligibilità, base, aliquota e beneficio', recommended: true, formats: ['xlsx', 'docx', 'pdf', 'pptx'] },
  { id: 'globals', group: 'Regole e assunzioni', label: 'Globali', description: 'Variabili utilizzate dalle formule', recommended: true, formats: ['xlsx', 'docx', 'pdf'] },
  { id: 'currencies', group: 'Regole e assunzioni', label: 'Tassi di cambio', description: 'Valute, conversioni e data aggiornamento', recommended: true, formats: ['xlsx', 'docx', 'pdf'] },
  { id: 'coproduction', group: 'Produzione e controllo', label: 'Coproduzione', description: 'Quote, entità e allocazione dei costi', recommended: true, formats: ['xlsx', 'docx', 'pdf', 'pptx'] },
  { id: 'schedule', group: 'Produzione e controllo', label: 'Piano di lavorazione', description: 'Prep, riprese, wrap e impatto economico', recommended: true, formats: ['xlsx', 'docx', 'pdf', 'pptx'] },
  { id: 'cashflow', group: 'Produzione e controllo', label: 'Cash-flow', description: 'Movimenti, saldo progressivo e fabbisogno', recommended: true, formats: ['xlsx', 'docx', 'pdf', 'pptx'] },
  { id: 'risk', group: 'Produzione e controllo', label: 'Rischio e Monte Carlo', description: 'P10, P50, P80, P90 e health check', recommended: true, formats: ['xlsx', 'docx', 'pdf', 'pptx'] },
  { id: 'scenarios', group: 'Produzione e controllo', label: 'Confronto scenari', description: 'Versioni, stato e variazione dal master', recommended: true, formats: ['xlsx', 'docx', 'pdf', 'pptx'] },
  { id: 'provenance', group: 'Regole e assunzioni', label: 'Fonti e provenienza', description: 'Autorità, fonti e date di verifica', recommended: false, formats: ['xlsx', 'docx', 'pdf'] },
  { id: 'notes', group: 'Budget analitico', label: 'Note e anomalie', description: 'Note delle voci ed errori di formula', recommended: false, formats: ['xlsx', 'docx', 'pdf'] },
];

export interface ReportOptions {
  format: ExportFormat;
  sections: ReportSectionId[];
  includeAllScenarios: boolean;
  preparedFor: string;
  reportTitle: string;
  confidentiality: 'Riservato' | 'Uso interno' | 'Bozza';
}

export type ReportCell = string | number;
export interface ReportTable { headers: string[]; rows: ReportCell[][]; widths?: number[] }
export interface ReportSection { id: ReportSectionId; title: string; subtitle: string; metrics?: Array<{ label: string; value: string }>; tables?: ReportTable[]; paragraphs?: string[] }
export interface BudgetReport {
  title: string; subtitle: string; project: BudgetProject; scenario: BudgetScenario; currency: string;
  generatedAt: string; preparedFor: string; confidentiality: string; sections: ReportSection[];
}

const money = (currency: string, value: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
type ProductionPhase = 'Pre-produzione' | 'Produzione' | 'Post-produzione';

function productionPhase(account?: { code: string; name: string } | null): ProductionPhase {
  const value = `${account?.code ?? ''} ${account?.name ?? ''}`.toLowerCase();
  if (/post|editing|editorial|finishing|sound|vfx|music|deliver/.test(value) || Number.parseInt(account?.code ?? '', 10) >= 7000) return 'Post-produzione';
  if (/pre|develop|story|rights|writing|script|casting/.test(value) || Number.parseInt(account?.code ?? '', 10) < 2000) return 'Pre-produzione';
  return 'Produzione';
}

export function buildBudgetReport(project: BudgetProject, scenario: BudgetScenario, options: ReportOptions): BudgetReport {
  const data = scenario.data;
  const evaluated = evaluateBudget(data);
  const totals = calculateBudgetTotals(data, evaluated);
  const incentives = calculateIncentives(data, evaluated);
  const intelligence = normalizeIntelligence(project.intelligence);
  const risk = simulateBudgetRisk(project);
  const riskRange = calculateRiskRange(project);
  const schedule = calculateScheduleImpact(project);
  const cash = calculateCashFlow(intelligence.cashFlow);
  const allocation = calculateCoproductionAllocation(project);
  const health = runBudgetHealthCheck(project);
  const base = project.scenarios.find((item) => item.isBase) ?? project.scenarios[0];
  const baseNet = calculateBudgetTotals(base.data).net;
  const workDaysPerWeek = Math.max(1, intelligence.schedule.workDaysPerWeek);
  const section = (id: ReportSectionId): ReportSection | null => {
    const definition = REPORT_SECTIONS.find((item) => item.id === id)!;
    if (id === 'executive') return { id, title: definition.label, subtitle: `${scenario.name} · ${project.company || 'Produzione'}`, metrics: [
      { label: 'Costo base', value: money(project.currency, totals.base) }, { label: 'Fringe', value: money(project.currency, totals.fringe) },
      { label: 'Incentivi', value: money(project.currency, totals.incentive) }, { label: 'Budget netto', value: money(project.currency, totals.net) },
      { label: 'Voci', value: String(data.items.length) }, { label: 'Anomalie formule', value: String(totals.errors) },
    ], paragraphs: [`Paese operativo: ${intelligence.jurisdiction.countryName}${intelligence.jurisdiction.region ? ` · ${intelligence.jurisdiction.region}` : ''}.`, `Scenario: ${scenario.name} (${scenario.scope}). Aggiornato il ${new Date(project.updatedAt).toLocaleString('it-IT')}.`] };
    if (id === 'topsheet') return { id, title: definition.label, subtitle: 'Macro-voci del preventivo', tables: [{ headers: ['Account', 'Descrizione', 'Base', 'Fringe', 'Totale', '%'], rows: data.accounts.map((account) => { const row = sumEvaluated(accountItems(data, evaluated, account.id)); return [account.code, account.name, row.base, row.fringe, row.total, totals.total ? row.total / totals.total : 0]; }), widths: [12, 32, 16, 16, 16, 10] }], metrics: [{ label: 'Totale lordo', value: money(project.currency, totals.total) }, { label: 'Netto incentivi', value: money(project.currency, totals.net) }] };
    if (id === 'productionPhases') {
      const phases: ProductionPhase[] = ['Pre-produzione', 'Produzione', 'Post-produzione'];
      const rows = phases.map((phase) => {
        const entries = evaluated.filter((entry) => { const category = data.categories.find((item) => item.id === entry.item.categoryId); return productionPhase(data.accounts.find((item) => item.id === category?.accountId)) === phase; });
        return [phase, new Set(entries.map((entry) => entry.item.categoryId)).size, entries.length, entries.reduce((sum, entry) => sum + entry.base, 0), entries.reduce((sum, entry) => sum + entry.fringe, 0), entries.reduce((sum, entry) => sum + entry.total, 0), totals.total ? entries.reduce((sum, entry) => sum + entry.total, 0) / totals.total : 0];
      });
      return { id, title: definition.label, subtitle: 'Distribuzione del preventivo lungo il ciclo produttivo', tables: [{ headers: ['Fase', 'Reparti/categorie', 'Voci', 'Base', 'Fringe', 'Totale', '% budget'], rows }], metrics: rows.map((row) => ({ label: String(row[0]), value: money(project.currency, Number(row[5])) })) };
    }
    if (id === 'categories') return { id, title: definition.label, subtitle: 'Raggruppamento per categoria e fase', tables: [{ headers: ['Fase', 'Account', 'Categoria', 'Descrizione', 'Voci', 'Totale'], rows: data.categories.map((category) => { const account = data.accounts.find((item) => item.id === category.accountId); const entries = evaluated.filter((item) => item.item.categoryId === category.id); return [productionPhase(account), account?.code ?? '', category.code, category.name, entries.length, entries.reduce((sum, item) => sum + item.total, 0)]; }), widths: [18, 12, 14, 38, 10, 18] }] };
    if (id === 'details') return { id, title: definition.label, subtitle: 'Tutte le voci del budget per fase', tables: [{ headers: ['Fase', 'Account', 'Categoria', 'Descrizione', 'Tipo', 'Qtà formula', 'Unità formula', 'Tariffa formula', 'Qtà', 'Unità', 'Tariffa', 'Valuta', 'Location', 'Base', 'Fringe', 'Totale'], rows: evaluated.map((entry) => { const category = data.categories.find((item) => item.id === entry.item.categoryId); const account = data.accounts.find((item) => item.id === category?.accountId); return [productionPhase(account), account?.code ?? '', category?.code ?? '', entry.item.description, entry.item.kind, entry.item.quantity, entry.item.units, entry.item.rate, entry.quantity, entry.units, entry.rate, entry.item.currency, entry.item.location, entry.base, entry.fringe, entry.total]; }), widths: [18, 10, 12, 34, 12, 14, 14, 14, 9, 9, 14, 10, 16, 14, 14, 14] }] };
    if (id === 'laborPlan') {
      const labor = evaluated.filter((entry) => entry.item.kind === 'labor').map((entry) => {
        const category = data.categories.find((item) => item.id === entry.item.categoryId);
        const account = data.accounts.find((item) => item.id === category?.accountId);
        const expression = entry.item.units.toUpperCase();
        const phase = productionPhase(account);
        const period = expression.includes('WEEK') || (phase === 'Post-produzione' && /^\s*[\d.,]+\s*$/.test(expression)) ? 'settimane' : expression.includes('DAY') ? 'giorni' : 'periodi';
        const daysPerPerson = period === 'settimane' ? entry.units * workDaysPerWeek : period === 'giorni' ? entry.units : 0;
        const weeksPerPerson = period === 'settimane' ? entry.units : period === 'giorni' ? entry.units / workDaysPerWeek : 0;
        return { entry, category, account, phase, period, daysPerPerson, weeksPerPerson, people: entry.quantity, personDays: entry.quantity * daysPerPerson };
      });
      const departmentRows = data.accounts.map((account) => {
        const rows = labor.filter((item) => item.account?.id === account.id);
        return [account.code, account.name, rows.length, rows.reduce((sum, item) => sum + item.people, 0), rows.reduce((sum, item) => sum + item.personDays, 0), rows.reduce((sum, item) => sum + item.personDays / workDaysPerWeek, 0), rows.reduce((sum, item) => sum + item.entry.base, 0), rows.reduce((sum, item) => sum + item.entry.fringe, 0), rows.reduce((sum, item) => sum + item.entry.total, 0)] as ReportCell[];
      }).filter((row) => Number(row[2]) > 0);
      const phaseRows = (['Pre-produzione', 'Produzione', 'Post-produzione'] as ProductionPhase[]).map((phase) => {
        const rows = labor.filter((item) => item.phase === phase);
        return [phase, rows.length, rows.reduce((sum, item) => sum + item.people, 0), rows.reduce((sum, item) => sum + item.personDays, 0), rows.reduce((sum, item) => sum + item.personDays / workDaysPerWeek, 0), rows.reduce((sum, item) => sum + item.entry.base, 0), rows.reduce((sum, item) => sum + item.entry.fringe, 0), rows.reduce((sum, item) => sum + item.entry.total, 0)] as ReportCell[];
      });
      return { id, title: definition.label, subtitle: `Dettaglio della forza lavoro · ${workDaysPerWeek} giorni per settimana`, metrics: [{ label: 'Ruoli', value: String(labor.length) }, { label: 'Persone/posizioni', value: new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(labor.reduce((sum, item) => sum + item.people, 0)) }, { label: 'Giornate-persona', value: new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(labor.reduce((sum, item) => sum + item.personDays, 0)) }], tables: [
        { headers: ['Fase', 'Ruoli', 'Persone', 'Giornate-persona', 'Settimane-persona', 'Base', 'Fringe', 'Totale'], rows: phaseRows },
        { headers: ['Codice', 'Fase', 'Reparto', 'Ruoli', 'Persone', 'Giornate-persona', 'Settimane-persona', 'Base', 'Fringe', 'Totale'], rows: departmentRows.map((row) => [row[0], productionPhase(data.accounts.find((account) => account.code === row[0])), ...row.slice(1)]) },
        { headers: ['Fase', 'Reparto', 'Categoria', 'Ruolo / persona', 'Persone', 'Espressione durata', 'Periodo', 'Giorni per persona', 'Settimane per persona', 'Giornate-persona', 'Tariffa per periodo', 'Base per persona', 'Base totale', 'Fringe', 'Totale'], rows: labor.map(({ entry, category, account, phase, period, daysPerPerson, weeksPerPerson, people, personDays }) => [phase, account?.name ?? '', category?.name ?? '', entry.item.description, people, entry.item.units, period, daysPerPerson, weeksPerPerson, personDays, entry.rate, people ? entry.base / people : entry.base, entry.base, entry.fringe, entry.total]) },
      ] };
    }
    if (id === 'fringes') return { id, title: definition.label, subtitle: 'Regole automatiche e massimali', tables: [{ headers: ['Codice', 'Contributo', 'Aliquota', 'Cap', 'Applicabile a'], rows: data.fringes.map((item) => [item.code, item.name, item.rate / 100, item.cap ?? 'Nessun cap', item.kinds.join(', ')]) }, { headers: ['Gruppo', 'Descrizione', 'Regole'], rows: data.groups.map((group) => [group.code, group.name, group.fringeIds.map((ruleId) => data.fringes.find((item) => item.id === ruleId)?.code).filter(Boolean).join(', ')]) }] };
    if (id === 'incentives') return { id, title: definition.label, subtitle: 'Benefici fiscali inclusi nel netto', tables: [{ headers: ['Incentivo', 'Giurisdizione', 'Aliquota', 'Costo eleggibile', 'Beneficio', 'Cap'], rows: incentives.map((entry) => [entry.incentive.name, entry.incentive.jurisdiction, entry.incentive.rate / 100, entry.eligibleCost, entry.amount, entry.incentive.cap ?? 'Nessun cap']) }] };
    if (id === 'globals') return { id, title: definition.label, subtitle: 'Assunzioni usate nelle formule', tables: [{ headers: ['Simbolo', 'Nome', 'Valore', 'Unità', 'Descrizione'], rows: data.globals.map((item) => [item.symbol, item.name, item.value, item.unit, item.description]) }] };
    if (id === 'currencies') return { id, title: definition.label, subtitle: `Conversione verso ${project.currency}`, tables: [{ headers: ['Valuta', 'Nome', `Tasso verso ${project.currency}`, 'Aggiornato'], rows: data.exchangeRates.map((item) => [item.currency, item.name, item.rateToBase, new Date(item.updatedAt).toLocaleDateString('it-IT')]) }] };
    if (id === 'coproduction') return { id, title: definition.label, subtitle: 'Entità e allocazione del budget', tables: [{ headers: ['Entità', 'Paese', 'Valuta', 'Quota', 'Esplicito', 'Condiviso', 'Totale'], rows: allocation.rows.map((row) => [row.entity.name, row.entity.countryCode, row.entity.currency, row.entity.sharePercent / 100, row.explicit, row.shared, row.total]) }], metrics: [{ label: 'Allocato', value: money(project.currency, allocation.allocated) }, { label: 'Non allocato', value: money(project.currency, allocation.unallocated) }] };
    if (id === 'schedule') return { id, title: definition.label, subtitle: 'Calendario e impatto economico', metrics: [{ label: 'Inizio', value: new Date(intelligence.schedule.startDate).toLocaleDateString('it-IT') }, { label: 'Fine prevista', value: new Date(schedule.endDate).toLocaleDateString('it-IT') }, { label: 'Prep', value: `${intelligence.schedule.prepWeeks} settimane` }, { label: 'Riprese', value: `${intelligence.schedule.shootDays} giorni` }, { label: 'Wrap', value: `${intelligence.schedule.wrapWeeks} settimane` }, { label: 'Impatto', value: money(project.currency, schedule.delta) }] };
    if (id === 'cashflow') return { id, title: definition.label, subtitle: 'Fabbisogno finanziario per data', metrics: [{ label: 'Picco fabbisogno', value: money(project.currency, cash.peakFundingNeed) }, { label: 'Saldo finale', value: money(project.currency, cash.closingBalance) }], tables: [{ headers: ['Data', 'Movimento', 'Tipo', 'Stato', 'Importo', 'Saldo'], rows: cash.timeline.map((item) => [new Date(item.date).toLocaleDateString('it-IT'), item.label, item.type === 'inflow' ? 'Entrata' : 'Uscita', item.status, item.amount, item.balance]) }] };
    if (id === 'risk') return { id, title: definition.label, subtitle: 'Range probabilistico e controlli', metrics: [{ label: 'Baseline', value: money(project.currency, riskRange.baseline) }, { label: 'P10', value: money(project.currency, risk.p10) }, { label: 'P50', value: money(project.currency, risk.p50) }, { label: 'P80', value: money(project.currency, risk.p80) }, { label: 'P90', value: money(project.currency, risk.p90) }], tables: [{ headers: ['Severità', 'Controllo', 'Dettaglio'], rows: health.map((item) => [item.severity, item.title, item.detail]) }] };
    if (id === 'scenarios') return { id, title: definition.label, subtitle: 'Confronto con il master', tables: [{ headers: ['Scenario', 'Ambito', 'Stato', 'Voci', 'Netto', 'Delta master'], rows: (options.includeAllScenarios ? project.scenarios : [scenario]).map((item) => { const net = calculateBudgetTotals(item.data).net; return [item.name, item.scope, item.isBase ? 'master' : item.branchStatus ?? 'working', item.data.items.length, net, net - baseNet]; }) }] };
    if (id === 'provenance') return { id, title: definition.label, subtitle: 'Tracciabilità di contributi e incentivi', tables: [{ headers: ['Tipo', 'Regola', 'Autorità', 'Fonte', 'Decorrenza', 'Verificato'], rows: [...data.fringes.map((item) => ['Fringe', item.name, item.provenance?.authority ?? '', item.provenance?.sourceUrl ?? '', item.provenance?.effectiveFrom ?? '', item.provenance?.verifiedAt ? new Date(item.provenance.verifiedAt).toLocaleDateString('it-IT') : '']), ...data.incentives.map((item) => ['Incentivo', item.name, item.provenance?.authority ?? '', item.provenance?.sourceUrl ?? '', item.provenance?.effectiveFrom ?? '', item.provenance?.verifiedAt ? new Date(item.provenance.verifiedAt).toLocaleDateString('it-IT') : ''])] }] };
    if (id === 'notes') return { id, title: definition.label, subtitle: 'Note operative e qualità del dato', tables: [{ headers: ['Voce', 'Location', 'Nota', 'Anomalie'], rows: evaluated.filter((item) => item.item.note || item.errors.length).map((item) => [item.item.description, item.item.location, item.item.note, item.errors.join('; ')]) }] };
    return null;
  };
  return {
    title: options.reportTitle.trim() || `Preventivo · ${project.title}`,
    subtitle: `${scenario.name} · ${project.company || 'Produzione'} · ${project.currency}`,
    project, scenario, currency: project.currency, generatedAt: new Date().toISOString(),
    preparedFor: options.preparedFor.trim(), confidentiality: options.confidentiality,
    sections: options.sections.map(section).filter(Boolean) as ReportSection[],
  };
}

export function formatReportCell(value: ReportCell, header = '') {
  if (typeof value !== 'number') return value;
  if (/quota|aliquota|%/i.test(header)) return pct(value);
  if (/valore|voci|giorni|settimane|tasso|qtà|unità/i.test(header)) return new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(value);
  return money('EUR', value);
}
