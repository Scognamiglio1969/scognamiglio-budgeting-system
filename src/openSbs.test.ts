import { describe, expect, it } from 'vitest';
import { createSeedProject } from './seed';
import { createOpenSbsEnvelope, parseOpenSbsProject, serializeOpenSbs } from './openSbs';

describe('Open SBS Standard', () => {
  it('round-trips a versioned budget envelope', () => {
    const project = createSeedProject();
    const restored = parseOpenSbsProject(JSON.parse(serializeOpenSbs(project)));
    expect(restored.title).toBe(project.title);
    expect(restored.intelligence?.schedule.shootDays).toBe(24);
  });

  it('rejects unknown schema versions', () => {
    const envelope = createOpenSbsEnvelope(createSeedProject()) as unknown as { schemaVersion: string };
    envelope.schemaVersion = '99.0.0';
    expect(() => parseOpenSbsProject(envelope)).toThrow(/non supportata/);
  });

  it('migrates legacy unwrapped SBS projects', () => {
    const project = createSeedProject();
    delete project.intelligence;
    expect(parseOpenSbsProject(project).intelligence?.productionType).toBe('film');
  });
});
