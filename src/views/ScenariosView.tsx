import { useMemo, useState } from 'react';
import { ArrowRight, Check, CirclePlus, Clock3, GitCompareArrows, GitMerge, History, Layers2, Send, Trash2 } from 'lucide-react';
import { accountItems, relativeTime, uid } from '../helpers';
import { calculateBudgetTotals, evaluateBudget, sumEvaluated } from '../engine';
import type { BudgetProject, BudgetScenario } from '../types';
import { ViewHeader } from '../components/ui';

interface Props {
  project: BudgetProject;
  money: Intl.NumberFormat;
  commit: (mutator: (project: BudgetProject) => void, label?: string) => void;
}

export function ScenariosView({ project, money, commit }: Props) {
  const [name, setName] = useState('');
  const [scopeType, setScopeType] = useState<'all' | 'group' | 'location'>('all');
  const [scopeValue, setScopeValue] = useState('');
  const [compareA, setCompareA] = useState(project.scenarios[0]?.id ?? '');
  const [compareB, setCompareB] = useState(project.activeScenarioId);
  const active = project.scenarios.find((value) => value.id === project.activeScenarioId) ?? project.scenarios[0];
  const locations = [...new Set(active.data.items.map((item) => item.location).filter(Boolean))].sort();

  const createScenario = () => {
    if (!name.trim()) return;
    const data = structuredClone(active.data);
    let scope = 'Budget completo';
    if (scopeType === 'group' && scopeValue) {
      data.items = data.items.filter((item) => item.groupId === scopeValue);
      scope = `Gruppo: ${active.data.groups.find((group) => group.id === scopeValue)?.name ?? scopeValue}`;
    }
    if (scopeType === 'location' && scopeValue) {
      data.items = data.items.filter((item) => item.location === scopeValue);
      scope = `Location: ${scopeValue}`;
    }
    const scenario: BudgetScenario = {
      id: uid('scenario'), name: name.trim(), description: scopeType === 'all' ? 'Scenario di lavoro' : 'Sub-budget indipendente',
      createdAt: new Date().toISOString(), basedOn: active.id, isBase: false, scope, data,
      branchStatus: 'working', mergedAt: null,
    };
    commit((draft) => { draft.scenarios.push(scenario); draft.activeScenarioId = scenario.id; }, `Scenario “${scenario.name}” created`);
    setCompareB(scenario.id); setName('');
  };

  const scenarioA = project.scenarios.find((value) => value.id === compareA) ?? project.scenarios[0];
  const scenarioB = project.scenarios.find((value) => value.id === compareB) ?? project.scenarios.at(-1)!;
  const comparison = useMemo(() => {
    if (!scenarioA || !scenarioB) return [];
    const evalA = evaluateBudget(scenarioA.data);
    const evalB = evaluateBudget(scenarioB.data);
    const codes = [...new Set([...scenarioA.data.accounts.map((a) => a.code), ...scenarioB.data.accounts.map((a) => a.code)])];
    return codes.map((code) => {
      const accountA = scenarioA.data.accounts.find((account) => account.code === code);
      const accountB = scenarioB.data.accounts.find((account) => account.code === code);
      const a = accountA ? sumEvaluated(accountItems(scenarioA.data, evalA, accountA.id)).total : 0;
      const b = accountB ? sumEvaluated(accountItems(scenarioB.data, evalB, accountB.id)).total : 0;
      return { code, name: accountB?.name ?? accountA?.name ?? '', a, b, delta: b - a };
    });
  }, [scenarioA, scenarioB]);
  const totalA = scenarioA ? calculateBudgetTotals(scenarioA.data).net : 0;
  const totalB = scenarioB ? calculateBudgetTotals(scenarioB.data).net : 0;

  const submitBranch = () => commit((draft) => {
    const branch = draft.scenarios.find((scenario) => scenario.id === draft.activeScenarioId);
    if (branch && !branch.isBase) branch.branchStatus = 'review';
  }, `Branch “${active.name}” submitted for review`);

  const mergeBranch = () => commit((draft) => {
    const branch = draft.scenarios.find((scenario) => scenario.id === draft.activeScenarioId);
    const master = draft.scenarios.find((scenario) => scenario.isBase) ?? draft.scenarios[0];
    if (!branch || branch.isBase || branch.branchStatus !== 'review') return;
    master.data = structuredClone(branch.data);
    branch.branchStatus = 'merged';
    branch.mergedAt = new Date().toISOString();
    draft.activeScenarioId = master.id;
  }, `Branch “${active.name}” merged into master`);

  return (
    <div className="view-shell">
      <ViewHeader eyebrow="Analisi" title="Scenari e sub-budget" description="Sperimenta senza toccare il master, poi confronta ogni versione account per account." />
      <div className="scenario-layout">
        <section className="panel scenario-list-panel">
          <div className="panel-heading"><div><span className="section-kicker">Versioni</span><h2>{project.scenarios.length} scenari</h2></div></div>
          <div className="scenario-list">{project.scenarios.map((scenario) => {
            const totals = calculateBudgetTotals(scenario.data);
            const selected = scenario.id === project.activeScenarioId;
            return <article className={`scenario-row ${selected ? 'selected' : ''}`} key={scenario.id}>
              <button type="button" className="scenario-select" onClick={() => commit((draft) => { draft.activeScenarioId = scenario.id; }, `Switched to “${scenario.name}”`)}>
                <span className="scenario-radio">{selected && <Check size={13} />}</span><span className="scenario-copy"><span><strong>{scenario.name}</strong>{scenario.isBase && <em>MASTER</em>}{!scenario.isBase && <em>{(scenario.branchStatus ?? 'working').toUpperCase()}</em>}</span><small>{scenario.scope} · {scenario.data.items.length} voci</small></span><span className="scenario-cost">{money.format(totals.net)}<small>netto</small></span>
              </button>
              {!scenario.isBase && <button className="row-action danger scenario-delete" onClick={() => commit((draft) => { draft.scenarios = draft.scenarios.filter((value) => value.id !== scenario.id); if (draft.activeScenarioId === scenario.id) draft.activeScenarioId = draft.scenarios[0].id; }, `Scenario “${scenario.name}” deleted`)}><Trash2 size={15} /></button>}
            </article>;
          })}</div>
          <div className="scenario-create">
            <h3><CirclePlus size={17} /> Nuovo scenario</h3>
            <label className="field"><span>Nome</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Es. Piano ridotto" /></label>
            <label className="field"><span>Ambito</span><select value={scopeType} onChange={(event) => { setScopeType(event.target.value as typeof scopeType); setScopeValue(''); }}><option value="all">Duplica tutto il budget</option><option value="group">Crea sub-budget da gruppo</option><option value="location">Crea sub-budget da location</option></select></label>
            {scopeType === 'group' && <label className="field"><span>Gruppo</span><select value={scopeValue} onChange={(event) => setScopeValue(event.target.value)}><option value="">Seleziona…</option>{active.data.groups.map((group) => <option key={group.id} value={group.id}>{group.code} · {group.name}</option>)}</select></label>}
            {scopeType === 'location' && <label className="field"><span>Location</span><select value={scopeValue} onChange={(event) => setScopeValue(event.target.value)}><option value="">Seleziona…</option>{locations.map((location) => <option key={location}>{location}</option>)}</select></label>}
            <button className="button primary full-button" disabled={!name.trim() || (scopeType !== 'all' && !scopeValue)} onClick={createScenario}><Layers2 size={16} /> Crea e apri</button>
          </div>
          {!active.isBase && <div className="branch-workflow"><span className="section-kicker">Budget Branch · {(active.branchStatus ?? 'working').toUpperCase()}</span>{(active.branchStatus ?? 'working') === 'working' && <button className="button full-button" onClick={submitBranch}><Send size={15} /> Invia in revisione</button>}{active.branchStatus === 'review' && <button className="button primary full-button" onClick={mergeBranch}><GitMerge size={15} /> Merge nel master</button>}{active.branchStatus === 'merged' && <p>Branch integrato {active.mergedAt ? relativeTime(active.mergedAt) : ''}. Il master contiene ora questo budget.</p>}</div>}
        </section>

        <div className="scenario-main">
          <section className="panel comparison-panel">
            <div className="panel-heading"><div className="heading-with-icon"><span className="section-icon blue"><GitCompareArrows size={18} /></span><div><span className="section-kicker">Confronto budget</span><h2>Variazioni per account</h2></div></div></div>
            <div className="compare-selectors"><label><span>Versione origine</span><select value={compareA} onChange={(event) => setCompareA(event.target.value)}>{project.scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}</select><strong>{money.format(totalA)}</strong></label><ArrowRight size={20} /><label><span>Versione confronto</span><select value={compareB} onChange={(event) => setCompareB(event.target.value)}>{project.scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}</select><strong>{money.format(totalB)}</strong></label><div className={`compare-delta ${totalB - totalA > 0 ? 'up' : totalB - totalA < 0 ? 'down' : ''}`}><span>Variazione netta</span><strong>{totalB - totalA > 0 ? '+' : ''}{money.format(totalB - totalA)}</strong></div></div>
            <div className="table-wrap"><table className="data-table compare-table"><thead><tr><th>Account</th><th>Descrizione</th><th className="number">Origine</th><th className="number">Confronto</th><th className="number">Differenza</th><th className="number">%</th></tr></thead><tbody>{comparison.map((row) => <tr key={row.code}><td><span className="code-pill">{row.code}</span></td><td><strong>{row.name}</strong></td><td className="number">{money.format(row.a)}</td><td className="number">{money.format(row.b)}</td><td className={`number delta-cell ${row.delta > 0 ? 'up' : row.delta < 0 ? 'down' : ''}`}>{row.delta > 0 ? '+' : ''}{money.format(row.delta)}</td><td className="number muted-cell">{row.a ? `${row.delta > 0 ? '+' : ''}${(row.delta / row.a * 100).toFixed(1)}%` : '—'}</td></tr>)}</tbody></table></div>
          </section>

          <section className="panel history-panel">
            <div className="panel-heading"><div className="heading-with-icon"><span className="section-icon amber"><History size={18} /></span><div><span className="section-kicker">Audit trail</span><h2>Storico modifiche</h2></div></div><span className="muted">Ultimi {Math.min(project.changeLog.length, 20)} eventi</span></div>
            <div className="timeline">{project.changeLog.slice(0, 20).map((entry) => <div className="timeline-entry" key={entry.id}><span className="timeline-dot"><Clock3 size={13} /></span><div><strong>{entry.label}</strong><small>{project.scenarios.find((scenario) => scenario.id === entry.scenarioId)?.name ?? 'Scenario rimosso'} · {relativeTime(entry.timestamp)}</small></div></div>)}</div>
          </section>
        </div>
      </div>
    </div>
  );
}
