import { useRef, useState } from 'react';
import {
  BarChart3, ChevronDown, Cloud, Download, FileJson, FileSpreadsheet, GitCompareArrows,
  FolderKanban, History, LibraryBig, LogOut, Menu, PanelLeftClose, Percent, Printer, Redo2,
  Share2, ShieldCheck, Sparkles, TableProperties, Undo2, Upload, UserRound, Variable, X,
} from 'lucide-react';
import { useBudgetStore } from './store';
import { createMoneyFormatter, relativeTime } from './helpers';
import { exportProjectJson, exportScenarioCsv, exportScenarioXlsx } from './exporters';
import type { AppView, BudgetProject } from './types';
import { TopsheetView } from './views/TopsheetView';
import { BudgetView } from './views/BudgetView';
import { GlobalsView } from './views/GlobalsView';
import { FringesView } from './views/FringesView';
import { ScenariosView } from './views/ScenariosView';
import { LibrariesView } from './views/LibrariesView';
import { Modal } from './components/Modal';
import type { SyncStatus, UserProfile } from './cloud';
import { VersionHistory } from './components/VersionHistory';
import { SharedResourcesView } from './views/SharedResourcesView';
import { ComplianceView } from './views/ComplianceView';
import { InnovationLabView } from './views/InnovationLabView';
import { parseOpenSbsProject } from './openSbs';

const navItems: Array<{ id: AppView; label: string; description: string; icon: React.ReactNode }> = [
  { id: 'topsheet', label: 'Topsheet', description: 'Sintesi generale', icon: <BarChart3 size={18} /> },
  { id: 'budget', label: 'Budget', description: 'Account e dettagli', icon: <TableProperties size={18} /> },
  { id: 'globals', label: 'Globali', description: 'Variabili e valute', icon: <Variable size={18} /> },
  { id: 'fringes', label: 'Fringe & gruppi', description: 'Tasse e contributi', icon: <Percent size={18} /> },
  { id: 'scenarios', label: 'Scenari', description: 'Confronti e storico', icon: <GitCompareArrows size={18} /> },
  { id: 'libraries', label: 'Librerie', description: 'Template riutilizzabili', icon: <LibraryBig size={18} /> },
  { id: 'resources', label: 'Risorse condivise', description: 'Tra tutti i progetti', icon: <Share2 size={18} /> },
  { id: 'compliance', label: 'Legal & Intelligence', description: 'Normativa e controlli', icon: <ShieldCheck size={18} /> },
  { id: 'lab', label: 'Production Lab', description: 'Motori avanzati 1–12', icon: <Sparkles size={18} /> },
];

interface AppProps {
  initialProject: BudgetProject;
  profile: UserProfile;
  syncStatus: SyncStatus;
  readOnly: boolean;
  onPersist: (project: BudgetProject) => void | Promise<void>;
  onBackProjects: () => void;
  onSignOut: () => void;
  onOpenAdmin: () => void;
  onRestored: (project: BudgetProject, version: number) => void;
  demoMode?: boolean;
}

const syncCopy: Record<SyncStatus, { label: string; detail: string }> = {
  saved: { label: 'Cloud', detail: 'salvato' },
  saving: { label: 'Cloud', detail: 'salvataggio…' },
  offline: { label: 'Cache sicura', detail: 'offline' },
  conflict: { label: 'Versione protetta', detail: 'conflitto' },
  error: { label: 'Cache sicura', detail: 'da sincronizzare' },
  demo: { label: 'Demo', detail: 'sandbox locale' },
};

