-- Scognamiglio Budgeting System cloud schema.
-- Run with the Supabase CLI or paste into the Supabase SQL editor.

create extension if not exists citext with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email extensions.citext not null unique,
  full_name text not null default '',
  role text not null default 'user' check (role in ('admin', 'user')),
  enabled boolean not null default false,
  must_change_password boolean not null default true,
  password_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  company text not null default '',
  currency text not null default 'EUR',
  currency_locale text not null default 'it-IT',
  archived boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  access_level text not null default 'editor' check (access_level in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.project_budgets (
  project_id uuid primary key references public.projects(id) on delete cascade,
  data jsonb not null,
  version bigint not null default 1 check (version > 0),
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.project_versions (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  source_version bigint not null,
  data jsonb not null,
  saved_by uuid references public.profiles(id) on delete set null,
  saved_at timestamptz not null default now(),
  reason text not null default 'autosave'
);

create table public.shared_resources (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null check (resource_type in ('department', 'library', 'rate-card', 'fringe-set', 'text')),
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  payload jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  archived boolean not null default false,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_members_user_idx on public.project_members(user_id);
create index project_versions_project_idx on public.project_versions(project_id, saved_at desc);
create index shared_resources_type_idx on public.shared_resources(resource_type, updated_at desc);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_budgets enable row level security;
alter table public.project_versions enable row level security;
alter table public.shared_resources enable row level security;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger projects_touch_updated_at
before update on public.projects
for each row execute function public.touch_updated_at();

create trigger shared_resources_touch_updated_at
before update on public.shared_resources
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.handle_auth_password_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.encrypted_password is distinct from new.encrypted_password then
    update public.profiles
      set must_change_password = false,
          password_changed_at = now()
      where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_password_changed
after update of encrypted_password on auth.users
for each row execute function public.handle_auth_password_change();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and enabled
      and not must_change_password
  );
$$;

create or replace function public.can_access_project(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1
    from public.project_members membership
    join public.profiles profile on profile.id = membership.user_id
    where membership.project_id = target_project
      and membership.user_id = (select auth.uid())
      and profile.enabled
      and not profile.must_change_password
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and enabled
      and not must_change_password
  );
$$;

create or replace function public.can_edit_project(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1
    from public.project_members membership
    join public.profiles profile on profile.id = membership.user_id
    where membership.project_id = target_project
      and membership.user_id = (select auth.uid())
      and membership.access_level in ('owner', 'editor')
      and profile.enabled
      and not profile.must_change_password
  );
$$;

create policy profiles_read_self_or_admin
on public.profiles for select to authenticated
using ((select auth.uid()) = id or public.is_admin());

create policy profiles_admin_update
on public.profiles for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy projects_read_members
on public.projects for select to authenticated
using (public.can_access_project(id));

create policy projects_admin_insert
on public.projects for insert to authenticated
with check (public.is_admin());

create policy projects_admin_update
on public.projects for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy projects_admin_delete
on public.projects for delete to authenticated
using (public.is_admin());

create policy memberships_read_self_or_admin
on public.project_members for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

create policy memberships_admin_insert
on public.project_members for insert to authenticated
with check (public.is_admin());

create policy memberships_admin_update
on public.project_members for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy memberships_admin_delete
on public.project_members for delete to authenticated
using (public.is_admin());

create policy budgets_read_members
on public.project_budgets for select to authenticated
using (public.can_access_project(project_id));

create policy budgets_edit_members
on public.project_budgets for update to authenticated
using (public.can_edit_project(project_id))
with check (public.can_edit_project(project_id));

create policy versions_read_members
on public.project_versions for select to authenticated
using (public.can_access_project(project_id));

create policy shared_resources_read_active_users
on public.shared_resources for select to authenticated
using (public.is_active_user());

create policy shared_resources_create_active_users
on public.shared_resources for insert to authenticated
with check (public.is_active_user() and created_by = (select auth.uid()) and updated_by = (select auth.uid()));

create policy shared_resources_update_owner_or_admin
on public.shared_resources for update to authenticated
using (public.is_admin() or (public.is_active_user() and created_by = (select auth.uid())))
with check (public.is_admin() or (public.is_active_user() and created_by = (select auth.uid())));

create policy shared_resources_delete_owner_or_admin
on public.shared_resources for delete to authenticated
using (public.is_admin() or (public.is_active_user() and created_by = (select auth.uid())));

create or replace function public.archive_budget_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.project_versions (project_id, source_version, data, saved_by, saved_at, reason)
  values (old.project_id, old.version, old.data, old.updated_by, old.updated_at, 'autosave');
  return new;
end;
$$;

create trigger before_budget_replaced
before update of data on public.project_budgets
for each row
when (old.data is distinct from new.data)
execute function public.archive_budget_version();

create or replace function public.create_project(
  project_title text,
  project_company text,
  project_currency text,
  project_locale text,
  initial_data jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_project_id uuid;
  normalized_data jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can create projects' using errcode = '42501';
  end if;

  insert into public.projects (title, company, currency, currency_locale, created_by)
  values (trim(project_title), coalesce(project_company, ''), project_currency, project_locale, (select auth.uid()))
  returning id into new_project_id;

  normalized_data := jsonb_set(initial_data, '{id}', to_jsonb(new_project_id::text), true);
  normalized_data := jsonb_set(normalized_data, '{syncMode}', '"cloud"'::jsonb, true);

  insert into public.project_members (project_id, user_id, access_level)
  values (new_project_id, (select auth.uid()), 'owner');

  insert into public.project_budgets (project_id, data, updated_by)
  values (new_project_id, normalized_data, (select auth.uid()));

  return new_project_id;
end;
$$;

create or replace function public.save_project_budget(
  target_project uuid,
  expected_version bigint,
  next_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_version bigint;
  new_version bigint;
begin
  if not public.can_edit_project(target_project) then
    raise exception 'Project is read only' using errcode = '42501';
  end if;

  select version into current_version
  from public.project_budgets
  where project_id = target_project
  for update;

  if current_version is null then
    raise exception 'Project budget not found' using errcode = 'P0002';
  end if;

  if current_version <> expected_version then
    insert into public.project_versions (project_id, source_version, data, saved_by, reason)
    values (target_project, expected_version, next_data, (select auth.uid()), 'conflict-recovery');

    return jsonb_build_object(
      'ok', false,
      'conflict', true,
      'version', current_version,
      'message', 'A recovery copy was saved because the project changed elsewhere.'
    );
  end if;

  next_data := jsonb_set(next_data, '{id}', to_jsonb(target_project::text), true);
  next_data := jsonb_set(next_data, '{syncMode}', '"cloud"'::jsonb, true);

  update public.project_budgets
  set data = next_data,
      version = version + 1,
      updated_by = (select auth.uid()),
      updated_at = now()
  where project_id = target_project
  returning version into new_version;

  update public.projects
  set title = coalesce(nullif(trim(next_data ->> 'title'), ''), title),
      company = coalesce(next_data ->> 'company', company),
      currency = coalesce(next_data ->> 'currency', currency),
      currency_locale = coalesce(next_data ->> 'currencyLocale', currency_locale)
  where id = target_project;

  return jsonb_build_object('ok', true, 'conflict', false, 'version', new_version);
end;
$$;

create or replace function public.restore_project_version(target_version bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_version public.project_versions%rowtype;
  restored_version bigint;
begin
  select * into selected_version from public.project_versions where id = target_version;
  if selected_version.id is null then
    raise exception 'Version not found' using errcode = 'P0002';
  end if;
  if not public.can_edit_project(selected_version.project_id) then
    raise exception 'Project is read only' using errcode = '42501';
  end if;

  update public.project_budgets
  set data = selected_version.data,
      version = version + 1,
      updated_by = (select auth.uid()),
      updated_at = now()
  where project_id = selected_version.project_id
  returning version into restored_version;

  return jsonb_build_object('ok', true, 'version', restored_version, 'data', selected_version.data);
end;
$$;

-- This helper can only be invoked from the SQL editor/service role and bootstraps
-- the first administrator after creating that user in Authentication > Users.
create or replace function public.bootstrap_admin(admin_email extensions.citext)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set role = 'admin', enabled = true, must_change_password = false
  where email = admin_email;
  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.can_access_project(uuid) from public, anon;
revoke all on function public.can_edit_project(uuid) from public, anon;
revoke all on function public.is_active_user() from public, anon;
revoke all on function public.create_project(text, text, text, text, jsonb) from public, anon;
revoke all on function public.save_project_budget(uuid, bigint, jsonb) from public, anon;
revoke all on function public.restore_project_version(bigint) from public, anon;
revoke all on function public.bootstrap_admin(extensions.citext) from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_access_project(uuid) to authenticated;
grant execute on function public.can_edit_project(uuid) to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.create_project(text, text, text, text, jsonb) to authenticated;
grant execute on function public.save_project_budget(uuid, bigint, jsonb) to authenticated;
grant execute on function public.restore_project_version(bigint) to authenticated;

revoke insert, update, delete on public.project_versions from anon, authenticated;
revoke insert, delete on public.project_budgets from anon, authenticated;
