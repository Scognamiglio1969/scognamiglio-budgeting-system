# Open SBS Budget Standard 2.0

Open SBS is a versioned JSON envelope for exchanging complete production budgets without a proprietary binary dependency. The canonical schema is [`sbs-budget.schema.json`](sbs-budget.schema.json).

An archive contains:

- `format: "open-sbs-budget"`;
- semantic `schemaVersion`;
- export timestamp and generator;
- one complete project with scenarios/branches, formulas, currencies, groups, fringes, incentives, provenance and intelligence settings.

SBS validates the envelope and rejects unsupported major formats before import. Legacy unwrapped SBS JSON remains readable and is migrated in memory to the current defaults. New exports use MIME type `application/vnd.open-sbs+json` and the suffix `.open-sbs.json`.

Forward-compatible readers should ignore unknown properties inside the project while strictly validating the envelope and required arrays. Implementations must not evaluate formulas as JavaScript; expressions use the restricted SBS arithmetic grammar implemented in `src/engine.ts`.
