import { evaluateBudget } from './engine';
import type { BudgetProject, BudgetScenario } from './types';
import { strToU8, zipSync } from 'fflate';
import { serializeOpenSbs } from './openSbs';
import type { BudgetReport, ReportCell, ReportSection, ReportTable } from './reporting';

function download(name: string, content: string, type: string) {
  downloadBlob(name, new Blob([content], { type }));
}

function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadBytes(name: string, content: Uint8Array, type: string) {
  const bytes = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer;
  downloadBlob(name, new Blob([bytes], { type }));
}

function slug(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function exportProjectJson(project: BudgetProject) {
  download(`sbs-${slug(project.title)}.open-sbs.json`, serializeOpenSbs(project), 'application/vnd.open-sbs+json');
}

export function exportScenarioCsv(project: BudgetProject, scenario: BudgetScenario) {
  const rows = evaluateBudget(scenario.data).map((entry) => {
    const category = scenario.data.categories.find((value) => value.id === entry.item.categoryId);
    const account = scenario.data.accounts.find((value) => value.id === category?.accountId);
    const group = scenario.data.groups.find((value) => value.id === entry.item.groupId);
    return [account?.code ?? '', account?.name ?? '', category?.code ?? '', category?.name ?? '', entry.item.description, entry.item.kind, entry.item.quantity, entry.item.units, entry.item.rate, entry.item.multiplier, group?.code ?? '', entry.item.location, entry.base.toFixed(2), entry.fringe.toFixed(2), entry.total.toFixed(2), entry.item.note];
  });
  const header = ['Account code', 'Account', 'Category code', 'Category', 'Description', 'Type', 'Quantity', 'Units', 'Rate', 'Multiplier', 'Group', 'Location', 'Base', 'Fringes', 'Total', 'Note'];
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
  download(`sbs-${slug(project.title)}-${slug(scenario.name)}.csv`, csv, 'text/csv;charset=utf-8');
}

function xml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function columnName(index: number) {
  let value = index + 1; let name = '';
  while (value > 0) { const remainder = (value - 1) % 26; name = String.fromCharCode(65 + remainder) + name; value = Math.floor((value - 1) / 26); }
  return name;
}

function safeSheetName(value: string, used: Set<string>) {
  const base = value.replace(/[\\/?*\[\]:]/g, ' ').trim().slice(0, 28) || 'Report';
  let name = base; let suffix = 2;
  while (used.has(name)) name = `${base.slice(0, 25)} ${suffix++}`;
  used.add(name); return name;
}

function xlsxRows(section: ReportSection): Array<Array<ReportCell>> {
  const rows: Array<Array<ReportCell>> = [[section.title], [section.subtitle], []];
  if (section.metrics?.length) {
    rows.push(section.metrics.map((item) => item.label));
    rows.push(section.metrics.map((item) => item.value));
    rows.push([]);
  }
  section.paragraphs?.forEach((paragraph) => rows.push([paragraph]));
  if (section.paragraphs?.length) rows.push([]);
  section.tables?.forEach((table, index) => {
    if (index) rows.push([]);
    rows.push(table.headers, ...table.rows);
  });
  return rows;
}

function numericStyle(header: string) {
  if (/quota|aliquota|%/i.test(header)) return 3;
  if (/base|fringe|totale|netto|beneficio|cap|importo|saldo|delta|costo|allocato|esplicito|condiviso/i.test(header)) return 2;
  return 0;
}

export function buildReportXlsx(report: BudgetReport) {
  const used = new Set<string>();
  const sheets = report.sections.map((section, index) => {
    const name = safeSheetName(`${String(index + 1).padStart(2, '0')} ${section.title}`, used);
    const rows = xlsxRows(section);
    const tableHeaderRows = new Set<number>();
    let cursor = 3 + (section.metrics?.length ? 3 : 0) + (section.paragraphs?.length ? section.paragraphs.length + 1 : 0);
    section.tables?.forEach((table, tableIndex) => { if (tableIndex) cursor += 1; tableHeaderRows.add(cursor); cursor += table.rows.length + 1; });
    const maxCols = Math.max(1, ...rows.map((row) => row.length));
    const sheetRows = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}"${rowIndex === 0 ? ' ht="26" customHeight="1"' : ''}>${row.map((cell, columnIndex) => {
      const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
      const header = [...tableHeaderRows].filter((value) => value < rowIndex).at(-1);
      const headerText = header === undefined ? '' : String(rows[header]?.[columnIndex] ?? '');
      const style = rowIndex === 0 ? 4 : rowIndex === 1 ? 5 : tableHeaderRows.has(rowIndex) ? 1 : typeof cell === 'number' ? numericStyle(headerText) : 0;
      if (typeof cell === 'number') return `<c r="${ref}" s="${style}"><v>${cell}</v></c>`;
      return `<c r="${ref}" t="inlineStr" s="${style}"><is><t>${xml(String(cell))}</t></is></c>`;
    }).join('')}</row>`).join('');
    const widths = Array.from({ length: maxCols }, (_, columnIndex) => {
      const isMoneyColumn = [...tableHeaderRows].some((rowIndex) => numericStyle(String(rows[rowIndex]?.[columnIndex] ?? '')) === 2);
      const width = Math.min(42, Math.max(isMoneyColumn ? 18 : 12, ...rows.map((row) => String(row[columnIndex] ?? '').length + 2)));
      return `<col min="${columnIndex + 1}" max="${columnIndex + 1}" width="${width}" customWidth="1"/>`;
    }).join('');
    const firstHeader = tableHeaderRows.size ? Math.min(...tableHeaderRows) : null;
    const firstTable = section.tables?.[0];
    const freeze = firstHeader === null ? '' : `<pane ySplit="${firstHeader + 1}" topLeftCell="A${firstHeader + 2}" activePane="bottomLeft" state="frozen"/>`;
    const autoFilter = firstHeader === null || !firstTable ? '' : `<autoFilter ref="A${firstHeader + 1}:${columnName(firstTable.headers.length - 1)}${firstHeader + firstTable.rows.length + 1}"/>`;
    return { name, xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0">${freeze}</sheetView></sheetViews><cols>${widths}</cols><sheetData>${sheetRows}</sheetData>${autoFilter}<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>` };
  });
  const contentOverrides = sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
  const workbookSheets = sheets.map((sheet, index) => `<sheet name="${xml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('');
  const relationships = sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('');
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${contentOverrides}</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    'xl/styles.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="#,#00 [$${xml(report.currency)}]"/><numFmt numFmtId="165" formatCode="0.0%"/></numFmts><fonts count="3"><font><sz val="10"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Aptos"/></font><font><b/><color rgb="FF352A72"/><sz val="18"/><name val="Aptos Display"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF6550E8"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1EFFE"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFill="1" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment horizontal="left"/></xf></cellXfs></styleSheet>`),
  };
  sheets.forEach((sheet, index) => { files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(sheet.xml); });
  return zipSync(files, { level: 6 });
}

