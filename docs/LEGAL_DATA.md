# Legal data architecture

SBS follows a source-first model. The feature helps a production team find and document rules; it is not a legal opinion and it never silently changes a budget.

## Trust model

1. Every project selects an operating country, optional region and effective date.
2. The server accepts only supported country codes and calls allowlisted institutional endpoints.
3. A result contains authority, primary-source link, publication metadata and check time.
4. The audit table records the search metadata under project Row Level Security.
5. A rate, fringe or incentive is trusted only when its provenance records authority, title, URL, effective date and verification time.
6. Search results cannot update financial data. A human approves every rule change.

For Italy, the structured adapter queries **Normattiva Open Data**. Normattiva states that its digital texts are informational; the printed Gazzetta Ufficiale remains authoritative. EU rules should be checked on EUR-Lex. Tax-credit measures and operational decrees should also be checked with the Direzione generale Cinema e audiovisivo.

## Adding a country adapter

An adapter is accepted only after documenting:

- the primary public authority and official base URL;
- an API or stable search endpoint and its reuse terms;
- effective-date and amendment semantics;
- stable deep links to individual acts;
- timeout, rate-limit and failure behaviour;
- fixtures proving normalization of title, act date and publication metadata.

Never accept a URL from the browser and fetch it server-side. Add every upstream host explicitly in `supabase/functions/legal-search/index.ts` to prevent SSRF and accidental reliance on unofficial sources.

## Operational review

Before approving a production budget, rerun the relevant searches, open the primary documents and update the `verifiedAt` fields of applied rules. The health check warns when legal review is missing or older than 30 days, but freshness alone does not prove legal correctness.
