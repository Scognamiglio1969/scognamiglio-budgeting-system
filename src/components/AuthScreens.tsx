import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Database, KeyRound, LoaderCircle, LockKeyhole, LogOut, Mail, ShieldCheck } from 'lucide-react';
import { cloudErrorMessage, supabase } from '../cloud';
import { validatePassword } from '../security';

function AuthFrame({ children, eyebrow = 'Accesso protetto' }: { children: React.ReactNode; eyebrow?: string }) {
  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><div className="brand-mark">S</div><div><strong>SBS</strong><span>Scognamiglio Budgeting System</span></div></div><span className="eyebrow">{eyebrow}</span>{children}</section></main>;
}

export function ConfigurationRequired() {
  return <AuthFrame eyebrow="Configurazione cloud"><div className="auth-icon"><Database size={26} /></div><h1>Database da collegare</h1><p>Il frontend è pronto, ma mancano l’URL e la chiave pubblica del progetto Supabase. Nessuna chiave amministrativa deve essere inserita nel sito.</p><div className="setup-code"><code>VITE_SUPABASE_URL</code><code>VITE_SUPABASE_PUBLISHABLE_KEY</code></div><p className="auth-note">Dopo la configurazione, questa schermata viene sostituita automaticamente dal login.</p></AuthFrame>;
}

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setMessage({ type: 'error', text: 'Email o password non corretti.' });
    setBusy(false);
  };

  const recover = async () => {
    if (!supabase || !email.trim()) return setMessage({ type: 'error', text: 'Inserisci prima la tua email.' });
    setBusy(true); setMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.href });
    setMessage(error ? { type: 'error', text: cloudErrorMessage(error) } : { type: 'success', text: 'Email di recupero inviata.' });
    setBusy(false);
  };

  return <AuthFrame><div className="auth-icon"><LockKeyhole size={26} /></div><h1>Accedi a SBS</h1><p>Solo gli utenti abilitati dall’amministratore possono vedere i progetti.</p>{message && <div className={`auth-message ${message.type}`}><AlertTriangle size={16} />{message.text}</div>}<form className="auth-form" onSubmit={login}><label><span>Email</span><div className="auth-input"><Mail size={17} /><input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div></label><label><span>Password</span><div className="auth-input"><KeyRound size={17} /><input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div></label><button className="button primary auth-submit" disabled={busy}>{busy && <LoaderCircle className="spin" size={16} />}{busy ? 'Accesso…' : 'Accedi'}</button><button className="button ghost" type="button" disabled={busy} onClick={() => void recover()}>Password dimenticata?</button></form></AuthFrame>;
}

interface ChangePasswordScreenProps {
  recovery?: boolean;
  onComplete: () => void;
  onSignOut: () => void;
}

export function ChangePasswordScreen({ recovery, onComplete, onSignOut }: ChangePasswordScreenProps) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const policy = useMemo(() => validatePassword(password), [password]);

  const change = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !policy.valid || password !== confirmation) return;
    setBusy(true); setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) setError(cloudErrorMessage(updateError));
    else onComplete();
    setBusy(false);
  };

  return <AuthFrame eyebrow={recovery ? 'Recupero account' : 'Primo accesso'}><div className="auth-icon"><ShieldCheck size={26} /></div><h1>Scegli una nuova password</h1><p>{recovery ? 'Imposta una nuova password per recuperare l’account.' : 'La password ricevuta via email è provvisoria e deve essere sostituita prima di accedere ai progetti.'}</p>{error && <div className="auth-message error"><AlertTriangle size={16} />{error}</div>}<form className="auth-form" onSubmit={change}><label><span>Nuova password</span><div className="auth-input"><KeyRound size={17} /><input autoFocus autoComplete="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div></label><div className="password-rules">{policy.rules.map((rule) => <span className={rule.passed ? 'passed' : ''} key={rule.label}><Check size={13} />{rule.label}</span>)}</div><label><span>Ripeti password</span><div className="auth-input"><KeyRound size={17} /><input autoComplete="new-password" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></div></label>{confirmation && password !== confirmation && <small className="field-error">Le password non coincidono.</small>}<button className="button primary auth-submit" disabled={busy || !policy.valid || password !== confirmation}>{busy ? 'Aggiornamento…' : 'Salva nuova password'}</button><button className="button ghost" type="button" onClick={onSignOut}><LogOut size={14} /> Esci</button></form></AuthFrame>;
}

export function AccessDisabled({ onSignOut }: { onSignOut: () => void }) {
  return <AuthFrame eyebrow="Accesso sospeso"><div className="auth-icon warning"><AlertTriangle size={26} /></div><h1>Account non abilitato</h1><p>Il tuo profilo esiste, ma l’amministratore lo ha disabilitato. I dati dei progetti restano protetti e non sono accessibili.</p><button className="button auth-submit" onClick={onSignOut}><LogOut size={15} /> Esci</button></AuthFrame>;
}

export function AuthLoading() {
  return <main className="auth-page"><div className="loading-brand"><div className="brand-mark">S</div><LoaderCircle className="spin" size={22} /><span>Connessione sicura…</span></div></main>;
}
