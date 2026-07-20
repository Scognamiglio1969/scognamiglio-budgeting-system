import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpenText, Building2, Download, LibraryBig, Plus, Search, Share2, Tags, Trash2 } from 'lucide-react';
import { cloudErrorMessage, supabase, type SharedResource, type UserProfile } from '../cloud';
import { uid } from '../helpers';
import type { BudgetData, BudgetLibrary, BudgetProject } from '../types';
import { ViewHeader } from '../components/ui';

interface Props {
  profile: UserProfile;
  project: BudgetProject;
  data: BudgetData;
  commit: (mutator: (project: BudgetProject) => void, label?: string) => void;
  mutate: (mutator: (data: BudgetData) => void, label?: string) => void;
  demoMode?: boolean;
}

const typeLabels: Record<SharedResource['resource_type'], string> = {
  department: 'Reparto', library: 'Libreria', 'rate-card': 'Listino', 'fringe-set': 'Fringe', text: 'Nota',
};

const demoResources: SharedResource[] = [{
  id: 'demo-resource-production', resource_type: 'department', name: 'Descrizione reparto Produzione',
  description: 'Perimetro operativo riutilizzabile per il reparto Produzione.',
  payload: { body: 'Coordina piano di lavorazione, logistica, autorizzazioni e comunicazioni tra i reparti.' },
  tags: ['demo', 'produzione'], archived: false, created_by: 'demo-user', updated_by: 'demo-user',
  created_at: '2026-07-20T10:00:00.000Z', updated_at: '2026-07-20T10:00:00.000Z',
}];

