import { describe, expect, it } from 'vitest';
import { validatePassword } from './security';

describe('password policy', () => {
  it('rejects incomplete passwords', () => {
    expect(validatePassword('soloparole').valid).toBe(false);
  });

  it('accepts a strong password', () => {
    expect(validatePassword('Budget!2026Sicuro').valid).toBe(true);
  });
});
