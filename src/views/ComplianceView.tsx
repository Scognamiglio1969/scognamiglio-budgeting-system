import { useMemo, useState } from 'react';
import {
  AlertTriangle, BadgeCheck, Banknote, CalendarClock, ExternalLink, Globe2, Landmark,
  LoaderCircle, Search, ShieldCheck, UsersRound,
} from 'lucide-react';
import { cloudConfigured, searchOfficialLegislation, type LegalSearchResponse } from '../cloud';
import {
  calculateCashFlow, calculateRiskRange, calculateTargetGap, COUNTRY_PROFILES,
  DEFAULT_INTELLIGENCE, runBudgetHealthCheck,
} from '../intelligence';
import type { BudgetProject } from '../types';
import { ViewHeader } from '../components/ui';

interface Props {
  project: BudgetProject;
  money: Intl.NumberFormat;
  readOnly: boolean;
  commit: (mutator: (project: BudgetProject) => void, label?: string) => void;
}

export function ComplianceView({ project, money, readOnly, commit }: Props) {
  const intelligence = project.intelligence ?? DEFAULT_INTELLIGENCE;
  const [query, setQuery] = useState(intelligence.jurisdiction.lastLegalQuery || 'tax credit produzione cinematografica');
  const [response, setResponse] = useState<LegalSearchResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const findings = useMemo(() => runBudgetHealthCheck(project), [project]);
  const risks = useMemo(() => calculateRiskRange(project), [project]);
  const cash = useMemo(() => calculateCashFlow(intelligence.cashFlow), [intelligence.cashFlow]);
  const target = useMemo(() => calculateTargetGap(project), [project]);
  const critical = findings.filter((finding) => finding.severity === 'critical').length;

  const ensureIntelligence = (draft: BudgetProject) => {
    if (!draft.intelligence) draft.intelligence = structuredClone(DEFAULT_INTELLIGENCE);
    return draft.intelligence;
  };

  const changeCountry = (countryCode: string) => {
    const country = COUNTRY_PROFILES.find((item) => item.code === countryCode) ?? COUNTRY_PROFILES[0];
    commit((draft) => {
      const value = ensureIntelligence(draft);
      value.jurisdiction = {
        ...value.jurisdiction, countryCode: country.code, countryName: country.name, euApplicable: country.eu,
        region: '', lastLegalCheckAt: null, lastLegalQuery: '',
      };
    }, `Operating country changed to ${country.name}`);
    setResponse(null);
  };

  const search = async () => {
    const clean = query.trim();
    if (clean.length < 3) { setError('Inserisci almeno 3 caratteri.'); return; }
    if (!cloudConfigured) { setError('La ricerca live richiede il collegamento Supabase. Usa il portale ufficiale indicato sotto.'); return; }
    setLoading(true); setError('');
    try {
      const result = await searchOfficialLegislation(intelligence.jurisdiction.countryCode, clean, project.id);
      setResponse(result);
      if (!readOnly) commit((draft) => {
        const value = ensureIntelligence(draft);
        value.jurisdiction.lastLegalCheckAt = result.checkedAt;
        value.jurisdiction.lastLegalQuery = clean;
      }, `Official legislation checked: ${clean}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Ricerca normativa non riuscita.');
    } finally { setLoading(false); }
  };

  const country = COUNTRY_PROFILES.find((item) => item.code === intelligence.jurisdiction.countryCode) ?? COUNTRY_PROFILES[0];
  const shares = intelligence.productionEntities.reduce((sum, entity) => sum + entity.sharePercent, 0);

  return (
    <div className="view-shell compliance-view">
      <ViewHeader eyebrow="Legal & Intelligence" title="Controllo normativo e salute del budget" description="Fonti ufficiali, giurisdizione, provenienza delle tariffe e segnali finanziari in un unico centro di controllo." actions={<span className={`compliance-score ${critical ? 'warning' : 'ok'}`}><ShieldCheck size={15} /> {critical ? `${critical} blocchi critici` : 'Struttura verificata'}</span>} />

      <div className="legal-disclaimer"><AlertTriangle size={18} /><div><strong>Supporto decisionale, non consulenza legale.</strong><span>I risultati sono informativi: il testo pubblicato dall’autorità competente prevale. Nessuna regola trovata online modifica automaticamente il budget; aliquote e incentivi vanno approvati da un professionista.</span></div></div>

      <section className="panel jurisdiction-panel">
        <div className="panel-heading"><div><span className="section-kicker">Giurisdizione di progetto</span><h2>Paese e data di validità</h2></div><a className="button" href={country.portalUrl} target="_blank" rel="noreferrer">Portale ufficiale <ExternalLink size={14} /></a></div>
        <div className="jurisdiction-grid">
          <label><span>Paese operativo *</span><select disabled={readOnly} value={country.code} onChange={(event) => changeCountry(event.target.value)}>{COUNTRY_PROFILES.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
          <label><span>Regione / Stato</span><input disabled={readOnly} value={intelligence.jurisdiction.region} placeholder="es. Lazio" onChange={(event) => commit((draft) => { ensureIntelligence(draft).jurisdiction.region = event.target.value; }, 'Operating region updated')} /></label>
          <label><span>Budget valido alla data</span><input disabled={readOnly} type="date" value={intelligence.jurisdiction.effectiveDate} onChange={(event) => commit((draft) => { ensureIntelligence(draft).jurisdiction.effectiveDate = event.target.value; }, 'Legal effective date updated')} /></label>
          <div className="authority-card"><Globe2 size={18} /><span><strong>{country.authority}</strong><small>{country.structuredSearch ? 'Ricerca API strutturata' : 'Portale ufficiale verificato'}{country.eu ? ' · Normativa UE applicabile' : ''}</small></span></div>
        </div>
      </section>

      <section className="panel legal-search-panel">
        <div className="panel-heading"><div><span className="section-kicker">Ricerca ufficiale</span><h2>Legislazione e provvedimenti</h2></div>{intelligence.jurisdiction.lastLegalCheckAt && <span className="last-check"><BadgeCheck size={14} /> Ultimo controllo {new Date(intelligence.jurisdiction.lastLegalCheckAt).toLocaleString('it-IT')}</span>}</div>
        <div className="legal-search-bar"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void search()} placeholder="Es. tax credit cinema, contributi lavoratori spettacolo…" /><button className="button primary" onClick={() => void search()} disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : <Search size={16} />} Cerca fonti ufficiali</button></div>
        {error && <div className="inline-message error"><AlertTriangle size={15} /> {error}</div>}
        {response && <div className="legal-results"><div className="results-meta"><span>{response.total} atti trovati · {response.source.name}</span><span>Controllato {new Date(response.checkedAt).toLocaleString('it-IT')}</span></div>{response.results.map((result) => <a key={result.id} className="legal-result" href={result.sourceUrl} target="_blank" rel="noreferrer"><Landmark size={18} /><span><strong>{result.description || result.title}</strong><small>{[result.authority, result.actDate, result.officialGazette].filter(Boolean).join(' · ')}</small><em>{result.title}</em></span><ExternalLink size={15} /></a>)}</div>}
        {!response && <div className="legal-empty"><Landmark size={25} /><div><strong>Ricerca limitata a fonti istituzionali curate</strong><span>Per l’Italia SBS interroga Normattiva. Per gli altri paesi apre l’autorità ufficiale configurata; i connettori strutturati vengono abilitati singolarmente dopo la validazione.</span></div></div>}
      </section>

      <div className="intelligence-grid">
        <section className="panel health-panel"><div className="panel-heading"><div><span className="section-kicker">Budget Health Check</span><h2>Controlli automatici</h2></div></div><div className="finding-list">{findings.map((finding) => <article key={finding.id} className={`finding ${finding.severity}`}><span>{finding.severity === 'info' ? <BadgeCheck size={16} /> : <AlertTriangle size={16} />}</span><div><strong>{finding.title}</strong><small>{finding.detail}</small></div></article>)}</div></section>
        <section className="panel intelligence-summary"><div className="panel-heading"><div><span className="section-kicker">Previsione</span><h2>Finanza e rischio</h2></div></div><dl>
          <div><dt><Banknote size={15} /> Budget netto</dt><dd>{money.format(risks.baseline)}</dd><small>Range rischio {money.format(risks.low)} – {money.format(risks.high)}</small></div>
          <div><dt><CalendarClock size={15} /> Picco di cassa</dt><dd>{money.format(cash.peakFundingNeed)}</dd><small>Saldo finale {money.format(cash.closingBalance)}</small></div>
          <div><dt><UsersRound size={15} /> Coproduzione</dt><dd>{shares.toFixed(1)}%</dd><small>{intelligence.productionEntities.length} entità configurate</small></div>
          <div><dt><Landmark size={15} /> Target</dt><dd>{target.gap === null ? 'Non impostato' : `${target.gap > 0 ? '+' : ''}${money.format(target.gap)}`}</dd><small>{target.target === null ? 'Definisci un tetto di produzione' : `Obiettivo ${money.format(target.target)}`}</small></div>
        </dl></section>
      </div>
    </div>
  );
}
