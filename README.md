# Scognamiglio Budgeting System (SBS)

SBS è un'applicazione professionale TypeScript per il budgeting di produzioni cinematografiche e audiovisive. Funziona offline, salva automaticamente nel browser e mantiene separati il master budget e gli scenari di lavoro.

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

## Compatibilità legacy e cloud

Il selettore accetta `.mbd` e `.mmbx` e apre il percorso guidato di migrazione. La lettura binaria diretta non è attivata perché il formato legacy non ha una specifica pubblica; il percorso verificabile è l'esportazione JSON Advanced da Movie Magic e il mapping verso SBS. La compatibilità diretta può essere completata validando il parser con file campione autorizzati.

La versione corrente salva localmente. Il modello è già serializzabile e pronto per un adapter cloud, ma autenticazione, tenant, backend e storage remoto richiedono la scelta dell'infrastruttura di distribuzione.

## Struttura

- `src/engine.ts`: parser formule e motore dei calcoli.
- `src/types.ts`: modello dati del budget.
- `src/store.ts`: autosave, cronologia, undo e redo.
- `src/views/`: viste operative.
- `src/exporters.ts`: CSV, JSON e generatore Excel OpenXML.
- `src/*.test.ts`: test dei calcoli e dell'export Excel.
