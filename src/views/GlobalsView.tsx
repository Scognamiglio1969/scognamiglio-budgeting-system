import { BadgeDollarSign, CirclePlus, Globe2, Landmark, Trash2, Variable } from 'lucide-react';
import { uid } from '../helpers';
import type { BudgetData, LineKind } from '../types';
import { ViewHeader } from '../components/ui';

interface Props {
  data: BudgetData;
  baseCurrency: string;
  mutate: (mutator: (data: BudgetData) => void, label?: string) => void;
}

const allKinds: Array<{ id: LineKind; label: string }> = [
  { id: 'labor', label: 'Personale' }, { id: 'equipment', label: 'Attrezzatura' },
  { id: 'travel', label: 'Viaggi' }, { id: 'other', label: 'Altro' },
];

export function GlobalsView({ data, baseCurrency, mutate }: Props) {
  const updateGlobal = (id: string, field: string, value: string | number) => mutate((draft) => {
    const global = draft.globals.find((item) => item.id === id);
    if (global) Object.assign(global, { [field]: value });
  }, 'Global updated');

  const addGlobal = () => mutate((draft) => draft.globals.push({
    id: uid('global'), symbol: `GLOBAL_${draft.globals.length + 1}`, name: 'Nuova globale', value: 1, unit: 'unità', description: '',
  }), 'Global created');

  const addRate = () => mutate((draft) => draft.exchangeRates.push({
    id: uid('fx'), currency: 'USD', name: 'Nuova valuta', rateToBase: 1, updatedAt: new Date().toISOString(),
  }), 'Exchange rate created');

  const addIncentive = () => mutate((draft) => draft.incentives.push({
    id: uid('incentive'), name: 'Nuovo incentivo', jurisdiction: 'Regione', rate: 30, cap: null,
    locations: [], kinds: ['labor', 'equipment', 'other'],
  }), 'Tax incentive created');

  return (
    <div className="view-shell">
      <ViewHeader eyebrow="Automazione" title="Globali, valute e incentivi" description="Un solo aggiornamento ricalcola ogni voce collegata del budget." actions={<button className="button primary" onClick={addGlobal}><CirclePlus size={16} /> Nuova globale</button>} />

      <section className="panel">
        <div className="panel-heading"><div className="heading-with-icon"><span className="section-icon purple"><Variable size={18} /></span><div><span className="section-kicker">Motore formule</span><h2>Globali</h2></div></div><span className="muted">Usa i simboli nei campi quantità, unità e tariffa</span></div>
        <div className="table-wrap">
          <table className="data-table editor-table globals-table">
            <thead><tr><th>Simbolo</th><th>Nome</th><th className="number">Valore</th><th>Unità</th><th>Descrizione</th><th /></tr></thead>
            <tbody>{data.globals.map((global) => (
              <tr key={global.id}>
                <td><input className="cell-input formula-input" value={global.symbol} onChange={(event) => updateGlobal(global.id, 'symbol', event.target.value.toUpperCase().replace(/\s+/g, '_'))} /></td>
                <td><input className="cell-input" value={global.name} onChange={(event) => updateGlobal(global.id, 'name', event.target.value)} /></td>
                <td><input className="cell-input number" type="number" step="any" value={global.value} onChange={(event) => updateGlobal(global.id, 'value', Number(event.target.value))} /></td>
                <td><input className="cell-input" value={global.unit} onChange={(event) => updateGlobal(global.id, 'unit', event.target.value)} /></td>
                <td><input className="cell-input" value={global.description} placeholder="Descrizione…" onChange={(event) => updateGlobal(global.id, 'description', event.target.value)} /></td>
                <td><button className="row-action danger" aria-label={`Elimina ${global.name}`} onClick={() => mutate((draft) => { draft.globals = draft.globals.filter((item) => item.id !== global.id); }, 'Global deleted')}><Trash2 size={15} /></button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <div className="two-column-grid">
        <section className="panel">
          <div className="panel-heading"><div className="heading-with-icon"><span className="section-icon blue"><Globe2 size={18} /></span><div><span className="section-kicker">Multi-valuta</span><h2>Tabella cambi</h2></div></div><button className="button small" onClick={addRate}><CirclePlus size={15} /> Aggiungi</button></div>
          <p className="panel-intro">Valore di una unità della valuta estera espresso in {baseCurrency}. La valuta base resta sempre 1.</p>
          <div className="rate-list">
            {data.exchangeRates.map((rate) => (
              <div className="rate-row" key={rate.id}>
                <input className="currency-code-input" value={rate.currency} maxLength={3} disabled={rate.currency === baseCurrency} onChange={(event) => mutate((draft) => { const item = draft.exchangeRates.find((value) => value.id === rate.id); if (item) item.currency = event.target.value.toUpperCase(); }, 'Currency updated')} />
                <input className="plain-input grow" value={rate.name} onChange={(event) => mutate((draft) => { const item = draft.exchangeRates.find((value) => value.id === rate.id); if (item) item.name = event.target.value; }, 'Currency updated')} />
                <div className="rate-value"><span>1 {rate.currency} =</span><input type="number" step="0.0001" value={rate.rateToBase} disabled={rate.currency === baseCurrency} onChange={(event) => mutate((draft) => { const item = draft.exchangeRates.find((value) => value.id === rate.id); if (item) { item.rateToBase = Number(event.target.value); item.updatedAt = new Date().toISOString(); } }, 'Exchange rate updated')} /><span>{baseCurrency}</span></div>
                {rate.currency !== baseCurrency && <button className="row-action danger" onClick={() => mutate((draft) => { draft.exchangeRates = draft.exchangeRates.filter((item) => item.id !== rate.id); }, 'Currency deleted')}><Trash2 size={15} /></button>}
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading"><div className="heading-with-icon"><span className="section-icon amber"><Landmark size={18} /></span><div><span className="section-kicker">Fiscalità</span><h2>Incentivi</h2></div></div><button className="button small" onClick={addIncentive}><CirclePlus size={15} /> Aggiungi</button></div>
          <div className="incentive-editor-list">
            {data.incentives.map((incentive) => (
              <article className="incentive-editor" key={incentive.id}>
                <div className="inline-title"><BadgeDollarSign size={17} /><input className="plain-input grow strong-input" value={incentive.name} onChange={(event) => mutate((draft) => { const item = draft.incentives.find((value) => value.id === incentive.id); if (item) item.name = event.target.value; }, 'Incentive updated')} /><button className="row-action danger" onClick={() => mutate((draft) => { draft.incentives = draft.incentives.filter((item) => item.id !== incentive.id); }, 'Incentive deleted')}><Trash2 size={15} /></button></div>
                <div className="form-grid compact">
                  <label><span>Giurisdizione</span><input value={incentive.jurisdiction} onChange={(event) => mutate((draft) => { const item = draft.incentives.find((value) => value.id === incentive.id); if (item) item.jurisdiction = event.target.value; }, 'Incentive updated')} /></label>
                  <label><span>Aliquota %</span><input type="number" value={incentive.rate} onChange={(event) => mutate((draft) => { const item = draft.incentives.find((value) => value.id === incentive.id); if (item) item.rate = Number(event.target.value); }, 'Incentive rate updated')} /></label>
                  <label><span>Massimale ({baseCurrency})</span><input type="number" value={incentive.cap ?? ''} placeholder="Nessuno" onChange={(event) => mutate((draft) => { const item = draft.incentives.find((value) => value.id === incentive.id); if (item) item.cap = event.target.value ? Number(event.target.value) : null; }, 'Incentive cap updated')} /></label>
                  <label><span>Location eleggibili</span><input value={incentive.locations.join(', ')} placeholder="Rome, Milan…" onChange={(event) => mutate((draft) => { const item = draft.incentives.find((value) => value.id === incentive.id); if (item) item.locations = event.target.value.split(',').map((value) => value.trim()).filter(Boolean); }, 'Incentive locations updated')} /></label>
                </div>
                <div className="kind-checks">{allKinds.map((kind) => <label key={kind.id}><input type="checkbox" checked={incentive.kinds.includes(kind.id)} onChange={() => mutate((draft) => { const item = draft.incentives.find((value) => value.id === incentive.id); if (!item) return; item.kinds = item.kinds.includes(kind.id) ? item.kinds.filter((value) => value !== kind.id) : [...item.kinds, kind.id]; }, 'Incentive eligibility updated')} /> {kind.label}</label>)}</div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
