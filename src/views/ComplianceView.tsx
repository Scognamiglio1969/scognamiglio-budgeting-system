import { useMemo, useState } from 'react';
import {
  AlertTriangle, BadgeCheck, Banknote, CalendarClock, ExternalLink, Globe2, Landmark, Link2,
  LoaderCircle, Search, ShieldCheck, UsersRound,
} from 'lucide-react';
import { cloudConfigured, searchOfficialLegislation, type LegalSearchResponse } from '../cloud';
import {
  calculateCashFlow, calculateRiskRange, calculateTargetGap, COUNTRY_PROFILES,
  normalizeIntelligence, runBudgetHealthCheck,
} from '../intelligence';
import type { BudgetProject } from '../types';
import { ViewHeader } from '../components/ui';

interface Props {
  project: BudgetProject;
  money: Intl.NumberFormat;
  readOnly: boolean;
  demoMode?: boolean;
  commit: (mutator: (project: BudgetProject) => void, label?: string) => void;
}

export function ComplianceView({ project, money, readOnly, commit, demoMode = false }: Props) {
  const intelligence = normalizeIntelligence(project.intelligence);
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
    draft.intelligence = normalizeIntelligence(draft.intelligence);
    return draft.intelligence;
  };

  const updateProvenance = (kind: 'fringe' | 'incentive', id: string, field: 'authority' | 'title' | 'sourceUrl' | 'effectiveFrom' | 'verifiedAt', value: string) => commit((draft) => {
    const data = draft.scenarios.find((scenario) => scenario.id === draft.activeScenarioId)!.data;
    const target = kind === 'fringe' ? data.fringes.find((item) => item.id === id) : data.incentives.find((item) => item.id === id);
    if (!target) return;
    target.provenance ??= { authority: '', title: '', sourceUrl: '', effectiveFrom: new Date().toISOString().slice(0, 10), verifiedAt: new Date().toISOString() };
    target.provenance[field] = value;
  }, `Rate provenance updated for ${id}`);

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
        <div className="legal-search-bar"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => !demoMode && event.key === 'Enter' && void search()} placeholder="Es. tax credit cinema, contributi lavoratori spettacolo…" />{demoMode ? <a className="button primary" href={country.portalUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Cerca sul portale ufficiale</a> : <button className="button primary" onClick={() => void search()} disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : <Search size={16} />} Cerca fonti ufficiali</button>}</div>
        {demoMode && <div className="inline-message"><ShieldCheck size={15} /> Nella sandbox la ricerca apre direttamente la fonte istituzionale. La ricerca aggregata e il registro della verifica richiedono un account.</div>}
        {error && <div className="inline-message error"><AlertTriangle size={15} /> {error}</div>}
        {response && <div className="legal-results"><div className="results-meta"><span>{response.total} atti trovati · {response.source.name}</span><span>Controllato {new Date(response.checkedAt).toLocaleString('it-IT')}</span></div>{response.results.map((result) => <a key={result.id} className="legal-result" href={result.sourceUrl} target="_blank" rel="noreferrer"><Landmark size={18} /><span><strong>{result.description || result.title}</strong><small>{[result.authority, result.actDate, result.officialGazette].filter(Boolean).join(' · ')}</small><em>{result.title}</em></span><ExternalLink size={15} /></a>)}</div>}
        {!response && <div className="legal-empty"><Landmark size={25} /><div><strong>Ricerca limitata a fonti istituzionali curate</strong><span>Per l’Italia SBS interroga Normattiva. Per gli altri paesi apre l’autorità ufficiale configurata; i connettori strutturati vengono abilitati singolarmente dopo la validazione.</span></div></div>}
      </section>

      <section className="panel provenance-panel">
        <div className="panel-heading"><div><span className="section-kicker">Rate Provenance · 8</span><h2>Fonti delle regole applicate</h2></div><Link2 size={18} /></div>
        <div className="provenance-list">{[
          ...project.scenarios.find((scenario) => scenario.id === project.activeScenarioId)!.data.fringes.map((item) => ({ kind: 'fringe' as const, id: item.id, name: item.name, provenance: item.provenance })),
          ...project.scenarios.find((scenario) => scenario.id === project.activeScenarioId)!.data.incentives.map((item) => ({ kind: 'incentive' as const, id: item.id, name: item.name, provenance: item.provenance })),
        ].map((item) => <article key={`${item.kind}-${item.id}`}><div><strong>{item.name}</strong><span>{item.kind === 'fringe' ? 'Contributo' : 'Incentivo fiscale'}</span><small>{item.provenance?.verifiedAt ? `Verificato ${new Date(item.provenance.verifiedAt).toLocaleString('it-IT')}` : 'Mai verificato'}</small></div><input disabled={readOnly} placeholder="Autorità" value={item.provenance?.authority ?? ''} onChange={(event) => updateProvenance(item.kind, item.id, 'authority', event.target.value)} /><input disabled={readOnly} placeholder="Titolo fonte" value={item.provenance?.title ?? ''} onChange={(event) => updateProvenance(item.kind, item.id, 'title', event.target.value)} /><input disabled={readOnly} type="url" placeholder="https://fonte-ufficiale…" value={item.provenance?.sourceUrl ?? ''} onChange={(event) => updateProvenance(item.kind, item.id, 'sourceUrl', event.target.value)} /><input disabled={readOnly} type="date" value={item.provenance?.effectiveFrom ?? ''} onChange={(event) => updateProvenance(item.kind, item.id, 'effectiveFrom', event.target.value)} /><button disabled={readOnly} className="button" onClick={() => updateProvenance(item.kind, item.id, 'verifiedAt', new Date().toISOString())}><BadgeCheck size={14} /> Verifica oggi</button></article>)}</div>
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
