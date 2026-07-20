import { useMemo, useState } from 'react';
import {
  BarChart3, CalendarDays, Coins, GitBranch, Landmark, Plus, Send, SlidersHorizontal,
  Trash2, TrendingDown, UsersRound, WalletCards,
} from 'lucide-react';
import { submitAnonymousBenchmark, type BenchmarkAggregate } from '../cloud';
import { calculateCashFlow, normalizeIntelligence } from '../intelligence';
import {
  applyPrudentRiskProfile, applyScheduleToData, applyTargetBudgetPlan, applyTaxOptimizationPlan,
  buildAnonymousBenchmark, calculateCoproductionAllocation, calculateScheduleImpact, optimizeTaxCredits,
  simulateBudgetRisk, solveTargetBudget,
} from '../innovation';
import type { BudgetProject, ProjectIntelligence } from '../types';
import { ViewHeader } from '../components/ui';

type Module = 'coproduction' | 'tax' | 'risk' | 'target' | 'schedule' | 'cash' | 'rooms' | 'benchmarks';
const modules: Array<{ id: Module; label: string; icon: React.ReactNode }> = [
  { id: 'coproduction', label: 'Coproduzione', icon: <UsersRound size={15} /> },
  { id: 'tax', label: 'Tax Optimizer', icon: <Landmark size={15} /> },
  { id: 'risk', label: 'Monte Carlo', icon: <BarChart3 size={15} /> },
  { id: 'target', label: 'Target Solver', icon: <TrendingDown size={15} /> },
  { id: 'schedule', label: 'Schedule', icon: <CalendarDays size={15} /> },
  { id: 'cash', label: 'Cash-flow', icon: <WalletCards size={15} /> },
  { id: 'rooms', label: 'Stanze reparto', icon: <GitBranch size={15} /> },
  { id: 'benchmarks', label: 'Benchmark', icon: <Coins size={15} /> },
];

interface Props { project: BudgetProject; money: Intl.NumberFormat; readOnly: boolean; demoMode?: boolean; commit: (mutator: (project: BudgetProject) => void, label?: string) => void }

