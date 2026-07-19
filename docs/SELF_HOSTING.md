# Self-hosting SBS

This guide describes the minimum production architecture. It does not replace a security review or disaster-recovery plan.

## Components

- A static host for the Vite frontend (GitHub Pages, Cloudflare Pages, Netlify or equivalent).
- A Supabase project providing PostgreSQL, Auth and Edge Functions.
- An email provider or custom SMTP service for invitations and password recovery.
- An independent backup destination.

## Installation

1. Fork or clone the repository.
2. Create a Supabase project in the region required by your organization.
3. Run every migration in `supabase/migrations/` in filename order.
4. Create and confirm the first Auth user, then run `select public.bootstrap_admin('ADMIN_EMAIL');` in the SQL editor.
5. Disable public email sign-up so only administrators can create users.
6. Deploy `supabase/functions/admin-create-user` and configure its server-side secrets.
7. Set the frontend build variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
8. Configure the Auth Site URL and allowed redirect URLs for your exact deployment origin.
9. Build with `npm run build` and deploy the generated `dist/` directory.

## Required secrets

Frontend build variables are browser-visible by design:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Server-only Edge Function secrets:

- `RESEND_API_KEY` when Resend is used;
- `RESEND_FROM_EMAIL` for the verified sender;
- `APP_URL` for password-change redirects;
- Supabase server credentials injected by the platform.

Never prefix privileged credentials with `VITE_`.

## Backups and recovery

- Export an SBS administrative JSON backup after important changes.
- Schedule PostgreSQL backups outside the primary provider when production continuity matters.
- Keep multiple dated copies with restricted access.
- Test restoration into a separate project; an untested backup is not a recovery plan.
- Review `project_versions` retention and storage growth.

## Upgrades

Read release notes and migration files before updating. Back up the database and SBS JSON data, apply database migrations in order, deploy Edge Functions, deploy the frontend, then test authentication, save, restore, export and user administration with synthetic data.
