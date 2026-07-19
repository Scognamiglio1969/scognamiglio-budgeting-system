import { evaluateBudget } from './engine';
import type { BudgetProject, BudgetScenario } from './types';
import { strToU8, zipSync } from 'fflate';

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadBytes(name: string, content: Uint8Array, type: string) {
  const bytes = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function exportProjectJson(project: BudgetProject) {
  download(`sbs-${slug(project.title)}.json`, JSON.stringify(project, null, 2), 'application/json');
}

export function exportScenarioCsv(project: BudgetProject, scenario: BudgetScenario) {
  const rows = evaluateBudget(scenario.data).map((entry) => {
    const category = scenario.data.categories.find((value) => value.id === entry.item.categoryId);
    const account = scenario.data.accounts.find((value) => value.id === category?.accountId);
    const group = scenario.data.groups.find((value) => value.id === entry.item.groupId);
    return [
      account?.code ?? '', account?.name ?? '', category?.code ?? '', category?.name ?? '',
      entry.item.description, entry.item.kind, entry.item.quantity, entry.item.units,
      entry.item.rate, entry.item.multiplier, group?.code ?? '', entry.item.location,
      entry.base.toFixed(2), entry.fringe.toFixed(2), entry.total.toFixed(2), entry.item.note,
    ];
  });
  const header = ['Account code', 'Account', 'Category code', 'Category', 'Description', 'Type', 'Quantity', 'Units', 'Rate', 'Multiplier', 'Group', 'Location', 'Base', 'Fringes', 'Total', 'Note'];
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n');
  download(`sbs-${slug(project.title)}-${slug(scenario.name)}.csv`, csv, 'text/csv;charset=utf-8');
}

function xml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function columnName(index: number) {
  let value = index + 1;
  let name = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

export function buildScenarioXlsx(scenario: BudgetScenario) {
  const header = ['Account code', 'Account', 'Category code', 'Category', 'Description', 'Type', 'Quantity', 'Units', 'Rate', 'Multiplier', 'Currency', 'FX to base', 'Group', 'Location', 'Base', 'Fringes', 'Total', 'Note'];
  const rows: Array<Array<string | number>> = evaluateBudget(scenario.data).map((entry) => {
    const category = scenario.data.categories.find((value) => value.id === entry.item.categoryId);
    const account = scenario.data.accounts.find((value) => value.id === category?.accountId);
    const group = scenario.data.groups.find((value) => value.id === entry.item.groupId);
    return [
      account?.code ?? '', account?.name ?? '', category?.code ?? '', category?.name ?? '', entry.item.description,
      entry.item.kind, entry.quantity, entry.units, entry.rate, entry.multiplier, entry.item.currency, entry.fxRate,
      group?.code ?? '', entry.item.location, entry.base, entry.fringe, entry.total, entry.item.note,
    ];
  });
  const allRows = [header, ...rows];
  const sheetRows = allRows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((cell, columnIndex) => {
    const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
    if (typeof cell === 'number') return `<c r="${ref}" s="${columnIndex >= 14 ? 2 : 0}"><v>${cell}</v></c>`;
    return `<c r="${ref}" t="inlineStr" s="${rowIndex === 0 ? 1 : 0}"><is><t>${xml(String(cell))}</t></is></c>`;
  }).join('')}</row>`).join('');
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="4" width="18" customWidth="1"/><col min="5" max="5" width="34" customWidth="1"/><col min="6" max="14" width="14" customWidth="1"/><col min="15" max="17" width="15" customWidth="1"/><col min="18" max="18" width="34" customWidth="1"/></cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A1:R${allRows.length}"/></worksheet>`;
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(scenario.name.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    'xl/styles.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF6550E8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`),
    'xl/worksheets/sheet1.xml': strToU8(sheet),
  };
  return zipSync(files, { level: 6 });
}

export function exportScenarioXlsx(project: BudgetProject, scenario: BudgetScenario) {
  const archive = buildScenarioXlsx(scenario);
  downloadBytes(`sbs-${slug(project.title)}-${slug(scenario.name)}.xlsx`, archive, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