export default function App({
  initialProject, profile, syncStatus, readOnly, onPersist, onBackProjects, onSignOut, onOpenAdmin, onRestored, demoMode = false,
}: AppProps) {
  const store = useBudgetStore(initialProject, { onPersist });
  const { project, activeScenario } = store;
  const commit = readOnly ? (() => undefined) as typeof store.commit : store.commit;
  const mutateActiveData = readOnly ? (() => undefined) as typeof store.mutateActiveData : store.mutateActiveData;
  const undo = readOnly ? () => undefined : store.undo;
  const redo = readOnly ? () => undefined : store.redo;
  const canUndo = !readOnly && store.canUndo;
  const canRedo = !readOnly && store.canRedo;
  const [view, setView] = useState<AppView>('topsheet');
  const [focusAccountId, setFocusAccountId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const money = createMoneyFormatter(project.currency, project.currencyLocale);

  const navigate = (next: AppView) => { setView(next); setSidebarOpen(false); if (next !== 'budget') setFocusAccountId(null); };
  const openAccount = (accountId: string) => { setFocusAccountId(accountId); setView('budget'); };

  const importFile = async (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension === 'mbd' || extension === 'mmbx') {
      setImportMessage('legacy');
      return;
    }
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const imported = parseOpenSbsProject(parsed);
      commit((draft) => Object.assign(draft, imported), `Open SBS project imported from ${file.name}`);
      setImportMessage('success');
    } catch {
      setImportMessage('error');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
        <div className="brand-block"><div className="brand-mark">S</div><div><strong>SBS</strong><span>Scognamiglio<br />Budgeting System</span></div><button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Chiudi navigazione"><X size={19} /></button></div>
        <nav className="main-nav" aria-label="Navigazione principale">{navItems.map((item) => <button key={item.id} type="button" className={view === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><span className="nav-icon">{item.icon}</span><span><strong>{item.label}</strong><small>{item.description}</small></span></button>)}</nav>
        <div className="sidebar-project">
          <span className="section-kicker">Progetto attivo</span><strong>{project.title}</strong><span>{project.company}</span>
          <button className="project-switch" type="button" onClick={onBackProjects}><FolderKanban size={14} /> {demoMode ? 'Torna all’accesso' : 'Tutti i progetti'}</button>
          <div className={`cloud-state cloud-${syncStatus}`}><Cloud size={14} /><span>{syncCopy[syncStatus].label}</span><em>{syncCopy[syncStatus].detail}</em></div>
        </div>
        <div className="sidebar-account">
          <UserRound size={16} /><span><strong>{profile.full_name || profile.email}</strong><small>{profile.role === 'admin' ? 'Amministratore' : 'Utente abilitato'}</small></span>
          {profile.role === 'admin' && <button type="button" onClick={onOpenAdmin} aria-label="Gestisci utenti"><ShieldCheck size={15} /></button>}
          <button type="button" onClick={onSignOut} aria-label="Esci"><LogOut size={15} /></button>
        </div>
        <div className="sidebar-footer"><span>Scognamiglio Budgeting System</span><small>Cloud Edition · v1.0</small></div>
      </aside>
      {sidebarOpen && <button className="sidebar-scrim" aria-label="Chiudi menu" onClick={() => setSidebarOpen(false)} />}

      <main className="app-main">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setSidebarOpen(true)} aria-label="Apri navigazione"><Menu size={20} /></button>
          <div className="project-breadcrumb"><span>{project.title}</span><span className="breadcrumb-separator">/</span><button onClick={() => setView('scenarios')}>{activeScenario.name}<ChevronDown size={14} /></button></div>
          <div className="topbar-actions">
            <span className={`save-state save-${syncStatus}`}><span className="status-dot" /> {syncCopy[syncStatus].detail} · {relativeTime(project.updatedAt)}</span>
            <div className="undo-group"><button className="icon-button" disabled={!canUndo} onClick={undo} aria-label="Annulla"><Undo2 size={17} /></button><button className="icon-button" disabled={!canRedo} onClick={redo} aria-label="Ripristina"><Redo2 size={17} /></button></div>
            {!demoMode && <button className="icon-button" onClick={() => setVersionsOpen(true)} aria-label="Versioni cloud"><History size={17} /></button>}
            {!demoMode && <><input ref={fileInput} className="sr-only" type="file" accept=".json,.mbd,.mmbx,application/vnd.open-sbs+json" onChange={(event) => event.target.files?.[0] && void importFile(event.target.files[0])} /><button className="button compact-button" onClick={() => fileInput.current?.click()}><Upload size={16} /> <span>Importa</span></button></>}
            <div className="export-menu-wrap"><button className="button primary compact-button" onClick={() => setExportOpen(!exportOpen)}><Download size={16} /> <span>Esporta</span><ChevronDown size={14} /></button>{exportOpen && <div className="export-menu"><button onClick={() => { window.print(); setExportOpen(false); }}><Printer size={16} /><span><strong>PDF / Stampa</strong><small>Report Topsheet</small></span></button><button onClick={() => { exportScenarioXlsx(project, activeScenario); setExportOpen(false); }}><FileSpreadsheet size={16} /><span><strong>Microsoft Excel</strong><small>Foglio .xlsx completo</small></span></button><button onClick={() => { exportScenarioCsv(project, activeScenario); setExportOpen(false); }}><FileSpreadsheet size={16} /><span><strong>CSV universale</strong><small>Compatibile con fogli di calcolo</small></span></button><button onClick={() => { exportProjectJson(project); setExportOpen(false); }}><FileJson size={16} /><span><strong>Open SBS Standard</strong><small>Archivio JSON v2 interoperabile</small></span></button></div>}</div>
          </div>
        </header>

        <div className="content-area">
          {demoMode && <div className="read-only-banner"><Sparkles size={15} /> Sandbox interattiva · puoi provare ogni modifica; al ricaricamento i dati dimostrativi vengono ripristinati</div>}
          {readOnly && !demoMode && <div className="read-only-banner"><ShieldCheck size={15} /> Accesso in sola lettura · le modifiche sono disabilitate</div>}
          {view === 'topsheet' && <TopsheetView scenario={activeScenario} money={money} onOpenAccount={openAccount} />}
          {view === 'budget' && <BudgetView data={activeScenario.data} money={money} baseCurrency={project.currency} focusAccountId={focusAccountId} mutate={mutateActiveData} />}
          {view === 'globals' && <GlobalsView data={activeScenario.data} baseCurrency={project.currency} mutate={mutateActiveData} />}
          {view === 'fringes' && <FringesView data={activeScenario.data} money={money} mutate={mutateActiveData} />}
          {view === 'scenarios' && <ScenariosView project={project} money={money} commit={commit} />}
          {view === 'libraries' && <LibrariesView project={project} data={activeScenario.data} commit={commit} mutate={mutateActiveData} />}
          {view === 'resources' && <SharedResourcesView profile={profile} project={project} data={activeScenario.data} commit={commit} mutate={mutateActiveData} demoMode={demoMode} />}
          {view === 'compliance' && <ComplianceView project={project} money={money} readOnly={readOnly} commit={commit} demoMode={demoMode} />}
          {view === 'lab' && <InnovationLabView project={project} money={money} readOnly={readOnly} commit={commit} demoMode={demoMode} />}
        </div>
      </main>

      {importMessage && <Modal title={importMessage === 'success' ? 'Importazione completata' : importMessage === 'legacy' ? 'Bridge MMB legacy' : 'File non riconosciuto'} onClose={() => setImportMessage(null)}>{importMessage === 'success' && <div className="dialog-message success-message"><FileJson size={24} /><p>Il progetto SBS è stato importato ed è in coda per il salvataggio cloud.</p></div>}{importMessage === 'error' && <div className="dialog-message error-message"><p>Il file non contiene un archivio SBS valido. Esporta il progetto in formato JSON e riprova.</p></div>}{importMessage === 'legacy' && <div className="dialog-message legacy-message"><PanelLeftClose size={24} /><div><p><strong>I file .mbd e .mmbx sono formati proprietari.</strong></p><p>Per evitare conversioni incomplete, esporta il budget da Movie Magic come <strong>JSON Advanced</strong>. Il bridge SBS manterrà account, dettagli, globali, fringe, gruppi e location; il mapping diretto del binario legacy verrà abilitato dopo la validazione su un file campione.</p></div></div>}<div className="modal-actions"><button className="button primary" onClick={() => setImportMessage(null)}>Ho capito</button></div></Modal>}
      {versionsOpen && <VersionHistory projectId={project.id} onClose={() => setVersionsOpen(false)} onRestored={(restored, version) => { onRestored(restored, version); setVersionsOpen(false); }} />}
    </div>
  );
}
