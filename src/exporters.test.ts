import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { buildScenarioXlsx } from './exporters';
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
});
