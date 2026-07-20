import { createClient } from '@supabase/supabase-js';
import type { BudgetProject } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const cloudConfigured = Boolean(supabaseUrl && publishableKey);
export const supabase = cloudConfigured
  ? createClient(supabaseUrl!, publishableKey!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  : null;

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'user';
  enabled: boolean;
  must_change_password: boolean;
  password_changed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CloudProjectSummary {
  id: string;
  title: string;
  company: string;
  currency: string;
  currency_locale: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
  project_budgets: Array<{ version: number; updated_at: string }>;
}

export interface CloudBudgetRecord {
  project_id: string;
  data: BudgetProject;
  version: number;
  updated_at: string;
}

export interface ProjectVersion {
  id: number;
  source_version: number;
  saved_at: string;
  reason: 'autosave' | 'conflict-recovery' | string;
  saved_by: string | null;
}

export interface SharedResource {
  id: string;
  resource_type: 'department' | 'library' | 'rate-card' | 'fringe-set' | 'text';
  name: string;
  description: string;
  payload: Record<string, unknown>;
  tags: string[];
  archived: boolean;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export type SyncStatus = 'saved' | 'saving' | 'offline' | 'conflict' | 'error' | 'demo';

export interface LegalSearchResult {
  id: string;
  title: string;
  description: string;
  authority: string;
  sourceUrl: string;
  actDate: string | null;
  publicationDate: string | null;
  officialGazette: string | null;
  countryCode: string;
}

export interface LegalSearchResponse {
  query: string;
  countryCode: string;
  checkedAt: string;
  source: { name: string; url: string; official: true; mode: 'api' | 'portal' };
  results: LegalSearchResult[];
  total: number;
  disclaimer: string;
}

export async function searchOfficialLegislation(countryCode: string, query: string, projectId?: string) {
  if (!supabase) throw new Error('Cloud non configurato');
  const { data, error } = await supabase.functions.invoke<LegalSearchResponse>('legal-search', {
    body: { countryCode, query, projectId },
  });
  if (error) throw error;
  if (!data) throw new Error('Risposta normativa vuota');
  return data;
}

export interface BenchmarkAggregate {
  cohortSize: number;
  withheld: boolean;
  averages?: { costPerShootDay: number; laborShare: number; equipmentShare: number; fringeShare: number; incentiveShare: number };
}

export async function submitAnonymousBenchmark(metrics: Record<string, unknown>) {
  if (!supabase) throw new Error('Cloud non configurato');
  const { data, error } = await supabase.functions.invoke<BenchmarkAggregate>('benchmark-submit', { body: { metrics } });
  if (error) throw error;
  if (!data) throw new Error('Risposta benchmark vuota');
  return data;
}

export function cloudErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'Operazione cloud non riuscita.';
}
