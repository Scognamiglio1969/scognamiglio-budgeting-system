import { useMemo, useState } from 'react';
import { Check, FileDown, FileSpreadsheet, FileText, LoaderCircle, Presentation, Settings2, X } from 'lucide-react';
import { REPORT_SECTIONS, type ExportFormat, type ReportOptions, type ReportSectionId } from '../reporting';

interface Props {
  projectTitle: string;
  scenarioName: string;
  onClose: () => void;
  onGenerate: (options: ReportOptions) => Promise<void>;
  onExportCsv: () => void;
  onExportOpenSbs: () => void;
}

const formats: Array<{ id: ExportFormat; label: string; extension: string; icon: React.ReactNode; color: string }> = [
  { id: 'pdf', label: 'PDF', extension: 'Documento impaginato', icon: <FileDown />, color: 'coral' },
  { id: 'xlsx', label: 'Excel', extension: 'Cartella multifoglio', icon: <FileSpreadsheet />, color: 'green' },
  { id: 'docx', label: 'Word', extension: 'Report modificabile', icon: <FileText />, color: 'blue' },
  { id: 'pptx', label: 'PowerPoint', extension: 'Presentazione executive', icon: <Presentation />, color: 'amber' },
];

export function ExportReportModal({ projectTitle, scenarioName, onClose, onGenerate, onExportCsv, onExportOpenSbs }: Props) {
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [mode, setMode] = useState<'full' | 'custom'>('full');
  const [selected, setSelected] = useState<ReportSectionId[]>(REPORT_SECTIONS.map((item) => item.id));
  const [includeAllScenarios, setIncludeAllScenarios] = useState(true);
  const [preparedFor, setPreparedFor] = useState('');
  const [reportTitle, setReportTitle] = useState(`Preventivo · ${projectTitle}`);
  const [confidentiality, setConfidentiality] = useState<ReportOptions['confidentiality']>('Riservato');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const compatible = useMemo(() => REPORT_SECTIONS.filter((item) => item.formats.includes(format)), [format]);
  const effective = mode === 'full' ? compatible.map((item) => item.id) : selected.filter((id) => compatible.some((item) => item.id === id));
  const groups = [...new Set(REPORT_SECTIONS.map((item) => item.group))];
  const chooseFormat = (next: ExportFormat) => { setFormat(next); setError(''); };
  const toggle = (id: ReportSectionId) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const generate = async () => {
    if (!effective.length) return setError('Seleziona almeno una sezione compatibile con il formato scelto.');
    setBusy(true); setError('');
    try { await onGenerate({ format, sections: effective, includeAllScenarios, preparedFor, reportTitle, confidentiality }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Generazione non riuscita.'); setBusy(false); return; }
    setBusy(false); onClose();
  };
  const activeFormat = formats.find((item) => item.id === format)!;

  return <div className="export-builder-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
    <section className="export-builder" role="dialog" aria-modal="true" aria-labelledby="export-report-title">
      <header className="export-builder-header"><div className="export-title-icon"><FileDown size={21} /></div><div><h2 id="export-report-title">Esporta il preventivo</h2><p>{scenarioName} · report professionale strutturato</p></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label="Chiudi esportazione"><X size={19} /></button></header>
      <div className="export-builder-scroll">
        <section><span className="export-label">Formato</span><div className="export-formats">{formats.map((item) => <button key={item.id} className={`export-format ${format === item.id ? 'active' : ''} ${item.color}`} onClick={() => chooseFormat(item.id)}><span>{item.icon}</span><strong>{item.label}</strong><small>{item.extension}</small>{format === item.id && <Check className="format-check" size={14} />}</button>)}</div></section>
        <section><span className="export-label">Cosa esportare</span><div className="export-mode"><button className={mode === 'full' ? 'active' : ''} onClick={() => setMode('full')}><FileDown size={16} /><span><strong>Report completo</strong><small>Tutte le sezioni compatibili</small></span></button><button className={mode === 'custom' ? 'active' : ''} onClick={() => setMode('custom')}><Settings2 size={16} /><span><strong>Personalizza</strong><small>Scegli contenuti e approfondimenti</small></span></button></div></section>
        {mode === 'custom' && <section className="export-sections"><div className="export-section-toolbar"><span><strong>{effective.length}</strong> sezioni selezionate per {activeFormat.label}</span><div><button onClick={() => setSelected(compatible.map((item) => item.id))}>Tutte</button><button onClick={() => setSelected([])}>Nessuna</button></div></div>{groups.map((group) => <div className="export-section-group" key={group}><h3>{group}</h3><div>{REPORT_SECTIONS.filter((item) => item.group === group).map((item) => { const supported = item.formats.includes(format); const checked = effective.includes(item.id); return <label className={!supported ? 'unsupported' : ''} key={item.id}><input type="checkbox" disabled={!supported} checked={checked} onChange={() => toggle(item.id)} /><span><strong>{item.label}</strong><small>{supported ? item.description : `Non previsto nel formato ${activeFormat.label}`}</small></span></label>; })}</div></div>)}</section>}
        <section className="export-options"><span className="export-label">Intestazione e contenuto</span><div className="export-options-grid"><label><span>Titolo report</span><input value={reportTitle} onChange={(event) => setReportTitle(event.target.value)} /></label><label><span>Preparato per</span><input value={preparedFor} onChange={(event) => setPreparedFor(event.target.value)} placeholder="Cliente, produzione, finanziatore…" /></label><label><span>Classificazione</span><select value={confidentiality} onChange={(event) => setConfidentiality(event.target.value as typeof confidentiality)}><option>Riservato</option><option>Uso interno</option><option>Bozza</option></select></label><label className="export-switch"><input type="checkbox" checked={includeAllScenarios} onChange={(event) => setIncludeAllScenarios(event.target.checked)} /><span><strong>Includi confronto scenari</strong><small>Master, branch e sub-budget nel riepilogo versioni</small></span></label></div></section>
        <section className="export-output-map"><span className="export-label">Struttura del file</span><p>{format === 'xlsx' ? 'Un foglio per ogni sezione: Executive Summary, Topsheet, categorie, dettaglio, regole e analisi.' : format === 'pptx' ? 'Copertina, sintesi executive e una o più slide per ogni sezione; le tabelle lunghe vengono suddivise.' : format === 'docx' ? 'Copertina, sezioni con interruzione di pagina, KPI, tabelle ripetute e piè di pagina numerati.' : 'Copertina, sezioni multipagina, KPI, tabelle con intestazioni ripetute e numerazione.'}</p></section>
        {error && <div className="inline-message error">{error}</div>}
      </div>
      <footer className="export-builder-footer"><div><button onClick={onExportCsv}>CSV dati grezzi</button><button onClick={onExportOpenSbs}>Open SBS JSON</button></div><button className="button primary export-generate" disabled={busy || !effective.length} onClick={() => void generate()}>{busy ? <LoaderCircle className="spin" size={17} /> : activeFormat.icon}<span>{busy ? 'Generazione…' : `Genera ${activeFormat.label}`}</span><small>{effective.length} sezioni</small></button></footer>
    </section>
  </div>;
}
