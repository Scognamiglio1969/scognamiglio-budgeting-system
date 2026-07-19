import { useMemo, useState } from 'react';
import { Archive, ArrowRight, Cloud, Database, Download, FolderKanban, LogOut, Plus, Search, ShieldCheck, Upload, UsersRound } from 'lucide-react';
import type { CloudProjectSummary, UserProfile } from '../cloud';
import type { BudgetProject } from '../types';
import { Modal } from './Modal';
import { ProjectAccess } from './ProjectAccess';

interface ProjectPortalProps {
  profile: UserProfile;
  projects: CloudProjectSummary[];
  loading: boolean;
  legacyProject: BudgetProject | null;
  error: string | null;
  onOpenProject: (project: CloudProjectSummary) => void;
  onCreateProject: (values: { title: string; company: string; currency: string; locale: string; data?: BudgetProject }) => Promise<void>;
  onArchiveProject: (project: CloudProjectSummary) => Promise<void>;
  onOpenAdmin: () => void;
  onDownloadBackup: () => Promise<void>;
  onSignOut: () => void;
}

export function ProjectPortal({ profile, projects, loading, legacyProject, error, onOpenProject, onCreateProject, onArchiveProject, onOpenAdmin, onDownloadBackup, onSignOut }: ProjectPortalProps) {
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [accessProject, setAccessProject] = useState<CloudProjectSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('Scognamiglio Productions');
  const [currency, setCurrency] = useState('EUR');
  const [locale, setLocale] = useState('it-IT');
  const filtered = useMemo(() => projects.filter((project) => `${project.title} ${project.company}`.toLowerCase().includes(query.toLowerCase())), [projects, query]);
  const isAdmin = profile.role === 'admin';

  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    await onCreateProject({ title, company, currency, locale });
    setBusy(false); setCreateOpen(false); setTitle('');
  };

  const migrate = async () => {
    if (!legacyProject) return;
    setBusy(true);
    await onCreateProject({ title: legacyProject.title, company: legacyProject.company, currency: legacyProject.currency, locale: legacyProject.currencyLocale, data: legacyProject });
    localStorage.setItem(`sbs-local-migrated-${legacyProject.id}`, new Date().toISOString());
    setBusy(false);
  };

  return <div className="portal-shell"><header className="portal-topbar"><div className="auth-brand compact"><div className="brand-mark">S</div><div><strong>SBS</strong><span>Scognamiglio Budgeting System</span></div></div><div className="portal-user"><span><strong>{profile.full_name || profile.email}</strong><small>{isAdmin ? 'Amministratore' : 'Utente abilitato'}</small></span>{isAdmin && <button className="button" onClick={() => void onDownloadBackup()}><Download size={15} /> Backup</button>}{isAdmin && <button className="button" onClick={onOpenAdmin}><ShieldCheck size={15} /> Utenti</button>}<button className="icon-button" onClick={onSignOut} aria-label="Esci"><LogOut size={16} /></button></div></header><main className="portal-main"><section className="portal-hero"><div><span className="eyebrow">Workspace cloud</span><h1>I tuoi progetti</h1><p>Budget separati, accessi controllati, risorse condivise e storico completo delle versioni.</p></div>{isAdmin && <button className="button primary" onClick={() => setCreateOpen(true)}><Plus size={16} /> Nuovo progetto</button>}</section>{error && <div className="portal-alert">{error}</div>}{legacyProject && isAdmin && !localStorage.getItem(`sbs-local-migrated-${legacyProject.id}`) && <section className="migration-banner"><span className="migration-icon"><Upload size={21} /></span><div><strong>Budget locale trovato: {legacyProject.title}</strong><p>La copia originale resta nel browser. Importala ora nel database cloud per non perdere il lavoro precedente.</p></div><button className="button" disabled={busy} onClick={() => void migrate()}>{busy ? 'Importazione…' : 'Importa nel cloud'}</button></section>}<section className="portal-toolbar"><div className="search-field"><Search size={16} /><input placeholder="Cerca progetto o società…" value={query} onChange={(event) => setQuery(event.target.value)} /></div><span><Cloud size={14} /> PostgreSQL · versioni protette</span></section>{loading ? <div className="portal-empty"><Cloud size={30} /><p>Caricamento progetti…</p></div> : filtered.length === 0 ? <div className="portal-empty"><FolderKanban size={34} /><h2>{projects.length ? 'Nessun risultato' : 'Nessun progetto assegnato'}</h2><p>{isAdmin ? 'Crea il primo progetto o importa il budget locale.' : 'Chiedi all’amministratore di assegnarti un progetto.'}</p></div> : <div className="project-grid">{filtered.map((project) => <article className="project-card" key={project.id}><div className="project-card-head"><span className="project-folder"><FolderKanban size={20} /></span><span className="currency-chip">{project.currency}</span></div><h2>{project.title}</h2><p>{project.company || 'Nessuna società indicata'}</p><dl><div><dt>Ultimo salvataggio</dt><dd>{new Date(project.project_budgets[0]?.updated_at ?? project.updated_at).toLocaleString('it-IT')}</dd></div><div><dt>Versione cloud</dt><dd>v{project.project_budgets[0]?.version ?? 1}</dd></div></dl><div className="project-card-actions">{isAdmin && <button className="icon-button" onClick={() => setAccessProject(project)} aria-label="Gestisci accessi"><UsersRound size={16} /></button>}{isAdmin && <button className="icon-button" onClick={() => window.confirm(`Archiviare ${project.title}?`) && void onArchiveProject(project)} aria-label="Archivia"><Archive size={16} /></button>}<button className="button primary" onClick={() => onOpenProject(project)}>Apri <ArrowRight size={14} /></button></div></article>)}</div>}<footer className="portal-footer"><Database size={14} /> I budget sono nel database cloud; il browser conserva solo una cache locale cifrata.</footer></main>{createOpen && <Modal title="Nuovo progetto" description="Crea un budget separato con storico e permessi indipendenti." onClose={() => setCreateOpen(false)}><form className="project-create-form" onSubmit={create}><label className="field"><span>Titolo progetto</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} required /></label><label className="field"><span>Società</span><input value={company} onChange={(event) => setCompany(event.target.value)} /></label><div className="form-grid"><label><span>Valuta base</span><select value={currency} onChange={(event) => setCurrency(event.target.value)}><option>EUR</option><option>USD</option><option>GBP</option><option>CHF</option></select></label><label><span>Formato locale</span><select value={locale} onChange={(event) => setLocale(event.target.value)}><option value="it-IT">Italiano</option><option value="en-US">English (US)</option><option value="en-GB">English (UK)</option></select></label></div><div className="modal-actions"><button className="button" type="button" onClick={() => setCreateOpen(false)}>Annulla</button><button className="button primary" disabled={busy}>{busy ? 'Creazione…' : 'Crea progetto'}</button></div></form></Modal>}{accessProject && <ProjectAccess projectId={accessProject.id} projectTitle={accessProject.title} onClose={() => setAccessProject(null)} />}</div>;
}
