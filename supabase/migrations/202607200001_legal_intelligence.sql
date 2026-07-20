-- Auditable, project-scoped searches against curated official legislation sources.
-- The application budget JSON stores the selected jurisdiction and approved rule provenance.

create table public.legal_search_audit (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  query text not null check (length(query) between 3 and 160),
  source_name text not null,
  result_count integer not null default 0 check (result_count >= 0),
  result_metadata jsonb not null default '[]'::jsonb,
  searched_at timestamptz not null default now()
);

create index legal_search_project_idx on public.legal_search_audit(project_id, searched_at desc);
alter table public.legal_search_audit enable row level security;

create policy legal_search_read_project_members
on public.legal_search_audit for select to authenticated
using (public.can_access_project(project_id));

create policy legal_search_insert_project_members
on public.legal_search_audit for insert to authenticated
with check (
  public.can_access_project(project_id)
  and public.is_active_user()
  and user_id = (select auth.uid())
);

comment on table public.legal_search_audit is
'Immutable audit metadata for legislation searches. It stores links and result metadata, not authoritative legal text.';
