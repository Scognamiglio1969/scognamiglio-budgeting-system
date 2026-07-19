import { CirclePlus, ShieldCheck, Trash2, UsersRound } from 'lucide-react';
import { evaluateBudget, sumEvaluated } from '../engine';
import { uid } from '../helpers';
import type { BudgetData, LineKind } from '../types';
import { ViewHeader } from '../components/ui';

interface Props {
  data: BudgetData;
  money: Intl.NumberFormat;
  mutate: (mutator: (data: BudgetData) => void, label?: string) => void;
}

const kinds: Array<{ value: LineKind; label: string }> = [
  { value: 'labor', label: 'Personale' }, { value: 'equipment', label: 'Attrezzatura' },
  { value: 'travel', label: 'Viaggi' }, { value: 'other', label: 'Altro' },
];

export function FringesView({ data, money, mutate }: Props) {
  const evaluated = evaluateBudget(data);
  const addFringe = () => mutate((draft) => draft.fringes.push({ id: uid('fringe'), code: 'NEW', name: 'Nuovo contributo', rate: 0, cap: null, kinds: ['labor'] }), 'Fringe created');
  const addGroup = (name = 'Nuovo gruppo', code = 'GROUP') => mutate((draft) => draft.groups.push({ id: uid('group'), code, name, fringeIds: [] }), 'Group created');

  return (
    <div className="view-shell">
      <ViewHeader eyebrow="Regole automatiche" title="Contributi e gruppi" description="Configura imposte, assicurazioni e regole sindacali con massimali automatici." actions={<><button className="button" onClick={() => addGroup()}><UsersRound size={16} /> Nuovo gruppo</button><button className="button primary" onClick={addFringe}><CirclePlus size={16} /> Nuovo fringe</button></>} />

      <section className="panel">
        <div className="panel-heading"><div className="heading-with-icon"><span className="section-icon green"><ShieldCheck size={18} /></span><div><span className="section-kicker">Fringe setup</span><h2>Regole di contribuzione</h2></div></div><span className="muted">Il cap limita automaticamente la base imponibile</span></div>
        <div className="table-wrap">
          <table className="data-table editor-table fringe-table">
            <thead><tr><th>Codice</th><th>Descrizione</th><th className="number">Aliquota</th><th className="number">Massimale</th><th>Applicabile a</th><th /></tr></thead>
            <tbody>{data.fringes.map((fringe) => (
              <tr key={fringe.id}>
                <td><input className="cell-input formula-input" value={fringe.code} onChange={(event) => mutate((draft) => { const item = draft.fringes.find((value) => value.id === fringe.id); if (item) item.code = event.target.value.toUpperCase(); }, 'Fringe updated')} /></td>
                <td><input className="cell-input" value={fringe.name} onChange={(event) => mutate((draft) => { const item = draft.fringes.find((value) => value.id === fringe.id); if (item) item.name = event.target.value; }, 'Fringe updated')} /></td>
                <td><div className="suffix-input"><input className="cell-input number" type="number" step="0.01" value={fringe.rate} onChange={(event) => mutate((draft) => { const item = draft.fringes.find((value) => value.id === fringe.id); if (item) item.rate = Number(event.target.value); }, 'Fringe rate updated')} /><span>%</span></div></td>
                <td><input className="cell-input number" type="number" value={fringe.cap ?? ''} placeholder="Nessuno" onChange={(event) => mutate((draft) => { const item = draft.fringes.find((value) => value.id === fringe.id); if (item) item.cap = event.target.value ? Number(event.target.value) : null; }, 'Fringe cap updated')} /></td>
                <td><div className="kind-checks inline">{kinds.map((kind) => <label key={kind.value}><input type="checkbox" checked={fringe.kinds.includes(kind.value)} onChange={() => mutate((draft) => { const item = draft.fringes.find((value) => value.id === fringe.id); if (!item) return; item.kinds = item.kinds.includes(kind.value) ? item.kinds.filter((value) => value !== kind.value) : [...item.kinds, kind.value]; }, 'Fringe applicability updated')} /> {kind.label}</label>)}</div></td>
                <td><button className="row-action danger" onClick={() => mutate((draft) => { draft.fringes = draft.fringes.filter((item) => item.id !== fringe.id); draft.groups.forEach((group) => { group.fringeIds = group.fringeIds.filter((id) => id !== fringe.id); }); }, 'Fringe deleted')}><Trash2 size={15} /></button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading"><div><span className="section-kicker">Applicazione</span><h2>Gruppi</h2></div><div className="preset-actions"><span className="muted">Preset rapidi:</span>{['SAG-AFTRA', 'DGA', 'IATSE'].map((name) => <button key={name} className="button tiny" disabled={data.groups.some((group) => group.code === name)} onClick={() => addGroup(name, name)}>{name}</button>)}</div></div>
        <div className="group-grid">
          {data.groups.map((group) => {
            const groupItems = evaluated.filter((entry) => entry.item.groupId === group.id);
            const totals = sumEvaluated(groupItems);
            return (
              <article className="group-card" key={group.id}>
                <div className="group-card-head"><span className="group-monogram">{group.code.slice(0, 2)}</span><div className="grow"><input className="plain-input group-name" value={group.name} onChange={(event) => mutate((draft) => { const item = draft.groups.find((value) => value.id === group.id); if (item) item.name = event.target.value; }, 'Group updated')} /><input className="plain-input group-code" value={group.code} onChange={(event) => mutate((draft) => { const item = draft.groups.find((value) => value.id === group.id); if (item) item.code = event.target.value.toUpperCase(); }, 'Group updated')} /></div><button className="row-action danger" onClick={() => mutate((draft) => { draft.groups = draft.groups.filter((item) => item.id !== group.id); draft.items.forEach((item) => { if (item.groupId === group.id) item.groupId = null; }); }, 'Group deleted')}><Trash2 size={15} /></button></div>
                <div className="group-total"><div><span>Costo gruppo</span><strong>{money.format(totals.total)}</strong></div><div><span>Voci</span><strong>{groupItems.length}</strong></div><div><span>Fringe</span><strong>{money.format(totals.fringe)}</strong></div></div>
                <div className="rule-list"><span className="field-caption">Regole applicate</span>{data.fringes.map((fringe) => <label key={fringe.id} className="rule-check"><input type="checkbox" checked={group.fringeIds.includes(fringe.id)} onChange={() => mutate((draft) => { const item = draft.groups.find((value) => value.id === group.id); if (!item) return; item.fringeIds = item.fringeIds.includes(fringe.id) ? item.fringeIds.filter((id) => id !== fringe.id) : [...item.fringeIds, fringe.id]; }, 'Group fringes updated')} /><span><strong>{fringe.code}</strong> {fringe.name}</span><em>{fringe.rate}%</em></label>)}</div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
