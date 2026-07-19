# SBS Cloud — configurazione

## Architettura

- **Frontend:** GitHub Pages.
- **Autenticazione:** Supabase Auth con email e password.
- **Database:** PostgreSQL Supabase, preferibilmente in una regione europea.
- **Autorizzazione:** Row Level Security su ogni tabella applicativa.
- **Email accessi:** Edge Function `admin-create-user`; Resend per inviare la password, oppure link di cambio password tramite SMTP Supabase.
- **Recupero:** storico completo in `project_versions`, copie dei conflitti e cache locale IndexedDB cifrata AES-GCM.

Nel browser sono presenti solo la chiave pubblica Supabase e la sessione dell'utente. La chiave amministrativa rimane nella Edge Function e non deve mai essere aggiunta a GitHub o a un file `.env` pubblico.

## 1. Creare il progetto Supabase

Creare un progetto gratuito denominato `sbs-scognamiglio-budgeting-system`, scegliendo una regione UE. Conservare la password del database in un password manager.

Dal SQL Editor eseguire integralmente:

```text
supabase/migrations/202607190001_cloud_platform.sql
```

Lo script crea profili, progetti, membri, budget, versioni e risorse condivise. Attiva le policy RLS e le funzioni atomiche di creazione, salvataggio e ripristino.

## 2. Creare il primo Admin

Da **Authentication → Users**, creare il primo utente con email confermata e una password forte. Poi eseguire nel SQL Editor:

```sql
select public.bootstrap_admin('EMAIL_ADMIN');
```

La funzione non è invocabile dal browser. Dopo il bootstrap, disattivare le registrazioni pubbliche in **Authentication → Sign In / Providers → Email → Allow new users to sign up**. Gli altri utenti verranno creati esclusivamente dall'Admin SBS.

Configurare inoltre:

- Site URL: `https://scognamiglio1969.github.io/scognamiglio-budgeting-system/`
- Redirect URL: `https://scognamiglio1969.github.io/scognamiglio-budgeting-system/**`

## 3. Email degli accessi

Creare un account Resend gratuito, verificare il dominio mittente e generare una API key. Impostare i secret della Edge Function:

```bash
supabase secrets set \
  RESEND_API_KEY=... \
  RESEND_FROM_EMAIL="SBS <accessi@DOMINIO>" \
  APP_URL="https://scognamiglio1969.github.io/scognamiglio-budgeting-system/"
```

Distribuire la funzione:

```bash
supabase functions deploy admin-create-user
```

La funzione verifica che il chiamante sia Admin, genera una password casuale forte, crea l'utente, invia l'email e annulla la creazione se la consegna fallisce. Se Resend non è configurato, usa il flusso di recupero password di Supabase e mostra la password provvisoria una sola volta all'Admin. Per inviare email a utenti che non appartengono al team Supabase è comunque necessario configurare un SMTP personalizzato gratuito. Il database rimuove il flag `must_change_password` solo quando Supabase registra un vero cambio password.

## 4. Collegare GitHub Pages

Nel repository GitHub aggiungere i secret Actions:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Sono valori browser-safe, ma vengono gestiti come secret per tenere centralizzata la configurazione. Il workflow `.github/workflows/deploy.yml` li include durante la build.

## 5. Dove sono i dati e come vengono protetti

- Il budget corrente è in `public.project_budgets.data` come JSONB, uno per progetto.
- I metadati sono in `public.projects`.
- Gli accessi sono in `public.project_members`.
- Le risorse riutilizzabili sono in `public.shared_resources` e possono essere applicate a progetti diversi.
- Ogni stato precedente è in `public.project_versions`.
- Un conflitto di modifica viene salvato con `reason = 'conflict-recovery'` prima di mostrare l'avviso.
- Il dispositivo conserva una copia cifrata non esportabile in IndexedDB; il vecchio prototipo locale non viene cancellato durante la migrazione.
- L'Admin può scaricare un backup JSON completo dalla dashboard progetti.

## Limite del piano gratuito

Il piano Free di Supabase può mettere in pausa un progetto inattivo e non include i backup automatici gestiti. Lo storico SBS protegge da cancellazioni e sovrascritture applicative, mentre il pulsante **Backup** produce una copia esterna completa. Per un requisito formale di disaster recovery con ripristino garantito e retention automatica è necessario configurare un backup esterno programmato oppure usare un piano con backup gestiti.
