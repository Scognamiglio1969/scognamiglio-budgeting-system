# Scognamiglio Budgeting System (SBS)

[English](README.md) · [Applicazione online](https://scognamiglio1969.github.io/scognamiglio-budgeting-system/) · [Roadmap](ROADMAP.md) · [Contribuire](CONTRIBUTING.md)

SBS è una piattaforma open source per il budgeting di produzioni cinematografiche, televisive, documentarie, pubblicitarie e audiovisive. Unisce budget gerarchici, risorse produttive riutilizzabili, collaborazione multi-progetto e un backend PostgreSQL protetto.

> **Stato del progetto:** beta pubblica. Prima di utilizzare dati reali di produzione, verificare le indicazioni su distribuzione, backup e sicurezza.

## Perché SBS

- **Struttura professionale:** Topsheet → Account → Categorie → Dettagli.
- **Calcoli avanzati:** Globali, formule, contributi, massimali, valute e incentivi fiscali.
- **Ambiente multi-progetto:** budget separati con reparti, tariffe, pacchetti e modelli condivisi.
- **Collaborazione controllata:** utenti creati dall'Admin e ruoli `owner`, `editor`, `viewer`.
- **Proprietà dei dati:** installazione autonoma ed esportazione completa del backup amministrativo.
- **Formati aperti:** SBS JSON, CSV, Excel e report PDF stampabili.

## Funzioni principali

- Topsheet automatico e navigazione gerarchica con un clic.
- Parser sicuro delle formule e ricalcolo delle dipendenze globali.
- Fringe sindacali, fiscali e assicurativi con massimali configurabili.
- Multi-valuta e tabelle dei tassi di cambio aggiornabili.
- Incentivi per location e categorie di spesa.
- Sotto-budget, scenari indipendenti e confronto per account.
- Undo/redo persistente, audit trail e versioni recuperabili.
- Librerie di righe, crew rate, attrezzature, Globali, Fringe e Gruppi.
- Cache di recupero IndexedDB cifrata e salvataggio cloud con controllo dei conflitti.
- Percorso guidato per la migrazione dei file legacy `.mbd` e `.mmbx`.

## Avvio rapido

Requisiti: Node.js 20 o successivo e un progetto Supabase.

```bash
git clone https://github.com/Scognamiglio1969/scognamiglio-budgeting-system.git
cd scognamiglio-budgeting-system
npm install
cp .env.example .env.local
npm run dev
```

Aprire `http://127.0.0.1:4173/`. Prima del login, inserire in `.env.local` l'URL Supabase e la relativa chiave pubblicabile, entrambi sicuri per il browser.

Per database, autenticazione ed Edge Function seguire [Configurazione Cloud](docs/CLOUD_SETUP.md). Per un'installazione indipendente consultare [Self-hosting](docs/SELF_HOSTING.md).

## Verifica

```bash
npm test
npm run build
```

## Compatibilità legacy

Il selettore riconosce `.mbd` e `.mmbx` e apre il percorso guidato di migrazione. La lettura binaria diretta non è attiva perché il formato legacy non dispone di una specifica pubblica. Il percorso verificabile utilizza un'esportazione JSON Advanced di Movie Magic mappata in SBS. La compatibilità diretta richiederà file campione ottenuti legalmente e fixture di verifica ripetibili.

SBS è un progetto indipendente e non è affiliato né approvato da Movie Magic, Entertainment Partners, SAG-AFTRA, DGA o IATSE. I nomi di terzi sono utilizzati esclusivamente per descrivere obiettivi di compatibilità e flussi di produzione.

## Contributi e sicurezza

Leggere [CONTRIBUTING.md](CONTRIBUTING.md) prima di aprire una pull request. Le vulnerabilità devono essere segnalate tramite la [segnalazione privata GitHub](https://github.com/Scognamiglio1969/scognamiglio-budgeting-system/security/advisories/new), mai mediante issue pubbliche. La policy completa è in [SECURITY.md](SECURITY.md).

## Licenza e marchi

Copyright © 2026 Massimo Scognamiglio.

Il codice sorgente è distribuito con licenza [GNU Affero General Public License v3.0](LICENSE). I nomi **SBS**, **Scognamiglio Budgeting System** e la relativa identità visiva non sono concessi dalla licenza software; vedere [TRADEMARKS.md](TRADEMARKS.md).
