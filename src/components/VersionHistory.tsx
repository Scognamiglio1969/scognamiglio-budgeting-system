import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, History, RotateCcw } from 'lucide-react';
import { cloudErrorMessage, supabase, type ProjectVersion } from '../cloud';
import type { BudgetProject } from '../types';
import { Modal } from './Modal';

interface VersionHistoryProps {
  projectId: string;
  onClose: () => void;
  onRestored: (project: BudgetProject, version: number) => void;
}

export function VersionHistory({ projectId, onClose, onRestored }: VersionHistoryProps) {
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error: requestError } = await supabase
      .from('project_versions')
      .select('id, source_version, saved_at, reason, saved_by')
      .eq('project_id', projectId)
      .order('saved_at', { ascending: false })
      .limit(100);
    if (requestError) setError(requestError.message);
    else setVersions((data ?? []) as ProjectVersion[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const restore = async (version: ProjectVersion) => {
    if (!supabase || !window.confirm(`Ripristinare la versione ${version.source_version}? Lo stato attuale sarà conservato nello storico.`)) return;
    setRestoring(version.id);
    setError(null);
    const { data, error: requestError } = await supabase.rpc('restore_project_version', { target_version: version.id });
    setRestoring(null);
    if (requestError) return setError(cloudErrorMessage(requestError));
    const result = data as { ok: boolean; version: number; data: BudgetProject };
    if (result.ok) onRestored(result.data, result.version);
  };

  return (
    <Modal title="Versioni cloud" description="Ogni salvataggio precedente resta recuperabile. Anche i conflitti vengono conservati." onClose={onClose}>
      {error && <div className="dialog-message error-message"><AlertTriangle size={20} /><p>{error}</p></div>}
      {loading ? <div className="empty-state compact-empty"><History size={28} /><p>Caricamento versioni…</p></div> : versions.length === 0 ? <div className="empty-state compact-empty"><History size={28} /><h3>Nessuna versione precedente</h3><p>Comparirà dopo il primo aggiornamento cloud.</p></div> : <div className="version-list">{versions.map((version) => <div className="version-row" key={version.id}><div className={`version-icon ${version.reason === 'conflict-recovery' ? 'warning' : ''}`}><History size={16} /></div><div><strong>Versione {version.source_version}</strong><small>{new Date(version.saved_at).toLocaleString('it-IT')} · {version.reason === 'conflict-recovery' ? 'Copia da conflitto' : 'Salvataggio automatico'}</small></div><button className="button small" disabled={restoring !== null} onClick={() => void restore(version)}><RotateCcw size={14} /> {restoring === version.id ? 'Ripristino…' : 'Ripristina'}</button></div>)}</div>}
    </Modal>
  );
}
