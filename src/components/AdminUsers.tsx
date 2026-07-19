import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, MailPlus, Power, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import { cloudErrorMessage, supabase, type UserProfile } from '../cloud';
import { Modal } from './Modal';

export function AdminUsers({ currentUserId, onClose }: { currentUserId: string; onClose: () => void }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('*').order('created_at');
    if (error) setMessage({ type: 'error', text: cloudErrorMessage(error) });
    else setUsers((data ?? []) as UserProfile[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setMessage(null);
    const { error } = await supabase.functions.invoke('admin-create-user', { body: { email, fullName } });
    if (error) setMessage({ type: 'error', text: cloudErrorMessage(error) });
    else {
      setMessage({ type: 'success', text: `Utente creato. La password provvisoria è stata inviata a ${email}.` });
      setEmail(''); setFullName(''); await load();
    }
    setBusy(false);
  };

  const toggle = async (user: UserProfile) => {
    if (!supabase || user.id === currentUserId) return;
    setBusy(true); setMessage(null);
    const { error } = await supabase.from('profiles').update({ enabled: !user.enabled }).eq('id', user.id);
    if (error) setMessage({ type: 'error', text: cloudErrorMessage(error) });
    else await load();
    setBusy(false);
  };

  return <Modal title="Admin · Utenti" description="Crea gli accessi, invia la password provvisoria e abilita o sospendi gli utenti." onClose={onClose} wide><div className="admin-layout"><form className="invite-panel" onSubmit={invite}><div className="heading-with-icon"><span className="section-icon purple"><MailPlus size={18} /></span><div><span className="section-kicker">Nuovo accesso</span><h3>Invita utente</h3></div></div><label className="field"><span>Nome e cognome</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label><label className="field"><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><p className="auth-note">SBS genera una password forte, la invia via email e obbliga l’utente a cambiarla al primo accesso.</p><button className="button primary" disabled={busy}><MailPlus size={15} /> {busy ? 'Invio…' : 'Crea e invia accesso'}</button></form><section className="users-panel"><div className="panel-heading"><div><span className="section-kicker">Accessi registrati</span><h2>{users.length} utenti</h2></div><button className="icon-button" onClick={() => void load()} aria-label="Aggiorna"><RefreshCw size={16} /></button></div>{message && <div className={`inline-message ${message.type}`}><AlertTriangle size={16} />{message.text}</div>}<div className="user-list">{loading ? <p className="muted padded-copy">Caricamento…</p> : users.map((user) => <div className="user-row" key={user.id}><span className={`user-avatar ${user.role}`}><UserRound size={16} /></span><div><strong>{user.full_name || 'Nome non indicato'} {user.id === currentUserId && <em>Tu</em>}</strong><small>{user.email}</small></div><span className={`access-badge ${user.role}`}><ShieldCheck size={12} />{user.role === 'admin' ? 'Admin' : 'Utente'}</span><span className={`access-badge ${user.must_change_password ? 'pending' : 'ready'}`}>{user.must_change_password ? 'Password provvisoria' : <><Check size={12} /> Attivo</>}</span><button className={`button tiny ${user.enabled ? 'danger-button' : ''}`} disabled={busy || user.id === currentUserId} onClick={() => void toggle(user)}><Power size={13} />{user.enabled ? 'Sospendi' : 'Abilita'}</button></div>)}</div></section></div></Modal>;
}