export function SharedResourcesView({ profile, project, data, commit, mutate, demoMode = false }: Props) {
  const [resources, setResources] = useState<SharedResource[]>(demoMode ? demoResources : []);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [targetAccount, setTargetAccount] = useState(data.accounts[0]?.id ?? '');
  const [sourceAccount, setSourceAccount] = useState(data.accounts[0]?.id ?? '');
  const [resourceName, setResourceName] = useState(data.accounts[0]?.name ?? '');
  const [resourceDescription, setResourceDescription] = useState(data.accounts[0]?.description ?? '');
  const [resourceTags, setResourceTags] = useState('');
  const [sourceLibrary, setSourceLibrary] = useState(project.libraries[0]?.id ?? '');

  const load = useCallback(async () => {
    if (demoMode) { setResources(demoResources); setLoading(false); return; }
    if (!supabase) return;
    setLoading(true);
    const { data: result, error } = await supabase.from('shared_resources').select('*').eq('archived', false).order('updated_at', { ascending: false });
    if (error) setMessage({ type: 'error', text: cloudErrorMessage(error) });
    else setResources((result ?? []) as SharedResource[]);
    setLoading(false);
  }, [demoMode]);

  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => resources.filter((resource) => `${resource.name} ${resource.description} ${resource.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())), [resources, query]);

  const shareDepartment = async () => {
    if (!resourceName.trim() || !resourceDescription.trim()) return;
    setBusy(true); setMessage(null);
    const source = data.accounts.find((account) => account.id === sourceAccount);
    if (demoMode) {
      setResources((current) => [{ id: uid('resource'), resource_type: 'department', name: resourceName.trim(), description: resourceDescription.trim().slice(0, 180), payload: { body: resourceDescription.trim(), sourceCode: source?.code ?? '', sourceName: source?.name ?? '' }, tags: resourceTags.split(',').map((tag) => tag.trim()).filter(Boolean), archived: false, created_by: profile.id, updated_by: profile.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...current]);
      setMessage({ type: 'success', text: 'Risorsa creata nella sandbox. Verrà rimossa al ricaricamento.' }); setBusy(false); return;
    }
    if (!supabase) { setBusy(false); return; }
    const { error } = await supabase.from('shared_resources').insert({
      resource_type: 'department', name: resourceName.trim(), description: resourceDescription.trim().slice(0, 180),
      payload: { body: resourceDescription.trim(), sourceCode: source?.code ?? '', sourceName: source?.name ?? '' },
      tags: resourceTags.split(',').map((tag) => tag.trim()).filter(Boolean), created_by: profile.id, updated_by: profile.id,
    });
    if (error) setMessage({ type: 'error', text: cloudErrorMessage(error) });
    else { setMessage({ type: 'success', text: 'Descrizione reparto condivisa con tutti i progetti.' }); await load(); }
    setBusy(false);
  };

  const shareLibrary = async () => {
    const library = project.libraries.find((item) => item.id === sourceLibrary);
    if (!library) return;
    setBusy(true); setMessage(null);
    if (demoMode) {
      setResources((current) => [{ id: uid('resource'), resource_type: 'library', name: library.name, description: library.description, payload: { library: structuredClone(library) }, tags: [library.type], archived: false, created_by: profile.id, updated_by: profile.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...current]);
      setMessage({ type: 'success', text: 'Libreria pubblicata nella sandbox.' }); setBusy(false); return;
    }
    if (!supabase) { setBusy(false); return; }
    const { error } = await supabase.from('shared_resources').insert({
      resource_type: 'library', name: library.name, description: library.description, payload: { library }, tags: [library.type],
      created_by: profile.id, updated_by: profile.id,
    });
    if (error) setMessage({ type: 'error', text: cloudErrorMessage(error) });
    else { setMessage({ type: 'success', text: 'Libreria pubblicata nello spazio condiviso.' }); await load(); }
    setBusy(false);
  };

  const apply = (resource: SharedResource) => {
    if (resource.resource_type === 'department') {
      const body = typeof resource.payload.body === 'string' ? resource.payload.body : resource.description;
      mutate((draft) => {
        const account = draft.accounts.find((candidate) => candidate.id === targetAccount);
        if (account) account.description = body;
      }, `Shared department resource “${resource.name}” applied`);
      return setMessage({ type: 'success', text: `Descrizione applicata al reparto ${data.accounts.find((account) => account.id === targetAccount)?.name}.` });
    }
    if (resource.resource_type === 'library') {
      const library = resource.payload.library as BudgetLibrary | undefined;
      if (!library) return;
      commit((draft) => draft.libraries.push({ ...structuredClone(library), id: uid('library'), updatedAt: new Date().toISOString() }), `Shared library “${resource.name}” imported`);
      setMessage({ type: 'success', text: 'Libreria copiata nel progetto attivo.' });
    }
  };

  const remove = async (resource: SharedResource) => {
    if (!window.confirm(`Rimuovere “${resource.name}” dalle risorse condivise?`)) return;
    if (demoMode) { setResources((current) => current.filter((item) => item.id !== resource.id)); setMessage({ type: 'success', text: 'Risorsa rimossa dalla sandbox.' }); return; }
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.from('shared_resources').update({ archived: true, updated_by: profile.id }).eq('id', resource.id);
    if (error) setMessage({ type: 'error', text: cloudErrorMessage(error) }); else await load();
    setBusy(false);
  };

  const changeSourceAccount = (accountId: string) => {
    const account = data.accounts.find((candidate) => candidate.id === accountId);
    setSourceAccount(accountId);
    setResourceName(account?.name ?? '');
    setResourceDescription(account?.description ?? '');
  };

  return <div className="view-shell"><ViewHeader eyebrow="Condivisione tra progetti" title="Risorse condivise" description="Pubblica descrizioni di reparto, listini e librerie una volta sola; riusale in ogni produzione autorizzata." actions={<span className="scenario-chip"><Share2 size={15} /> {resources.length} risorse</span>} />{message && <div className={`resource-message ${message.type}`}><AlertTriangle size={16} />{message.text}</div>}<section className="resource-toolbar panel"><div className="search-field"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca risorsa, reparto o tag…" /></div><label className="select-field"><span>Reparto di destinazione</span><select value={targetAccount} onChange={(event) => setTargetAccount(event.target.value)}>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select></label></section>{loading ? <div className="empty-state"><Share2 size={28} /><p>Caricamento risorse…</p></div> : <div className="resource-grid">{filtered.map((resource) => <article className="resource-card" key={resource.id}><div className={`resource-kind ${resource.resource_type}`}>{resource.resource_type === 'department' ? <Building2 size={18} /> : <LibraryBig size={18} />}</div><span className="library-type">{typeLabels[resource.resource_type]}</span><h2>{resource.name}</h2><p>{resource.description}</p>{resource.resource_type === 'department' && typeof resource.payload.body === 'string' && <blockquote>{resource.payload.body}</blockquote>}<div className="resource-tags"><Tags size={12} />{resource.tags.length ? resource.tags.map((tag) => <span key={tag}>{tag}</span>) : <span>senza tag</span>}</div><div className="library-actions"><button className="button primary grow" disabled={!['department', 'library'].includes(resource.resource_type)} onClick={() => apply(resource)}><Download size={15} /> {resource.resource_type === 'department' ? 'Applica al reparto' : 'Copia nel progetto'}</button>{(profile.role === 'admin' || resource.created_by === profile.id) && <button className="row-action danger" disabled={busy} onClick={() => void remove(resource)} aria-label="Rimuovi"><Trash2 size={15} /></button>}</div></article>)}</div>}<div className="resource-create-grid"><section className="panel"><div className="panel-heading"><div className="heading-with-icon"><span className="section-icon purple"><BookOpenText size={18} /></span><div><span className="section-kicker">Standard di produzione</span><h2>Condividi descrizione reparto</h2></div></div></div><div className="resource-form"><label className="field"><span>Reparto sorgente</span><select value={sourceAccount} onChange={(event) => changeSourceAccount(event.target.value)}>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select></label><label className="field"><span>Nome risorsa</span><input value={resourceName} onChange={(event) => setResourceName(event.target.value)} /></label><label className="field"><span>Descrizione condivisa</span><textarea rows={5} value={resourceDescription} onChange={(event) => setResourceDescription(event.target.value)} placeholder="Responsabilità, perimetro e note standard del reparto…" /></label><label className="field"><span>Tag, separati da virgola</span><input value={resourceTags} onChange={(event) => setResourceTags(event.target.value)} placeholder="italia, feature, 2026" /></label><button className="button primary" disabled={busy || !resourceName.trim() || !resourceDescription.trim()} onClick={() => void shareDepartment()}><Plus size={15} /> Pubblica risorsa</button></div></section><section className="panel"><div className="panel-heading"><div className="heading-with-icon"><span className="section-icon green"><LibraryBig size={18} /></span><div><span className="section-kicker">Dal progetto attivo</span><h2>Condividi libreria</h2></div></div></div><div className="resource-form"><p className="muted">Crew rate, pacchetti attrezzatura e setup del progetto diventano disponibili agli altri progetti senza collegare i relativi budget.</p><label className="field"><span>Libreria locale</span><select value={sourceLibrary} onChange={(event) => setSourceLibrary(event.target.value)}>{project.libraries.map((library) => <option key={library.id} value={library.id}>{library.name}</option>)}</select></label><button className="button primary" disabled={busy || !sourceLibrary} onClick={() => void shareLibrary()}><Share2 size={15} /> Pubblica libreria</button></div></section></div></div>;
}
