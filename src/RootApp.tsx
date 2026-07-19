import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import App from './App';
import {
  cloudConfigured, cloudErrorMessage, supabase, type CloudBudgetRecord,
  type CloudProjectSummary, type SyncStatus, type UserProfile,
} from './cloud';
import { createSeedProject } from './seed';
import { readLegacyProject } from './store';
import type { BudgetProject } from './types';
import { loadSecureProject, saveSecureProject } from './secureCache';
import {
  AccessDisabled, AuthLoading, ChangePasswordScreen, ConfigurationRequired, LoginScreen,
} from './components/AuthScreens';
import { ProjectPortal } from './components/ProjectPortal';
import { AdminUsers } from './components/AdminUsers';

interface SelectedProject {
  summary: CloudProjectSummary;
  data: BudgetProject;
  version: number;
  instance: number;
  canEdit: boolean;
}

function AuthenticatedApplication({ session, profile, reloadProfile, recovery, clearRecovery }: {
  session: Session;
  profile: UserProfile;
  reloadProfile: () => Promise<void>;
  recovery: boolean;
  clearRecovery: () => void;
}) {
  const [projects, setProjects] = useState<CloudProjectSummary[]>([]);
  const [selected, setSelected] = useState<SelectedProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminOpen, setAdminOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('saved');
  const versionRef = useRef(1);
  const lastSyncedRef = useRef('');

  const signOut = useCallback(async () => { await supabase?.auth.signOut(); }, []);

  const loadProjects = useCallback(async () => {
    if (!supabase) return;
    setLoading(true); setError(null);
    const { data, error: requestError } = await supabase
      .from('projects')
      .select('id, title, company, currency, currency_locale, archived, created_at, updated_at, project_budgets(version, updated_at)')
      .eq('archived', false)
      .order('updated_at', { ascending: false });
    if (requestError) setError(cloudErrorMessage(requestError));
    else setProjects((data ?? []) as CloudProjectSummary[]);
    setLoading(false);
  }, []);

  useEffect(() => { void loadProjects(); }, [loadProjects]);

  const openProject = useCallback(async (summary: CloudProjectSummary) => {
    if (!supabase) return;
    setLoading(true); setError(null);
    const [remoteResult, cached, membershipResult] = await Promise.all([
      supabase.from('project_budgets').select('project_id, data, version, updated_at').eq('project_id', summary.id).single(),
      loadSecureProject(session.user.id, summary.id),
      profile.role === 'admin'
        ? Promise.resolve({ data: { access_level: 'owner' }, error: null })
        : supabase.from('project_members').select('access_level').eq('project_id', summary.id).eq('user_id', session.user.id).single(),
    ]);
    const canEdit = profile.role === 'admin' || ['owner', 'editor'].includes(membershipResult.data?.access_level ?? '');
    if (remoteResult.error) {
      if (cached) {
        versionRef.current = summary.project_budgets[0]?.version ?? 1;
        lastSyncedRef.current = '';
        setSelected({ summary, data: cached, version: versionRef.current, instance: Date.now(), canEdit });
        setSyncStatus('offline');
      } else setError(cloudErrorMessage(remoteResult.error));
      setLoading(false);
      return;
    }

    const remote = remoteResult.data as CloudBudgetRecord;
    const remoteProject = remote.data;
    const cachedIsNewer = cached && new Date(cached.updatedAt).getTime() > new Date(remoteProject.updatedAt).getTime();
    versionRef.current = remote.version;
    lastSyncedRef.current = JSON.stringify(remoteProject);
    setSelected({ summary, data: cachedIsNewer ? cached : remoteProject, version: remote.version, instance: Date.now(), canEdit });
    setSyncStatus(cachedIsNewer ? 'saving' : 'saved');
    setLoading(false);
  }, [session.user.id, profile.role]);

  const persist = useCallback(async (project: BudgetProject) => {
    if (!supabase || !selected) return;
    try { await saveSecureProject(session.user.id, project); } catch { /* Cloud remains the primary copy. */ }
    const serialized = JSON.stringify(project);
    if (serialized === lastSyncedRef.current) return;
    if (!navigator.onLine) return setSyncStatus('offline');

    setSyncStatus('saving');
    const { data, error: requestError } = await supabase.rpc('save_project_budget', {
      target_project: selected.summary.id,
      expected_version: versionRef.current,
      next_data: project,
    });
    if (requestError) return setSyncStatus('error');
    const result = data as { ok: boolean; conflict: boolean; version: number };
    versionRef.current = Number(result.version);
    if (result.conflict) {
      setSyncStatus('conflict');
      return;
    }
    lastSyncedRef.current = serialized;
    setSyncStatus('saved');
  }, [selected, session.user.id]);

  const createProject = async ({ title, company, currency, locale, data }: { title: string; company: string; currency: string; locale: string; data?: BudgetProject }) => {
    if (!supabase) return;
    setError(null);
    const initial = structuredClone(data ?? createSeedProject());
    initial.title = title;
    initial.company = company;
    initial.currency = currency;
    initial.currencyLocale = locale;
    initial.updatedAt = new Date().toISOString();
    const { error: requestError } = await supabase.rpc('create_project', {
      project_title: title,
      project_company: company,
      project_currency: currency,
      project_locale: locale,
      initial_data: initial,
    });
    if (requestError) setError(cloudErrorMessage(requestError));
    else await loadProjects();
  };

  const archiveProject = async (project: CloudProjectSummary) => {
    if (!supabase) return;
    const { error: requestError } = await supabase.from('projects').update({ archived: true }).eq('id', project.id);
    if (requestError) setError(cloudErrorMessage(requestError));
    else await loadProjects();
  };

  const downloadBackup = async () => {
    if (!supabase || profile.role !== 'admin') return;
    setError(null);
    const [projectResult, budgetResult, versionResult, resourceResult, memberResult] = await Promise.all([
      supabase.from('projects').select('*').order('created_at'),
      supabase.from('project_budgets').select('*'),
      supabase.from('project_versions').select('*').order('saved_at'),
      supabase.from('shared_resources').select('*').order('created_at'),
      supabase.from('project_members').select('*'),
    ]);
    const requestError = projectResult.error ?? budgetResult.error ?? versionResult.error ?? resourceResult.error ?? memberResult.error;
    if (requestError) return setError(cloudErrorMessage(requestError));
    const backup = {
      format: 'sbs-cloud-backup', version: 1, exportedAt: new Date().toISOString(),
      projects: projectResult.data, budgets: budgetResult.data, versions: versionResult.data,
      sharedResources: resourceResult.data, projectMembers: memberResult.data,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `SBS-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const restored = (project: BudgetProject, version: number) => {
    if (!selected) return;
    versionRef.current = version;
    lastSyncedRef.current = JSON.stringify(project);
    setSelected({ ...selected, data: project, version, instance: Date.now() });
    setSyncStatus('saved');
  };

  if (recovery || profile.must_change_password) return <ChangePasswordScreen recovery={recovery} onSignOut={() => void signOut()} onComplete={() => { clearRecovery(); void reloadProfile(); }} />;
  if (!profile.enabled) return <AccessDisabled onSignOut={() => void signOut()} />;

  if (selected) return <><App key={`${selected.summary.id}:${selected.instance}`} initialProject={selected.data} profile={profile} syncStatus={syncStatus} readOnly={!selected.canEdit} onPersist={persist} onBackProjects={() => { setSelected(null); void loadProjects(); }} onSignOut={() => void signOut()} onOpenAdmin={() => setAdminOpen(true)} onRestored={restored} />{adminOpen && <AdminUsers currentUserId={session.user.id} onClose={() => setAdminOpen(false)} />}</>;

  return <><ProjectPortal profile={profile} projects={projects} loading={loading} legacyProject={readLegacyProject()} error={error} onOpenProject={(project) => void openProject(project)} onCreateProject={createProject} onArchiveProject={archiveProject} onOpenAdmin={() => setAdminOpen(true)} onDownloadBackup={downloadBackup} onSignOut={() => void signOut()} />{adminOpen && <AdminUsers currentUserId={session.user.id} onClose={() => setAdminOpen(false)} />}</>;
}

export default function RootApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [recovery, setRecovery] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!supabase) return;
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) return;
    setProfileLoading(true);
    const { data } = await supabase.from('profiles').select('*').eq('id', currentSession.user.id).single();
    setProfile((data as UserProfile | null) ?? null);
    setProfileLoading(false);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (!nextSession) setProfile(null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => { if (session) void loadProfile(); }, [session?.user.id, loadProfile]);

  if (!cloudConfigured) return <ConfigurationRequired />;
  if (session === undefined || (session && profileLoading && !profile)) return <AuthLoading />;
  if (!session) return <LoginScreen />;
  if (!profile) return <AccessDisabled onSignOut={() => void supabase?.auth.signOut()} />;
  return <AuthenticatedApplication session={session} profile={profile} reloadProfile={loadProfile} recovery={recovery} clearRecovery={() => setRecovery(false)} />;
}
