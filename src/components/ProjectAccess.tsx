import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Eye, Pencil, UsersRound } from 'lucide-react';
import { cloudErrorMessage, supabase, type UserProfile } from '../cloud';
import { Modal } from './Modal';

interface Membership {
  project_id: string;
  user_id: string;
  access_level: 'owner' | 'editor' | 'viewer';
}

export function ProjectAccess({ projectId, projectTitle, onClose }: { projectId: string; projectTitle: string; onClose: () => void }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const [usersResult, membersResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('enabled', true).eq('role', 'user').order('full_name'),
      supabase.from('project_members').select('project_id, user_id, access_level').eq('project_id', projectId),
    ]);
    const requestError = usersResult.error ?? membersResult.error;
    if (requestError) setError(cloudErrorMessage(requestError));
    else {
      setUsers((usersResult.data ?? []) as UserProfile[]);
      setMemberships((membersResult.data ?? []) as Membership[]);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);
  const memberMap = useMemo(() => new Map(memberships.map((membership) => [membership.user_id, membership])), [memberships]);

  const setAccess = async (userId: string, access: 'none' | 'editor' | 'viewer') => {
    if (!supabase) return;
    setBusyUser(userId); setError(null);
    const existing = memberMap.get(userId);
    const result = access === 'none'
      ? await supabase.from('project_members').delete().eq('project_id', projectId).eq('user_id', userId)
      : existing
        ? await supabase.from('project_members').update({ access_level: access }).eq('project_id', projectId).eq('user_id', userId)
        : await supabase.from('project_members').insert({ project_id: projectId, user_id: userId, access_level: access });
    if (result.error) setError(cloudErrorMessage(result.error));
    else await load();
    setBusyUser(null);
  };

  return <Modal title={`Accessi · ${projectTitle}`} description="Scegli quali utenti possono consultare o modificare questo progetto." onClose={onClose}>{error && <div className="dialog-message error-message"><AlertTriangle size={18} /><p>{error}</p></div>}<div className="access-list">{users.length === 0 ? <div className="empty-state compact-empty"><UsersRound size={28} /><h3>Nessun utente disponibile</h3><p>Crea prima un utente dalla sezione Admin.</p></div> : users.map((user) => { const access = memberMap.get(user.id)?.access_level ?? 'none'; return <div className="access-row" key={user.id}><div><strong>{user.full_name || user.email}</strong><small>{user.email}</small></div><div className="segmented-access"><button disabled={busyUser === user.id} className={access === 'none' ? 'active' : ''} onClick={() => void setAccess(user.id, 'none')}>Nessuno</button><button disabled={busyUser === user.id} className={access === 'viewer' ? 'active' : ''} onClick={() => void setAccess(user.id, 'viewer')}><Eye size={13} /> Lettura</button><button disabled={busyUser === user.id} className={access === 'editor' ? 'active' : ''} onClick={() => void setAccess(user.id, 'editor')}><Pencil size={13} /> Modifica</button></div>{access !== 'none' && <Check className="access-check" size={16} />}</div>; })}</div></Modal>;
}