export function exportReportXlsx(report: BudgetReport) {
  downloadBytes(`sbs-${slug(report.project.title)}-${slug(report.scenario.name)}-report.xlsx`, buildReportXlsx(report), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

/** Backward-compatible analytical workbook used by existing integrations. */
export function buildScenarioXlsx(scenario: BudgetScenario) {
  const fakeProject = { id: '', title: scenario.name, company: '', currency: 'EUR', currencyLocale: 'it-IT', activeScenarioId: scenario.id, scenarios: [scenario], libraries: [], changeLog: [], syncMode: 'local', updatedAt: new Date().toISOString() } as BudgetProject;
  const report: BudgetReport = { title: scenario.name, subtitle: '', project: fakeProject, scenario, currency: 'EUR', generatedAt: new Date().toISOString(), preparedFor: '', confidentiality: '', sections: [{ id: 'details', title: 'Dettaglio completo', subtitle: '', tables: [{ headers: ['Account code', 'Account', 'Category code', 'Category', 'Description', 'Type', 'Quantity', 'Units', 'Rate', 'Multiplier', 'Currency', 'FX to base', 'Group', 'Location', 'Base', 'Fringes', 'Total', 'Note'], rows: evaluateBudget(scenario.data).map((entry) => { const category = scenario.data.categories.find((value) => value.id === entry.item.categoryId); const account = scenario.data.accounts.find((value) => value.id === category?.accountId); const group = scenario.data.groups.find((value) => value.id === entry.item.groupId); return [account?.code ?? '', account?.name ?? '', category?.code ?? '', category?.name ?? '', entry.item.description, entry.item.kind, entry.quantity, entry.units, entry.rate, entry.multiplier, entry.item.currency, entry.fxRate, group?.code ?? '', entry.item.location, entry.base, entry.fringe, entry.total, entry.item.note]; }) }] }] };
  return buildReportXlsx(report);
}

function displayCell(value: ReportCell, header: string, currency: string) {
  if (typeof value !== 'number') return String(value);
  if (/quota|aliquota|%/i.test(header)) return `${(value * 100).toFixed(1)}%`;
  if (/base|fringe|totale|netto|beneficio|cap|importo|saldo|delta|costo|allocato|esplicito|condiviso/i.test(header)) return new Intl.NumberFormat('it-IT', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  return new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(value);
}

export async function exportReportDocx(report: BudgetReport) {
  const { AlignmentType, BorderStyle, Document, Footer, HeadingLevel, PageBreak, PageNumber, PageOrientation, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } = await import('docx');
  const border = { style: BorderStyle.SINGLE, color: 'D9D5EC', size: 1 };
  const cell = (value: string, bold = false, color = '29243D') => new TableCell({ borders: { top: border, bottom: border, left: border, right: border }, shading: bold ? { type: ShadingType.CLEAR, fill: '6550E8', color: 'auto' } : undefined, margins: { top: 80, bottom: 80, left: 90, right: 90 }, children: [new Paragraph({ children: [new TextRun({ text: value, bold, color: bold ? 'FFFFFF' : color, size: 17 })] })] });
  const children: InstanceType<typeof Paragraph | typeof Table>[] = [
    new Paragraph({ spacing: { before: 1200, after: 160 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'SBS', bold: true, color: '6550E8', size: 22 })] }),
    new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 220 }, children: [new TextRun({ text: report.title, bold: true, color: '29243D', size: 42 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 720 }, children: [new TextRun({ text: report.subtitle, color: '6F6982', size: 24 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: report.confidentiality.toUpperCase(), bold: true, color: 'C34A66', size: 18 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: report.preparedFor ? `Preparato per ${report.preparedFor}` : 'Report di produzione', color: '6F6982', size: 18 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: new Date(report.generatedAt).toLocaleString('it-IT'), color: '8A849B', size: 16 })] }),
  ];
  report.sections.forEach((section) => {
    children.push(new Paragraph({ children: [new PageBreak()] }), new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: section.title, bold: true, color: '352A72', size: 30 })] }), new Paragraph({ spacing: { after: 220 }, children: [new TextRun({ text: section.subtitle, color: '6F6982', size: 19 })] }));
    if (section.metrics?.length) children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: section.metrics.map((item) => cell(item.label, true)) }), new TableRow({ children: section.metrics.map((item) => cell(item.value, false, '352A72')) })] }));
    section.paragraphs?.forEach((paragraph) => children.push(new Paragraph({ spacing: { before: 140, after: 80 }, children: [new TextRun({ text: paragraph, size: 19 })] })));
    section.tables?.forEach((table) => {
      children.push(new Paragraph({ spacing: { before: 220 } }));
      const rows = [new TableRow({ tableHeader: true, children: table.headers.map((header) => cell(header, true)) }), ...table.rows.map((row) => new TableRow({ cantSplit: true, children: row.map((value, index) => cell(displayCell(value, table.headers[index] ?? '', report.currency))) }))];
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
    });
  });
  const doc = new Document({ creator: 'Scognamiglio Budgeting System', title: report.title, description: report.subtitle, sections: [{ properties: { page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 720, right: 620, bottom: 720, left: 620 } } }, footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${report.confidentiality} · SBS · `, color: '8A849B', size: 15 }), new TextRun({ children: [PageNumber.CURRENT], color: '8A849B', size: 15 })] })] }) }, children }] });
  downloadBlob(`sbs-${slug(report.project.title)}-${slug(report.scenario.name)}-report.docx`, await Packer.toBlob(doc));
}

export async function exportReportPdf(report: BudgetReport) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const pageW = 297; const pageH = 210; const margin = 14;
  const addFooter = () => { pdf.setDrawColor(220, 216, 235); pdf.line(margin, pageH - 11, pageW - margin, pageH - 11); pdf.setFontSize(7); pdf.setTextColor(120, 114, 139); pdf.text(`${report.confidentiality} · SBS · ${report.project.title}`, margin, pageH - 6); pdf.text(String(pdf.getNumberOfPages()), pageW - margin, pageH - 6, { align: 'right' }); };
  const newSectionPage = (section: ReportSection) => { if (pdf.getNumberOfPages() > 0) addFooter(); pdf.addPage('a4', 'landscape'); pdf.setFillColor(101, 80, 232); pdf.rect(0, 0, 6, pageH, 'F'); pdf.setTextColor(53, 42, 114); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(19); pdf.text(section.title, margin, 20); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(111, 105, 130); pdf.setFontSize(9); pdf.text(section.subtitle, margin, 27); };
  pdf.setFillColor(16, 14, 25); pdf.rect(0, 0, pageW, pageH, 'F'); pdf.setTextColor(129, 111, 255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16); pdf.text('SBS · SCOGNAMIGLIO BUDGETING SYSTEM', margin, 26); pdf.setTextColor(255, 255, 255); pdf.setFontSize(30); pdf.text(pdf.splitTextToSize(report.title, 220), margin, 64); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(194, 188, 214); pdf.setFontSize(14); pdf.text(report.subtitle, margin, 91); pdf.setFontSize(10); pdf.text(`${report.confidentiality}${report.preparedFor ? ` · Preparato per ${report.preparedFor}` : ''}`, margin, 112); pdf.text(new Date(report.generatedAt).toLocaleString('it-IT'), margin, 120);
  report.sections.forEach((section) => {
    newSectionPage(section); let y = 36;
    if (section.metrics?.length) { const width = (pageW - margin * 2 - (section.metrics.length - 1) * 3) / section.metrics.length; section.metrics.forEach((item, index) => { const x = margin + index * (width + 3); pdf.setFillColor(243, 241, 252); pdf.roundedRect(x, y, width, 19, 2, 2, 'F'); pdf.setFontSize(6.5); pdf.setTextColor(111, 105, 130); pdf.text(item.label.toUpperCase(), x + 3, y + 6); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(53, 42, 114); pdf.text(pdf.splitTextToSize(item.value, width - 6)[0], x + 3, y + 14); pdf.setFont('helvetica', 'normal'); }); y += 26; }
    section.paragraphs?.forEach((paragraph) => { pdf.setFontSize(9); pdf.setTextColor(50, 46, 61); const lines = pdf.splitTextToSize(paragraph, pageW - margin * 2); pdf.text(lines, margin, y); y += lines.length * 4.5 + 3; });
    section.tables?.forEach((table) => {
      const colCount = table.headers.length; const colW = (pageW - margin * 2) / colCount; const fontSize = colCount > 9 ? 5.2 : colCount > 6 ? 6 : 7;
      const drawHeader = () => { pdf.setFillColor(101, 80, 232); pdf.rect(margin, y, pageW - margin * 2, 8, 'F'); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(255, 255, 255); pdf.setFontSize(fontSize); table.headers.forEach((header, i) => pdf.text(pdf.splitTextToSize(header, colW - 2)[0], margin + i * colW + 1, y + 5)); y += 8; pdf.setFont('helvetica', 'normal'); };
      if (y > pageH - 30) { newSectionPage(section); y = 36; } drawHeader();
      table.rows.forEach((row, rowIndex) => { const values = row.map((value, index) => pdf.splitTextToSize(displayCell(value, table.headers[index] ?? '', report.currency), colW - 2)); const rowH = Math.max(7, ...values.map((lines) => lines.length * 3.3 + 2)); if (y + rowH > pageH - 15) { addFooter(); pdf.addPage('a4', 'landscape'); pdf.setFillColor(101, 80, 232); pdf.rect(0, 0, 6, pageH, 'F'); y = 14; drawHeader(); } if (rowIndex % 2) { pdf.setFillColor(248, 247, 252); pdf.rect(margin, y, pageW - margin * 2, rowH, 'F'); } pdf.setTextColor(45, 41, 56); pdf.setFontSize(fontSize); values.forEach((lines, i) => pdf.text(lines, margin + i * colW + 1, y + 4)); y += rowH; }); y += 5;
    });
  });
  addFooter();
  pdf.save(`sbs-${slug(report.project.title)}-${slug(report.scenario.name)}-report.pdf`);
}

export async function exportReportPptx(report: BudgetReport) {
  const module = await import('pptxgenjs'); const PptxGenJS = module.default; const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; pptx.author = 'Scognamiglio Budgeting System'; pptx.subject = report.subtitle; pptx.title = report.title; pptx.company = report.project.company; pptx.theme = { headFontFace: 'Aptos Display', bodyFontFace: 'Aptos' };
  const addChrome = (slide: ReturnType<typeof pptx.addSlide>, title: string, subtitle: string, page: number) => { slide.background = { color: 'FAF9FC' }; slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: 7.5, fill: { color: '6550E8' }, line: { color: '6550E8' } }); slide.addText(title, { x: 0.55, y: 0.38, w: 9.5, h: 0.45, fontFace: 'Aptos Display', fontSize: 24, bold: true, color: '352A72', margin: 0, breakLine: false, fit: 'shrink' }); slide.addText(subtitle, { x: 0.55, y: 0.88, w: 11.5, h: 0.28, fontSize: 10, color: '6F6982', margin: 0, fit: 'shrink' }); slide.addText(`${report.confidentiality} · SBS`, { x: 0.55, y: 7.1, w: 4, h: 0.18, fontSize: 7, color: '8A849B', margin: 0 }); slide.addText(String(page), { x: 12.2, y: 7.1, w: 0.5, h: 0.18, fontSize: 7, color: '8A849B', align: 'right', margin: 0 }); };
  let page = 1; const cover = pptx.addSlide(); cover.background = { color: '100E19' }; cover.addText('SBS · SCOGNAMIGLIO BUDGETING SYSTEM', { x: 0.7, y: 0.65, w: 7, h: 0.35, fontSize: 14, bold: true, color: '8170FF', margin: 0 }); cover.addText(report.title, { x: 0.7, y: 1.75, w: 11.5, h: 1.4, fontFace: 'Aptos Display', fontSize: 32, bold: true, color: 'FFFFFF', margin: 0, breakLine: false, fit: 'shrink' }); cover.addText(report.subtitle, { x: 0.7, y: 3.35, w: 10, h: 0.55, fontSize: 18, color: 'C2BCD6', margin: 0, fit: 'shrink' }); cover.addText(`${report.confidentiality}${report.preparedFor ? ` · Preparato per ${report.preparedFor}` : ''}`, { x: 0.7, y: 5.9, w: 8, h: 0.3, fontSize: 11, color: 'F09CB0', margin: 0 }); cover.addText(new Date(report.generatedAt).toLocaleDateString('it-IT'), { x: 0.7, y: 6.35, w: 4, h: 0.25, fontSize: 9, color: '8A849B', margin: 0 });
  report.sections.forEach((section) => {
    const tables = section.tables ?? []; const chunks: Array<{ table?: ReportTable; rows?: ReportCell[][]; first: boolean }> = [];
    if (!tables.length) chunks.push({ first: true });
    tables.forEach((table, tableIndex) => { const size = table.headers.length > 8 ? 8 : 12; for (let i = 0; i < Math.max(1, table.rows.length); i += size) chunks.push({ table, rows: table.rows.slice(i, i + size), first: tableIndex === 0 && i === 0 }); });
    chunks.forEach((chunk, chunkIndex) => { const slide = pptx.addSlide(); page += 1; addChrome(slide, `${section.title}${chunkIndex ? ' · continua' : ''}`, section.subtitle, page); let y = 1.35;
      if (chunk.first && section.metrics?.length) { const width = Math.min(2.15, 11.9 / section.metrics.length); section.metrics.forEach((item, index) => { const x = 0.55 + index * (width + 0.12); slide.addShape(pptx.ShapeType.roundRect, { x, y, w: width, h: 0.85, rectRadius: 0.05, fill: { color: 'F1EFFE' }, line: { color: 'DED8F6', width: 0.7 } }); slide.addText(item.label.toUpperCase(), { x: x + 0.12, y: y + 0.12, w: width - 0.24, h: 0.18, fontSize: 7, bold: true, color: '6F6982', margin: 0, fit: 'shrink' }); slide.addText(item.value, { x: x + 0.12, y: y + 0.42, w: width - 0.24, h: 0.25, fontSize: 14, bold: true, color: '352A72', margin: 0, fit: 'shrink' }); }); y += 1.08; }
      if (chunk.first && section.paragraphs?.length) { slide.addText(section.paragraphs.join('\n'), { x: 0.65, y, w: 11.9, h: 1.2, fontSize: 14, color: '29243D', breakLine: false, margin: 0.05, valign: 'middle', fit: 'shrink' }); y += 1.35; }
      if (chunk.table) { const rows = [chunk.table.headers.map((value) => ({ text: value, options: { bold: true, color: 'FFFFFF', fill: { color: '6550E8' } } })), ...(chunk.rows ?? []).map((row) => row.map((value, index) => ({ text: displayCell(value, chunk.table!.headers[index] ?? '', report.currency) })))]; slide.addTable(rows, { x: 0.55, y, w: 12.2, h: Math.min(5.45, 0.42 + (chunk.rows?.length ?? 0) * 0.45), border: { type: 'solid', color: 'DED8E8', pt: 0.5 }, fill: { color: 'FFFFFF' }, color: '29243D', fontFace: 'Aptos', fontSize: chunk.table.headers.length > 8 ? 7 : 9, margin: 0.06, rowH: 0.4, valign: 'middle', breakLine: false }); }
    });
  });
  const close = pptx.addSlide(); page += 1; addChrome(close, 'Quadro pronto per la revisione', 'Sintesi conclusiva e prossimi passaggi', page);
  const executive = report.sections.find((section) => section.id === 'executive');
  const net = executive?.metrics?.find((metric) => metric.label === 'Budget netto')?.value ?? '—';
  close.addText('BUDGET NETTO', { x: 0.7, y: 1.65, w: 2.5, h: 0.25, fontSize: 9, bold: true, color: '6F6982', margin: 0 });
  close.addText(net, { x: 0.7, y: 2.02, w: 5.2, h: 0.7, fontSize: 32, bold: true, color: '352A72', margin: 0, fit: 'shrink' });
  [['1', 'Validare assunzioni', 'Durate, organico, tariffe e tassi di cambio.'], ['2', 'Confermare compliance', 'Fringe, cap, incentivi e fonti normative.'], ['3', 'Approvare lo scenario', 'Congelare la versione e condividere il report.']].forEach(([number, title, body], index) => {
    const x = 0.7 + index * 4.05; close.addShape(pptx.ShapeType.roundRect, { x, y: 3.25, w: 3.65, h: 1.55, rectRadius: 0.04, fill: { color: index === 2 ? '352A72' : 'F1EFFE' }, line: { color: index === 2 ? '352A72' : 'DED8F6', width: 0.8 } });
    close.addText(number, { x: x + 0.18, y: 3.45, w: 0.38, h: 0.3, fontSize: 16, bold: true, color: index === 2 ? 'BFB6FF' : '6550E8', margin: 0 });
    close.addText(title, { x: x + 0.65, y: 3.42, w: 2.7, h: 0.3, fontSize: 13, bold: true, color: index === 2 ? 'FFFFFF' : '352A72', margin: 0, fit: 'shrink' });
    close.addText(body, { x: x + 0.18, y: 3.93, w: 3.25, h: 0.55, fontSize: 10, color: index === 2 ? 'E4E0F2' : '5F5970', margin: 0, fit: 'shrink' });
  });
  await pptx.writeFile({ fileName: `sbs-${slug(report.project.title)}-${slug(report.scenario.name)}-report.pptx` });
}
