import { useState } from 'react';
import { Archive, CirclePlus, Download, LibraryBig, Save, SlidersHorizontal, Trash2, UsersRound, Video } from 'lucide-react';
import { uid } from '../helpers';
import type { BudgetData, BudgetLibrary, BudgetProject } from '../types';
import { ViewHeader } from '../components/ui';

interface Props {
  project: BudgetProject;
  data: BudgetData;
  commit: (mutator: (project: BudgetProject) => void, label?: string) => void;
  mutate: (mutator: (data: BudgetData) => void, label?: string) => void;
}

const typeLabels: Record<BudgetLibrary['type'], string> = { crew: 'Crew', equipment: 'Attrezzatura', package: 'Pacchetto', custom: 'Personalizzata', setup: 'Setup' };
const typeIcons: Record<BudgetLibrary['type'], React.ReactNode> = {
  crew: <UsersRound size={18} />, equipment: <Video size={18} />, package: <Archive size={18} />, custom: <LibraryBig size={18} />, setup: <SlidersHorizontal size={18} />,
};

export function LibrariesView({ project, data, commit, mutate }: Props) {
  const [targetCategory, setTargetCategory] = useState(data.categories[0]?.id ?? '');
  const [sourceCategory, setSourceCategory] = useState(data.categories[0]?.id ?? '');
  const [libraryName, setLibraryName] = useState('');

  const applyLibrary = (library: BudgetLibrary) => {
    if (library.type === 'setup' && library.setup) {
      mutate((draft) => {
        library.setup!.globals.forEach((global) => { if (!draft.globals.some((item) => item.symbol === global.symbol)) draft.globals.push({ ...structuredClone(global), id: uid('global') }); });
        const fringeMap = new Map<string, string>();
        library.setup!.fringes.forEach((fringe) => {
          let existing = draft.fringes.find((item) => item.code === fringe.code);
          if (!existing) { existing = { ...structuredClone(fringe), id: uid('fringe') }; draft.fringes.push(existing); }
          fringeMap.set(fringe.id, existing.id);
        });
        library.setup!.groups.forEach((group) => {
          if (!draft.groups.some((item) => item.code === group.code)) draft.groups.push({ ...structuredClone(group), id: uid('group'), fringeIds: group.fringeIds.map((id) => fringeMap.get(id)).filter(Boolean) as string[] });
        });
      }, `Setup library “${library.name}” applied`);
      return;
    }
    if (!targetCategory) return;
    mutate((draft) => {
      library.items.forEach((source) => {
        const groupId = source.groupCode ? draft.groups.find((group) => group.code === source.groupCode)?.id ?? null : null;
        draft.items.push({ ...structuredClone(source), id: uid('item'), categoryId: targetCategory, groupId });
      });
    }, `Library “${library.name}” added`);
  };

  const saveCategory = () => {
    if (!libraryName.trim() || !sourceCategory) return;
    const items = data.items.filter((item) => item.categoryId === sourceCategory).map((item) => ({
      description: item.description, kind: item.kind, quantity: item.quantity, units: item.units, rate: item.rate,
      multiplier: item.multiplier, currency: item.currency, groupCode: data.groups.find((group) => group.id === item.groupId)?.code ?? null,
      location: item.location, note: item.note,
    }));
    const category = data.categories.find((item) => item.id === sourceCategory);
    commit((draft) => draft.libraries.push({ id: uid('library'), name: libraryName.trim(), type: 'custom', description: `Salvata da ${category?.code} · ${category?.name}`, updatedAt: new Date().toISOString(), items }), `Library “${libraryName.trim()}” saved`);
    setLibraryName('');
  };

  const saveSetup = () => {
    const name = libraryName.trim() || `Setup ${new Date().toLocaleDateString('it-IT')}`;
    commit((draft) => draft.libraries.push({ id: uid('library'), name, type: 'setup', description: `${data.globals.length} globali, ${data.fringes.length} fringe e ${data.groups.length} gruppi`, updatedAt: new Date().toISOString(), items: [], setup: { globals: structuredClone(data.globals), fringes: structuredClone(data.fringes), groups: structuredClone(data.groups) } }), `Setup library “${name}” saved`);
    setLibraryName('');
  };

  return (
    <div className="view-shell">
      <ViewHeader eyebrow="Database riutilizzabile" title="Librerie" description="Salva crew, pacchetti, tariffe e regole per usarli in qualunque progetto futuro." actions={<span className="scenario-chip"><LibraryBig size={15} /> {project.libraries.length} librerie</span>} />

      <section className="library-toolbar panel">
        <div><span className="section-kicker">Destinazione</span><strong>Dove inserire le voci selezionate</strong></div>
        <label className="select-field grow"><span>Categoria</span><select value={targetCategory} onChange={(event) => setTargetCategory(event.target.value)}>{data.accounts.map((account) => <optgroup key={account.id} label={`${account.code} · ${account.name}`}>{data.categories.filter((category) => category.accountId === account.id).map((category) => <option key={category.id} value={category.id}>{category.code} · {category.name}</option>)}</optgroup>)}</select></label>
      </section>

      <div className="library-grid">{project.libraries.map((library) => (
        <article className="library-card" key={library.id}>
          <div className={`library-icon ${library.type}`}>{typeIcons[library.type]}</div>
          <span className="library-type">{typeLabels[library.type]}</span>
          <h2>{library.name}</h2>
          <p>{library.description}</p>
          <div className="library-meta"><span>{library.type === 'setup' ? `${library.setup?.fringes.length ?? 0} fringe` : `${library.items.length} voci`}</span><span>Agg. {new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' }).format(new Date(library.updatedAt))}</span></div>
          {library.type !== 'setup' && <div className="library-preview">{library.items.slice(0, 3).map((item, index) => <span key={`${item.description}-${index}`}>{item.description}<em>{item.currency}</em></span>)}{library.items.length > 3 && <small>+{library.items.length - 3} altre</small>}</div>}
          <div className="library-actions"><button className="button primary grow" onClick={() => applyLibrary(library)}><Download size={16} /> {library.type === 'setup' ? 'Applica setup' : 'Aggiungi al budget'}</button><button className="row-action danger" aria-label={`Elimina ${library.name}`} onClick={() => commit((draft) => { draft.libraries = draft.libraries.filter((item) => item.id !== library.id); }, `Library “${library.name}” deleted`)}><Trash2 size={16} /></button></div>
        </article>
      ))}</div>

      <section className="panel library-save-panel">
        <div className="panel-heading"><div className="heading-with-icon"><span className="section-icon purple"><Save size={18} /></span><div><span className="section-kicker">Crea libreria</span><h2>Salva dal budget attivo</h2></div></div></div>
        <div className="save-library-form">
          <label className="field"><span>Nome libreria</span><input value={libraryName} onChange={(event) => setLibraryName(event.target.value)} placeholder="Es. Crew Italia 2026" /></label>
          <label className="field"><span>Categoria da salvare</span><select value={sourceCategory} onChange={(event) => setSourceCategory(event.target.value)}>{data.categories.map((category) => <option key={category.id} value={category.id}>{category.code} · {category.name}</option>)}</select></label>
          <button className="button" disabled={!libraryName.trim()} onClick={saveCategory}><CirclePlus size={16} /> Salva categoria</button>
          <button className="button primary" onClick={saveSetup}><SlidersHorizontal size={16} /> Salva setup completo</button>
        </div>
      </section>
    </div>
  );
}
