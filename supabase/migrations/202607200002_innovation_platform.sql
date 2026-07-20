-- Privacy-preserving aggregate samples. No project id, user id, title, company,
-- line item, location or free text is stored in this table.
create table public.benchmark_samples (
  id bigint generated always as identity primary key,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  production_type text not null check (production_type in ('film', 'tv', 'documentary', 'commercial', 'other')),
  budget_band text not null check (budget_band in ('micro', 'small', 'medium', 'large')),
  cost_per_shoot_day numeric not null check (cost_per_shoot_day between 0 and 100000000),
  labor_share numeric not null check (labor_share between 0 and 1),
  equipment_share numeric not null check (equipment_share between 0 and 1),
  fringe_share numeric not null check (fringe_share between 0 and 1),
  incentive_share numeric not null check (incentive_share between 0 and 1),
  account_shares jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default now()
);

create index benchmark_cohort_idx on public.benchmark_samples(country_code, production_type, budget_band);
alter table public.benchmark_samples enable row level security;
-- Deliberately no direct client policies. The authenticated Edge Function validates,
-- inserts with the service role and withholds aggregates for cohorts smaller than five.

comment on table public.benchmark_samples is
'Anonymous coarse production metrics. Never store project, user, company, title, line-item or free-text identifiers.';
