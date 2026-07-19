# Scognamiglio Budgeting System (SBS)

SBS è un'applicazione professionale TypeScript per il budgeting di produzioni cinematografiche e audiovisive. La Cloud Edition gestisce più progetti, utenti autorizzati e risorse condivise con PostgreSQL, mantenendo una cache locale cifrata per il recupero.

Versione online: <https://scognamiglio1969.github.io/scognamiglio-budgeting-system/>

## Avvio

```bash
npm install
npm run dev
```

Aprire `http://127.0.0.1:4173/`.

Per compilare e verificare il progetto:

```bash
npm test
npm run build
```

## Funzioni incluse

- Topsheet automatico con Account, Categorie e righe di Dettaglio.
- Navigazione gerarchica, ricerca e filtri per account, gruppo e location.
- Formule sicure con Globals e ricalcolo istantaneo delle dipendenze.
- Fringe configurabili per tipologia, gruppi e massimali contributivi.
- Multi-valuta per singola voce e tabella dei tassi di cambio.
- Incentivi fiscali per location, tipologia, aliquota e cap.
- Sub-budget per location o gruppo, scenari indipendenti e confronto per account.
- Undo/redo e audit trail persistente.
- Librerie di righe, pacchetti, Globals, Fringe e Gruppi.
- Esportazione PDF tramite report di stampa, Excel `.xlsx`, CSV e archivio SBS JSON.
- Importazione degli archivi SBS JSON.
- Layout desktop/mobile e persistenza offline-first.
- Dashboard multi-progetto con accessi `editor` e `viewer` per utente.
- Login protetto, Admin, password provvisoria via email e cambio obbligatorio al primo accesso.
- PostgreSQL con Row Level Security, versioni recuperabili e protezione dei conflitti.
- Risorse condivise tra progetti: descrizioni reparto, librerie, crew rate, pacchetti e setup.
- Backup amministrativo completo in JSON.

## Compatibilità legacy e cloud

Il selettore accetta `.mbd` e `.mmbx` e apre il percorso guidato di migrazione. La lettura binaria diretta non è attivata perché il formato legacy non ha una specifica pubblica; il percorso verificabile è l'esportazione JSON Advanced da Movie Magic e il mapping verso SBS. La compatibilità diretta può essere completata validando il parser con file campione autorizzati.

Il database cloud è PostgreSQL gestito da Supabase; il frontend rimane su GitHub Pages. Le istruzioni operative sono in [`docs/CLOUD_SETUP.md`](docs/CLOUD_SETUP.md).

## Struttura

- `src/engine.ts`: parser formule e motore dei calcoli.
- `src/types.ts`: modello dati del budget.
- `src/store.ts`: autosave, cronologia, undo e redo.
- `src/RootApp.tsx`: autenticazione, dashboard progetti e sincronizzazione cloud.
- `src/secureCache.ts`: cache IndexedDB cifrata AES-GCM.
- `src/views/`: viste operative.
- `src/exporters.ts`: CSV, JSON e generatore Excel OpenXML.
- `src/*.test.ts`: test dei calcoli e dell'export Excel.
- `supabase/migrations/`: schema PostgreSQL, RLS e storico versioni.
- `supabase/functions/`: funzioni server per l'amministrazione utenti.
