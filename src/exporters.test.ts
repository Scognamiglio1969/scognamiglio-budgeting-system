import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { buildReportXlsx, buildScenarioXlsx } from './exporters';
import { buildBudgetReport, REPORT_SECTIONS } from './reporting';
import { createSeedProject } from './seed';

describe('Excel export', () => {
  it('creates a valid OpenXML workbook with budget detail', () => {
    const project = createSeedProject();
    const archive = unzipSync(buildScenarioXlsx(project.scenarios[0]));
    expect(Object.keys(archive)).toContain('[Content_Types].xml');
    expect(Object.keys(archive)).toContain('xl/workbook.xml');
    expect(Object.keys(archive)).toContain('xl/worksheets/sheet1.xml');
    const sheet = strFromU8(archive['xl/worksheets/sheet1.xml']);
    expect(sheet).toContain('Lead performer');
    expect(sheet).toContain('autoFilter');
  });

  it('creates a professional multi-sheet workbook from selected report sections', () => {
    const project = createSeedProject();
    const report = buildBudgetReport(project, project.scenarios[0], {
      format: 'xlsx', sections: ['executive', 'topsheet', 'details', 'risk'], includeAllScenarios: true,
      preparedFor: 'Production team', reportTitle: 'Full production budget', confidentiality: 'Riservato',
    });
    const archive = unzipSync(buildReportXlsx(report));
    const workbook = strFromU8(archive['xl/workbook.xml']);
    expect(Object.keys(archive).filter((name) => name.startsWith('xl/worksheets/sheet'))).toHaveLength(4);
    expect(workbook).toContain('Executive summary');
    expect(workbook).toContain('Topsheet per account');
    expect(strFromU8(archive['xl/worksheets/sheet3.xml'])).toContain('Lead performer');
  });

  it('marks slide-incompatible analytical sections explicitly', () => {
    expect(REPORT_SECTIONS.find((item) => item.id === 'details')?.formats).not.toContain('pptx');
    expect(REPORT_SECTIONS.find((item) => item.id === 'laborPlan')?.formats).toContain('xlsx');
    expect(REPORT_SECTIONS.find((item) => item.id === 'executive')?.formats).toContain('pptx');
  });

  it('exports days and weeks per person and department in the labor plan', () => {
    const project = createSeedProject();
    const report = buildBudgetReport(project, project.scenarios[0], { format: 'xlsx', sections: ['laborPlan'], includeAllScenarios: false, preparedFor: '', reportTitle: 'Crew plan', confidentiality: 'Uso interno' });
    const labor = report.sections[0];
    expect(labor.tables).toHaveLength(3);
    expect(labor.tables?.[0].headers).toContain('Giornate-persona');
    expect(labor.tables?.[0].rows.map((row) => row[0])).toEqual(['Pre-produzione', 'Produzione', 'Post-produzione']);
    expect(labor.tables?.[2].headers).toContain('Giorni per persona');
    expect(labor.tables?.[2].rows.some((row) => row.includes('Lead performer'))).toBe(true);
    const editor = labor.tables?.[2].rows.find((row) => row.includes('Picture editor'));
    expect(editor).toContain('Post-produzione');
    expect(editor).toContain('settimane');
    expect(editor).toContain(50);
  });
});