export function InnovationLabView({ project, money, readOnly, commit, demoMode = false }: Props) {
  const [module, setModule] = useState<Module>('coproduction');
  const [actionMessage, setActionMessage] = useState('');
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkAggregate | null>(null);
  const [benchmarkMessage, setBenchmarkMessage] = useState('');
  const intelligence = normalizeIntelligence(project.intelligence);
  const active = project.scenarios.find((item) => item.id === project.activeScenarioId) ?? project.scenarios[0];
  const allocation = useMemo(() => calculateCoproductionAllocation(project), [project]);
  const tax = useMemo(() => optimizeTaxCredits(project), [project]);
  const risk = useMemo(() => simulateBudgetRisk(project), [project]);
  const solver = useMemo(() => solveTargetBudget(project), [project]);
  const schedule = useMemo(() => calculateScheduleImpact(project), [project]);
  const benchmark = useMemo(() => buildAnonymousBenchmark(project), [project]);
  const cashSummary = useMemo(() => calculateCashFlow(intelligence.cashFlow), [intelligence.cashFlow]);

  const mutateIntelligence = (mutator: (value: ProjectIntelligence) => void, label: string) => commit((draft) => {
    draft.intelligence = normalizeIntelligence(draft.intelligence);
    mutator(draft.intelligence);
    const entityIds = new Set(draft.intelligence.productionEntities.map((item) => item.id));
    draft.scenarios.forEach((scenario) => scenario.data.items.forEach((item) => {
      if (item.entityId && !entityIds.has(item.entityId)) item.entityId = null;
    }));
  }, label);

  const applyTaxPlan = () => {
    const expected = { count: tax.suggestions.length, before: tax.currentNet, after: tax.optimizedNet };
    commit((draft) => { applyTaxOptimizationPlan(draft); }, 'Tax credit optimization applied');
    setActionMessage(`Piano applicato: ${expected.count} voci riallocate. Costo netto ${money.format(expected.before)} → ${money.format(expected.after)}. Puoi annullare dalla barra superiore.`);
  };

  const applyTargetPlan = () => {
    const expected = { count: solver.suggestions.length, before: solver.actual, after: solver.actual - solver.required };
    commit((draft) => { applyTargetBudgetPlan(draft); }, 'Target budget solver applied');
    setActionMessage(`Soluzione applicata a ${expected.count} voci: ${money.format(expected.before)} → circa ${money.format(expected.after)}. Le formule restano modificabili e l’azione è annullabile.`);
  };

  const applyRiskProfile = () => {
    const count = active.data.items.length;
    commit((draft) => { applyPrudentRiskProfile(draft); }, 'Prudent risk profile applied');
    setActionMessage(`Profilo prudente applicato a ${count} voci. I percentili Monte Carlo sono stati ricalcolati.`);
  };

  const applySchedule = () => {
    const values = [
      `SHOOT_DAYS = ${intelligence.schedule.shootDays}`,
      `PREP_WEEKS = ${intelligence.schedule.prepWeeks}`,
      `DAYS_WEEK = ${intelligence.schedule.workDaysPerWeek}`,
    ];
    commit((draft) => { applyScheduleToData(draft.scenarios.find((item) => item.id === draft.activeScenarioId)!.data, draft); }, 'Schedule synchronized to globals');
    setActionMessage(`Globali sincronizzate: ${values.join(' · ')}. Impatto applicato: ${schedule.delta >= 0 ? '+' : ''}${money.format(schedule.delta)}.`);
  };

  const submitBenchmark = async () => {
    if (!intelligence.benchmarkOptIn) return setBenchmarkMessage('Abilita prima il consenso opt-in.');
    setBenchmarkMessage('Invio delle sole metriche aggregate…');
    try {
      const result = await submitAnonymousBenchmark(benchmark as unknown as Record<string, unknown>);
      setBenchmarkResult(result);
      setBenchmarkMessage(result.withheld ? `Campione registrato. Il confronto resta nascosto finché la coorte non raggiunge 5 progetti (ora ${result.cohortSize}).` : `Confronto disponibile su ${result.cohortSize} progetti anonimi.`);
      mutateIntelligence((value) => { value.benchmarkSubmittedAt = new Date().toISOString(); }, 'Anonymous benchmark submitted');
    } catch (error) { setBenchmarkMessage(error instanceof Error ? error.message : 'Invio non riuscito.'); }
  };

  return <div className="view-shell innovation-lab">
    <ViewHeader eyebrow="Production Intelligence Lab" title="Motori avanzati di budgeting" description="Coproduzione, ottimizzazione, probabilità, calendario, liquidità e collaborazione in moduli deterministici e auditabili." actions={<span className="scenario-chip"><SlidersHorizontal size={14} /> {active.name}</span>} />
    <nav className="lab-tabs" aria-label="Moduli di intelligence">{modules.map((item) => <button key={item.id} className={module === item.id ? 'active' : ''} onClick={() => { setModule(item.id); setActionMessage(''); }}>{item.icon}{item.label}</button>)}</nav>
    {actionMessage && <div className="lab-action-result" role="status"><strong>Operazione completata</strong><span>{actionMessage}</span></div>}

    {module === 'coproduction' && <section className="panel lab-panel"><LabTitle number="1" title="Motore di coproduzione" subtitle="Quote, entità operative e allocazione dei costi espliciti o condivisi." />
      <div className="lab-table"><div className="lab-row lab-head"><span>Entità</span><span>Paese</span><span>Valuta</span><span>Quota</span><span>Allocato</span><span /></div>{intelligence.productionEntities.map((entity) => {
        const row = allocation.rows.find((item) => item.entity.id === entity.id);
        return <div className="lab-row" key={entity.id}><input disabled={readOnly} value={entity.name} onChange={(event) => mutateIntelligence((value) => { value.productionEntities.find((item) => item.id === entity.id)!.name = event.target.value; }, 'Coproducer renamed')} /><input disabled={readOnly} value={entity.countryCode} maxLength={2} onChange={(event) => mutateIntelligence((value) => { value.productionEntities.find((item) => item.id === entity.id)!.countryCode = event.target.value.toUpperCase(); }, 'Coproducer country updated')} /><input disabled={readOnly} value={entity.currency} maxLength={3} onChange={(event) => mutateIntelligence((value) => { value.productionEntities.find((item) => item.id === entity.id)!.currency = event.target.value.toUpperCase(); }, 'Coproducer currency updated')} /><input disabled={readOnly} type="number" value={entity.sharePercent} onChange={(event) => mutateIntelligence((value) => { value.productionEntities.find((item) => item.id === entity.id)!.sharePercent = Number(event.target.value); }, 'Coproduction share updated')} /><strong>{money.format(row?.total ?? 0)}</strong><button disabled={readOnly} className="icon-button" onClick={() => mutateIntelligence((value) => { value.productionEntities = value.productionEntities.filter((item) => item.id !== entity.id); }, 'Coproducer removed')}><Trash2 size={14} /></button></div>;
      })}</div><button disabled={readOnly} className="button lab-add" onClick={() => mutateIntelligence((value) => value.productionEntities.push({ id: `entity-${Date.now()}`, name: 'Nuovo coproduttore', countryCode: intelligence.jurisdiction.countryCode, currency: project.currency, sharePercent: 0 }), 'Coproducer added')}><Plus size={14} /> Aggiungi entità</button>
      <div className="entity-assignment"><h3>Assegnazione voci</h3>{active.data.items.map((item) => <label key={item.id}><span>{item.description}<small>{item.location || 'Nessuna location'}</small></span><select disabled={readOnly} value={item.entityId ?? ''} onChange={(event) => commit((draft) => { const target = draft.scenarios.find((scenario) => scenario.id === draft.activeScenarioId)!.data.items.find((value) => value.id === item.id); if (target) target.entityId = event.target.value || null; }, 'Line item coproducer assigned')}><option value="">Ripartisci per quota</option>{intelligence.productionEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label>)}</div>
    </section>}

    {module === 'tax' && <section className="panel lab-panel"><LabTitle number="2" title="Tax Credit Optimizer" subtitle="Simula ogni location ammessa e rispetta massimali e cumulabilità configurati." /><div className="lab-metrics"><Metric label="Costo netto corrente" value={money.format(tax.currentNet)} /><Metric label="Piano ottimizzato" value={money.format(tax.optimizedNet)} /><Metric label="Risparmio potenziale" value={money.format(tax.potentialSaving)} positive /></div><div className="suggestion-list">{tax.suggestions.slice(0, 10).map((item) => <article key={item.itemId}><span><strong>{item.description}</strong><small>{item.from || 'Senza location'} → {item.to}</small></span><b>− {money.format(item.saving)}</b></article>)}{!tax.suggestions.length && <p className="lab-empty">La configurazione attuale è già ottimale rispetto agli incentivi inseriti.</p>}</div><button disabled={readOnly || !tax.suggestions.length} className="button primary" onClick={applyTaxPlan}>Applica piano verificabile</button></section>}

    {module === 'risk' && <section className="panel lab-panel"><LabTitle number="3" title="Simulazione probabilistica" subtitle={`${risk.iterations.toLocaleString('it-IT')} iterazioni Monte Carlo con distribuzioni triangolari per voce.`} /><div className="risk-scale"><Metric label="P10" value={money.format(risk.p10)} /><Metric label="P50" value={money.format(risk.p50)} /><Metric label="P80" value={money.format(risk.p80)} /><Metric label="P90" value={money.format(risk.p90)} /></div><div className="probability-card"><span>Probabilità di rispettare il target</span><strong>{risk.withinTarget === null ? 'Target non impostato' : `${(risk.withinTarget * 100).toFixed(1)}%`}</strong></div><button disabled={readOnly} className="button" onClick={applyRiskProfile}>Applica profilo prudente alle voci</button></section>}

    {module === 'target' && <section className="panel lab-panel"><LabTitle number="4" title="Target Budget Solver" subtitle="Trova una combinazione di riduzioni entro la flessibilità consentita per ciascuna voce." /><label className="lab-target"><span>Budget obiettivo</span><input disabled={readOnly} type="number" value={intelligence.targetBudget ?? ''} onChange={(event) => mutateIntelligence((value) => { value.targetBudget = event.target.value ? Number(event.target.value) : null; }, 'Target budget updated')} /></label><div className="lab-metrics"><Metric label="Budget corrente" value={money.format(solver.actual)} /><Metric label="Riduzione richiesta" value={money.format(solver.required)} /><Metric label="Esito" value={solver.feasible ? 'Soluzione trovata' : `Mancano ${money.format(solver.remaining)}`} positive={solver.feasible} /></div><div className="suggestion-list">{solver.suggestions.map((item) => <article key={item.itemId}><span><strong>{item.description}</strong><small>Riduzione {item.appliedPercent.toFixed(1)}% · limite {item.flexibilityPercent}%</small></span><b>− {money.format(item.saving)}</b></article>)}</div><button disabled={readOnly || !solver.feasible || !solver.suggestions.length} className="button primary" onClick={applyTargetPlan}>Applica soluzione al branch attivo</button></section>}

    {module === 'schedule' && <section className="panel lab-panel"><LabTitle number="5" title="Schedule-to-Budget" subtitle="Trasforma il calendario in globali di budget e misura l’impatto prima di applicarlo." /><div className="schedule-form"><label>Inizio<input disabled={readOnly} type="date" value={intelligence.schedule.startDate} onChange={(event) => mutateIntelligence((value) => { value.schedule.startDate = event.target.value; }, 'Schedule start updated')} /></label><label>Prep settimane<input disabled={readOnly} type="number" value={intelligence.schedule.prepWeeks} onChange={(event) => mutateIntelligence((value) => { value.schedule.prepWeeks = Number(event.target.value); }, 'Prep schedule updated')} /></label><label>Giorni riprese<input disabled={readOnly} type="number" value={intelligence.schedule.shootDays} onChange={(event) => mutateIntelligence((value) => { value.schedule.shootDays = Number(event.target.value); }, 'Shoot schedule updated')} /></label><label>Wrap settimane<input disabled={readOnly} type="number" value={intelligence.schedule.wrapWeeks} onChange={(event) => mutateIntelligence((value) => { value.schedule.wrapWeeks = Number(event.target.value); }, 'Wrap schedule updated')} /></label><label>Giorni/settimana<input disabled={readOnly} type="number" value={intelligence.schedule.workDaysPerWeek} onChange={(event) => mutateIntelligence((value) => { value.schedule.workDaysPerWeek = Number(event.target.value); }, 'Work week updated')} /></label></div><div className="lab-metrics"><Metric label="Fine prevista" value={new Date(schedule.endDate).toLocaleDateString('it-IT')} /><Metric label="Durata calendario" value={`${schedule.calendarDays} giorni`} /><Metric label="Impatto budget" value={`${schedule.delta >= 0 ? '+' : ''}${money.format(schedule.delta)}`} /></div><button disabled={readOnly} className="button primary" onClick={applySchedule}>Sincronizza con le Globali</button></section>}

    {module === 'cash' && <section className="panel lab-panel"><LabTitle number="6" title="Cash-flow di produzione" subtitle="Entrate, uscite, impegni e pagamenti ordinati per data." /><div className="lab-metrics"><Metric label="Picco fabbisogno" value={money.format(cashSummary.peakFundingNeed)} /><Metric label="Saldo finale" value={money.format(cashSummary.closingBalance)} /><Metric label="Movimenti" value={String(cashSummary.timeline.length)} /></div><div className="cash-editor">{intelligence.cashFlow.map((entry) => <div className="cash-edit-row" key={entry.id}><input disabled={readOnly} type="date" value={entry.date} onChange={(event) => mutateIntelligence((value) => { value.cashFlow.find((item) => item.id === entry.id)!.date = event.target.value; }, 'Cash date updated')} /><input disabled={readOnly} value={entry.label} onChange={(event) => mutateIntelligence((value) => { value.cashFlow.find((item) => item.id === entry.id)!.label = event.target.value; }, 'Cash label updated')} /><select disabled={readOnly} value={entry.type} onChange={(event) => mutateIntelligence((value) => { value.cashFlow.find((item) => item.id === entry.id)!.type = event.target.value as 'inflow' | 'outflow'; }, 'Cash type updated')}><option value="inflow">Entrata</option><option value="outflow">Uscita</option></select><input disabled={readOnly} type="number" value={entry.amount} onChange={(event) => mutateIntelligence((value) => { value.cashFlow.find((item) => item.id === entry.id)!.amount = Number(event.target.value); }, 'Cash amount updated')} /><select disabled={readOnly} value={entry.status} onChange={(event) => mutateIntelligence((value) => { value.cashFlow.find((item) => item.id === entry.id)!.status = event.target.value as typeof entry.status; }, 'Cash status updated')}><option value="forecast">Previsione</option><option value="committed">Impegnato</option><option value="paid">Pagato</option></select><button disabled={readOnly} className="icon-button" onClick={() => mutateIntelligence((value) => { value.cashFlow = value.cashFlow.filter((item) => item.id !== entry.id); }, 'Cash entry removed')}><Trash2 size={14} /></button></div>)}</div><button disabled={readOnly} className="button lab-add" onClick={() => mutateIntelligence((value) => value.cashFlow.push({ id: `cash-${Date.now()}`, date: new Date().toISOString().slice(0, 10), label: 'Nuovo movimento', type: 'outflow', amount: 0, status: 'forecast' }), 'Cash entry added')}><Plus size={14} /> Aggiungi movimento</button></section>}

    {module === 'rooms' && <section className="panel lab-panel"><LabTitle number="9" title="Department Budget Rooms" subtitle="Perimetri di account, responsabili e workflow di approvazione per reparto." /><div className="room-grid">{intelligence.departmentRooms.map((room) => <article className="room-card" key={room.id}><div><input disabled={readOnly} value={room.name} onChange={(event) => mutateIntelligence((value) => { value.departmentRooms.find((item) => item.id === room.id)!.name = event.target.value; }, 'Department room renamed')} /><select disabled={readOnly} value={room.status} onChange={(event) => mutateIntelligence((value) => { const target = value.departmentRooms.find((item) => item.id === room.id)!; target.status = event.target.value as typeof room.status; target.updatedAt = new Date().toISOString(); }, 'Department room status updated')}><option value="draft">Bozza</option><option value="submitted">In revisione</option><option value="approved">Approvata</option><option value="locked">Bloccata</option></select></div><label>Responsabile<input disabled={readOnly} value={room.ownerLabel} onChange={(event) => mutateIntelligence((value) => { value.departmentRooms.find((item) => item.id === room.id)!.ownerLabel = event.target.value; }, 'Department owner updated')} /></label><label>Account<select disabled={readOnly} value={room.accountIds[0] ?? ''} onChange={(event) => mutateIntelligence((value) => { value.departmentRooms.find((item) => item.id === room.id)!.accountIds = [event.target.value]; }, 'Department scope updated')}>{active.data.accounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select></label><textarea disabled={readOnly} value={room.note} onChange={(event) => mutateIntelligence((value) => { value.departmentRooms.find((item) => item.id === room.id)!.note = event.target.value; }, 'Department note updated')} /><button disabled={readOnly} className="text-button danger" onClick={() => mutateIntelligence((value) => { value.departmentRooms = value.departmentRooms.filter((item) => item.id !== room.id); }, 'Department room removed')}>Elimina stanza</button></article>)}</div><button disabled={readOnly} className="button lab-add" onClick={() => mutateIntelligence((value) => value.departmentRooms.push({ id: `room-${Date.now()}`, name: 'Nuova stanza reparto', accountIds: [active.data.accounts[0]?.id ?? ''], ownerLabel: '', status: 'draft', note: '', updatedAt: new Date().toISOString() }), 'Department room added')}><Plus size={14} /> Crea stanza</button></section>}

    {module === 'benchmarks' && <section className="panel lab-panel"><LabTitle number="12" title="Benchmark anonimi opt-in" subtitle="Condivide soltanto percentuali e fasce aggregate; nessun titolo, società, utente, progetto, location o voce." /><div className="benchmark-consent"><label><input disabled={readOnly || demoMode} type="checkbox" checked={intelligence.benchmarkOptIn} onChange={(event) => mutateIntelligence((value) => { value.benchmarkOptIn = event.target.checked; }, 'Benchmark consent updated')} /><span><strong>Partecipa volontariamente</strong><small>Il confronto viene mostrato solo con almeno 5 progetti nella stessa coorte.</small></span></label></div><div className="lab-metrics"><Metric label="Fascia" value={benchmark.budgetBand} /><Metric label="Costo / giorno" value={money.format(benchmark.costPerShootDay)} /><Metric label="Quota lavoro" value={`${(benchmark.laborShare * 100).toFixed(1)}%`} /><Metric label="Quota fringe" value={`${(benchmark.fringeShare * 100).toFixed(1)}%`} /></div>{benchmarkResult?.averages && <div className="benchmark-result">Media anonima coorte: {money.format(benchmarkResult.averages.costPerShootDay)} / giorno · lavoro {(benchmarkResult.averages.laborShare * 100).toFixed(1)}%</div>}{demoMode ? <p className="benchmark-message">L’invio è disponibile solo dopo l’accesso: la demo non inserisce dati sintetici nella coorte reale.</p> : <button disabled={readOnly || !intelligence.benchmarkOptIn} className="button primary" onClick={() => void submitBenchmark()}><Send size={14} /> Invia campione anonimo</button>}{benchmarkMessage && <p className="benchmark-message">{benchmarkMessage}</p>}</section>}

    <div className="lab-system-note"><strong>Moduli collegati:</strong> 7 Health Check e 8 Rate Provenance sono nel centro Legal & Intelligence; 10 Budget Branches è in Scenari; 11 Open SBS Standard è applicato a importazione ed esportazione.</div>
  </div>;
}

function LabTitle({ number, title, subtitle }: { number: string; title: string; subtitle: string }) { return <div className="lab-title"><span>{number}</span><div><h2>{title}</h2><p>{subtitle}</p></div></div>; }
function Metric({ label, value, positive = false }: { label: string; value: string; positive?: boolean }) { return <div className={`lab-metric ${positive ? 'positive' : ''}`}><span>{label}</span><strong>{value}</strong></div>; }
