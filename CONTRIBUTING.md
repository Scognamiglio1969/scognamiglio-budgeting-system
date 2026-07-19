# Contributing to SBS / Contribuire a SBS

Thank you for helping improve professional production budgeting. Contributions are welcome from production accountants, line producers, developers, designers and translators.

Grazie per contribuire al budgeting professionale delle produzioni. Sono benvenuti production accountant, organizzatori, sviluppatori, designer e traduttori.

## Before opening an issue

- Search existing issues and the [roadmap](ROADMAP.md).
- Do not include real production budgets, personal data, contracts, credentials or confidential rates.
- Use the bug template for reproducible defects and the feature template for proposals.
- Report security problems privately as described in [SECURITY.md](SECURITY.md).

## Development workflow

1. Fork the repository and create a focused branch.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local` and use a disposable Supabase development project.
4. Keep calculation changes deterministic and add tests for formulas, rounding and exports.
5. Run `npm test` and `npm run build`.
6. Open a pull request explaining the production use case and data-model impact.

Never commit `.env` files, service-role keys, access tokens, database passwords or real customer data. Browser code may contain only the Supabase URL and publishable key. Privileged keys belong exclusively in server-side secrets.

## Pull-request expectations

- Keep each pull request small enough to review.
- Preserve compatibility with existing SBS JSON archives when possible.
- Document intentional schema changes and include a reversible migration plan.
- Add accessible labels and keyboard behavior to new UI controls.
- Update both English and Italian documentation when changing user-facing behavior.

## Commit sign-off

By contributing, you certify that you have the right to submit the work under AGPL-3.0. Use the [Developer Certificate of Origin](https://developercertificate.org/) sign-off:

```bash
git commit -s -m "Describe the change"
```

## Community standards

Be respectful, practical and specific. Harassment, discrimination, publication of private production information and personal attacks are not accepted. Maintainers may edit or remove content and restrict participation to protect the community.
