import { useEffect, useMemo, useState } from 'react';
import {
  Calculator, ChevronDown, ChevronRight, CirclePlus, Copy, FolderTree, Layers3,
  MapPin, SearchX, Trash2, UsersRound, X,
} from 'lucide-react';
import { evaluateBudget, sumEvaluated } from '../engine';
import { uid } from '../helpers';
import type { BudgetData, LineItem, LineKind } from '../types';
import { EmptyState, SearchField, ViewHeader } from '../components/ui';
import { Modal } from '../components/Modal';

interface Props {
  data: BudgetData;
  money: Intl.NumberFormat;
  baseCurrency: string;
  focusAccountId: string | null;
  mutate: (mutator: (data: BudgetData) => void, label?: string) => void;
}

const kindLabels: Record<LineKind, string> = { labor: 'Personale', equipment: 'Attrezzatura', travel: 'Viaggi', other: 'Altro' };

export function BudgetView({ data, money, baseCurrency, focusAccountId, mutate }: Props) {
  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(() => new Set(data.accounts.map((value) => value.id)));
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => new Set(data.categories.map((value) => value.id)));
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [structureOpen, setStructureOpen] = useState(false);
  const [newAccount, setNewAccount] = useState({ code: '', name: '' });
  const [newCategory, setNewCategory] = useState({ accountId: data.accounts[0]?.id ?? '', code: '', name: '' });

  useEffect(() => {
    if (focusAccountId) {
      setAccountFilter(focusAccountId);
      setExpandedAccounts((current) => new Set([...current, focusAccountId]));
    }
  }, [focusAccountId]);

  const evaluated = useMemo(() => evaluateBudget(data), [data]);
  const evaluationById = useMemo(() => new Map(evaluated.map((entry) => [entry.item.id, entry])), [evaluated]);
  const locations = useMemo(() => [...new Set(data.items.map((value) => value.location).filter(Boolean))].sort(), [data.items]);
  const selectedItem = data.items.find((value) => value.id === selectedItemId) ?? null;
  const selectedEvaluation = selectedItem ? evaluationById.get(selectedItem.id) : null;

  const filteredIds = useMemo(() => new Set(data.items.filter((item) => {
    const category = data.categories.find((value) => value.id === item.categoryId);
    const accountMatch = accountFilter === 'all' || category?.accountId === accountFilter;
    const groupMatch = groupFilter === 'all' || item.groupId === groupFilter;
    const locationMatch = locationFilter === 'all' || item.location === locationFilter;
    const haystack = `${item.description} ${item.note} ${item.location}`.toLowerCase();
    return accountMatch && groupMatch && locationMatch && haystack.includes(search.trim().toLowerCase());
  }).map((item) => item.id)), [accountFilter, data.categories, data.items, groupFilter, locationFilter, search]);

  const visibleEvaluated = evaluated.filter((entry) => filteredIds.has(entry.item.id));
  const visibleTotals = sumEvaluated(visibleEvaluated);
  const filtersActive = search || accountFilter !== 'all' || groupFilter !== 'all' || locationFilter !== 'all';

  const toggleSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => setter((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const addLine = (categoryId?: string) => {
    const targetCategory = categoryId ?? data.categories.find((value) => accountFilter === 'all' || value.accountId === accountFilter)?.id ?? data.categories[0]?.id;
    if (!targetCategory) { setStructureOpen(true); return; }
    const id = uid('item');
    mutate((draft) => draft.items.push({
      id, categoryId: targetCategory, description: 'Nuova voce', kind: 'other', quantity: '1', units: '1', rate: '0', multiplier: '1',
      currency: baseCurrency, groupId: null, location: '', note: '',
    }), 'Detail line created');
    setSelectedItemId(id);
  };

  const updateSelected = (field: keyof LineItem, value: string | null) => {
    if (!selectedItemId) return;
    mutate((draft) => {
      const item = draft.items.find((candidate) => candidate.id === selectedItemId);
      if (item) Object.assign(item, { [field]: value });
    }, 'Detail line updated');
  };

  const duplicateSelected = () => {
    if (!selectedItem) return;
    const copy = { ...structuredClone(selectedItem), id: uid('item'), description: `${selectedItem.description} — copia` };
    mutate((draft) => draft.items.push(copy), 'Detail line duplicated');
    setSelectedItemId(copy.id);
  };

  const deleteSelected = () => {
    if (!selectedItem) return;
    mutate((draft) => { draft.items = draft.items.filter((item) => item.id !== selectedItem.id); }, 'Detail line deleted');
    setSelectedItemId(null);
  };

  const resetFilters = () => { setSearch(''); setAccountFilter('all'); setGroupFilter('all'); setLocationFilter('all'); };

  return (
    <div className="view-shell budget-page">
      <ViewHeader
        eyebrow="Budget workspace"
        title="Struttura analitica"
        description="Naviga da account e categorie fino alle singole voci di costo."
        actions={<><button className="button" onClick={() => setStructureOpen(true)}><FolderTree size={16} /> Struttura</button><button className="button primary" onClick={() => addLine()}><CirclePlus size={16} /> Nuova voce</button></>}
      />

      <section className="budget-toolbar panel">
        <SearchField value={search} onChange={setSearch} placeholder="Cerca descrizione, nota o location…" />
        <label className="select-field"><span>Account</span><select value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}><option value="all">Tutti</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select></label>
        <label className="select-field"><span>Gruppo</span><select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}><option value="all">Tutti</option>{data.groups.map((group) => <option key={group.id} value={group.id}>{group.code} · {group.name}</option>)}</select></label>
        <label className="select-field"><span>Location</span><select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}><option value="all">Tutte</option>{locations.map((location) => <option key={location}>{location}</option>)}</select></label>
        {filtersActive && <button className="button ghost" onClick={resetFilters}><X size={15} /> Azzera</button>}
      </section>

      <section className="panel hierarchy-panel">
        <div className="hierarchy-head">
          <div>Codice / descrizione</div><div>Tipo</div><div className="number">Qtà</div><div className="number">Unità</div><div className="number">Tariffa</div><div>Valuta</div><div className="number">Base</div><div className="number">Fringe</div><div className="number">Totale</div>
        </div>
        <div className="hierarchy-body">
          {data.accounts.filter((account) => accountFilter === 'all' || account.id === accountFilter).map((account) => {
            const categories = data.categories.filter((category) => category.accountId === account.id);
            const accountEntries = visibleEvaluated.filter((entry) => categories.some((category) => category.id === entry.item.categoryId));
            const accountTotals = sumEvaluated(accountEntries);
            if (filtersActive && !accountEntries.length) return null;
            const accountOpen = expandedAccounts.has(account.id);
            return (
              <div className="account-tree" key={account.id}>
                <button className="hierarchy-row account-row" type="button" onClick={() => toggleSet(setExpandedAccounts, account.id)}>
                  <div className="tree-label"><span className="chevron">{accountOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span><span className="code-pill">{account.code}</span><span className="account-copy"><strong>{account.name}</strong>{account.description && <small>{account.description}</small>}</span><span className="row-count">{accountEntries.length}</span></div>
                  <div /><div /><div /><div /><div /><div className="number">{money.format(accountTotals.base)}</div><div className="number">{money.format(accountTotals.fringe)}</div><div className="number strong-total">{money.format(accountTotals.total)}</div>
                </button>
                {accountOpen && categories.map((category) => {
                  const categoryEntries = visibleEvaluated.filter((entry) => entry.item.categoryId === category.id);
                  if (filtersActive && !categoryEntries.length) return null;
                  const categoryTotals = sumEvaluated(categoryEntries);
                  const categoryOpen = expandedCategories.has(category.id);
                  return (
                    <div className="category-tree" key={category.id}>
                      <div className="hierarchy-row category-row">
                        <div className="tree-label"><button className="category-toggle" type="button" onClick={() => toggleSet(setExpandedCategories, category.id)}><span className="tree-indent" /><span className="chevron">{categoryOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span><span className="category-code">{category.code}</span><strong>{category.name}</strong></button><button type="button" className="inline-add" aria-label={`Aggiungi voce a ${category.name}`} onClick={() => addLine(category.id)}><CirclePlus size={15} /></button></div>
                        <div /><div /><div /><div /><div /><div className="number">{money.format(categoryTotals.base)}</div><div className="number">{money.format(categoryTotals.fringe)}</div><div className="number strong-total">{money.format(categoryTotals.total)}</div>
                      </div>
                      {categoryOpen && categoryEntries.map((entry) => (
                        <button className={`hierarchy-row detail-row ${entry.errors.length ? 'has-error' : ''}`} type="button" key={entry.item.id} onClick={() => setSelectedItemId(entry.item.id)}>
                          <div className="tree-label detail-label"><span className="detail-indent" /><span className="detail-dot" /><span><strong>{entry.item.description}</strong><small>{entry.item.location || 'Nessuna location'}{entry.item.note ? ` · ${entry.item.note}` : ''}</small></span></div>
                          <div><span className={`kind-badge ${entry.item.kind}`}>{kindLabels[entry.item.kind]}</span></div>
                          <div className="number formula-cell">{entry.item.quantity}</div><div className="number formula-cell">{entry.item.units}</div><div className="number formula-cell">{entry.item.rate}</div><div><span className="currency-badge">{entry.item.currency}</span></div>
                          <div className="number">{money.format(entry.base)}</div><div className="number muted-cell">{money.format(entry.fringe)}</div><div className="number strong-total">{money.format(entry.total)}</div>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {!visibleEvaluated.length && <EmptyState icon={<SearchX size={24} />} title="Nessuna voce trovata">Modifica i filtri o aggiungi una nuova voce al budget.</EmptyState>}
        </div>
        <footer className="hierarchy-footer"><span>{visibleEvaluated.length} voci visualizzate</span><span>Base <strong>{money.format(visibleTotals.base)}</strong></span><span>Contributi <strong>{money.format(visibleTotals.fringe)}</strong></span><span>Totale <strong>{money.format(visibleTotals.total)}</strong></span></footer>
      </section>

      {selectedItem && selectedEvaluation && (
        <Modal wide title="Dettaglio voce" description="Modifica valori e formule; i totali vengono ricalcolati subito." onClose={() => setSelectedItemId(null)}>
          <div className="item-editor-layout">
            <div className="item-editor-form">
              <label className="field full"><span>Descrizione</span><input autoFocus value={selectedItem.description} onChange={(event) => updateSelected('description', event.target.value)} /></label>
              <div className="form-grid">
                <label className="field"><span>Categoria</span><select value={selectedItem.categoryId} onChange={(event) => updateSelected('categoryId', event.target.value)}>{data.accounts.map((account) => <optgroup key={account.id} label={`${account.code} · ${account.name}`}>{data.categories.filter((category) => category.accountId === account.id).map((category) => <option key={category.id} value={category.id}>{category.code} · {category.name}</option>)}</optgroup>)}</select></label>
                <label className="field"><span>Tipo di costo</span><select value={selectedItem.kind} onChange={(event) => updateSelected('kind', event.target.value as LineKind)}>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="field"><span>Gruppo fringe</span><select value={selectedItem.groupId ?? ''} onChange={(event) => updateSelected('groupId', event.target.value || null)}><option value="">Nessun gruppo</option>{data.groups.map((group) => <option key={group.id} value={group.id}>{group.code} · {group.name}</option>)}</select></label>
                <label className="field"><span>Location</span><input list="location-list" value={selectedItem.location} onChange={(event) => updateSelected('location', event.target.value)} /><datalist id="location-list">{locations.map((location) => <option key={location} value={location} />)}</datalist></label>
              </div>
              <div className="formula-grid">
                <label className="field"><span>Quantità</span><input className="formula-input" value={selectedItem.quantity} onChange={(event) => updateSelected('quantity', event.target.value)} /><small>= {selectedEvaluation.quantity}</small></label>
                <label className="field"><span>Unità</span><input className="formula-input" value={selectedItem.units} onChange={(event) => updateSelected('units', event.target.value)} /><small>= {selectedEvaluation.units}</small></label>
                <label className="field"><span>Tariffa</span><input className="formula-input" value={selectedItem.rate} onChange={(event) => updateSelected('rate', event.target.value)} /><small>= {selectedEvaluation.rate}</small></label>
                <label className="field"><span>Moltiplicatore</span><input className="formula-input" value={selectedItem.multiplier} onChange={(event) => updateSelected('multiplier', event.target.value)} /><small>= {selectedEvaluation.multiplier}</small></label>
              </div>
              <div className="form-grid">
                <label className="field"><span>Valuta tariffa</span><select value={selectedItem.currency} onChange={(event) => updateSelected('currency', event.target.value)}>{data.exchangeRates.map((rate) => <option key={rate.id} value={rate.currency}>{rate.currency} · {rate.name}</option>)}</select></label>
                <label className="field"><span>Nota</span><input value={selectedItem.note} onChange={(event) => updateSelected('note', event.target.value)} placeholder="Nota opzionale…" /></label>
              </div>
              <div className="global-reference">
                <div><Calculator size={17} /><strong>Globali disponibili</strong></div>
                <p>Puoi usare numeri, parentesi e operatori <code>+ − × ÷</code>.</p>
                <div className="global-chips">{data.globals.map((global) => <span key={global.id}><code>{global.symbol}</code> = {global.value}</span>)}</div>
              </div>
            </div>
            <aside className="calculation-card">
              <span className="section-kicker">Calcolo</span>
              <h3>{selectedItem.description}</h3>
              <dl>
                <div><dt>Importo in {selectedItem.currency}</dt><dd>{new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(selectedEvaluation.sourceBase)}</dd></div>
                <div><dt>Cambio</dt><dd>× {selectedEvaluation.fxRate}</dd></div>
                <div><dt>Base in {baseCurrency}</dt><dd>{money.format(selectedEvaluation.base)}</dd></div>
                {selectedEvaluation.fringeBreakdown.map((value) => <div key={value.rule.id}><dt>{value.rule.code} · {value.rule.rate}%{value.rule.cap ? ' (cap)' : ''}</dt><dd>{money.format(value.amount)}</dd></div>)}
                <div className="calculation-total"><dt>Totale</dt><dd>{money.format(selectedEvaluation.total)}</dd></div>
              </dl>
              {selectedEvaluation.errors.length > 0 && <div className="formula-errors">{selectedEvaluation.errors.map((error) => <p key={error}>{error}</p>)}</div>}
            </aside>
          </div>
          <div className="modal-actions split-actions"><button className="button danger-button" onClick={deleteSelected}><Trash2 size={16} /> Elimina</button><div><button className="button" onClick={duplicateSelected}><Copy size={16} /> Duplica</button><button className="button primary" onClick={() => setSelectedItemId(null)}>Fatto</button></div></div>
        </Modal>
      )}

      {structureOpen && (
        <Modal title="Struttura del budget" description="Crea account e categorie per organizzare il piano dei conti." onClose={() => setStructureOpen(false)}>
          <div className="structure-lists">
            {data.accounts.map((account) => <div className="structure-account" key={account.id}><div><Layers3 size={16} /><strong>{account.code} · {account.name}</strong></div><ul>{data.categories.filter((category) => category.accountId === account.id).map((category) => <li key={category.id}>{category.code} · {category.name}</li>)}</ul></div>)}
          </div>
          <div className="structure-create">
            <form onSubmit={(event) => { event.preventDefault(); if (!newAccount.name || !newAccount.code) return; const id = uid('account'); mutate((draft) => draft.accounts.push({ id, ...newAccount }), 'Account created'); setNewAccount({ code: '', name: '' }); setNewCategory((value) => ({ ...value, accountId: id })); }}>
              <h3>Nuovo account</h3><div className="inline-form"><input placeholder="Codice" value={newAccount.code} onChange={(event) => setNewAccount({ ...newAccount, code: event.target.value })} /><input placeholder="Nome account" value={newAccount.name} onChange={(event) => setNewAccount({ ...newAccount, name: event.target.value })} /><button className="button primary" type="submit"><CirclePlus size={15} /> Crea</button></div>
            </form>
            <form onSubmit={(event) => { event.preventDefault(); if (!newCategory.name || !newCategory.code || !newCategory.accountId) return; mutate((draft) => draft.categories.push({ id: uid('category'), ...newCategory }), 'Category created'); setNewCategory({ ...newCategory, code: '', name: '' }); }}>
              <h3>Nuova categoria</h3><div className="inline-form category-form"><select value={newCategory.accountId} onChange={(event) => setNewCategory({ ...newCategory, accountId: event.target.value })}>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select><input placeholder="Codice" value={newCategory.code} onChange={(event) => setNewCategory({ ...newCategory, code: event.target.value })} /><input placeholder="Nome categoria" value={newCategory.name} onChange={(event) => setNewCategory({ ...newCategory, name: event.target.value })} /><button className="button primary" type="submit"><CirclePlus size={15} /> Crea</button></div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}
