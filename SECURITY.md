# Security policy

## Supported version

SBS is currently in public beta. Security fixes are applied to the latest commit on `main`; older commits and third-party deployments are not maintained by the project.

## Reporting a vulnerability

Do not open a public issue. Use [GitHub private vulnerability reporting](https://github.com/Scognamiglio1969/scognamiglio-budgeting-system/security/advisories/new) and include:

- affected component and version or commit;
- reproduction steps with synthetic data;
- potential impact;
- suggested mitigation, if known.

Do not access, modify, retain or disclose data belonging to other people. Give the maintainers reasonable time to investigate and release a fix before public disclosure.

## Deployment responsibility

Self-hosters are responsible for secret management, Supabase RLS configuration, email-provider security, backups, dependency updates and access reviews. Never expose a Supabase service-role/secret key in frontend variables, GitHub Actions output or a public repository.

The public demo and free infrastructure do not constitute a contractual backup, availability or disaster-recovery service. Export regular administrative backups and test restoration procedures before storing production-critical data.
