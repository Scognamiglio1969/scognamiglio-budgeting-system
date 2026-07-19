import { describe, expect, it } from 'vitest';
import { evaluateExpression, evaluateItem } from './engine';
import type { BudgetData, LineItem } from './types';

const globals = [
  { id: 'g1', symbol: 'DAYS', name: 'Days', value: 10, unit: 'days', description: '' },
  { id: 'g2', symbol: 'RATE', name: 'Rate', value: 250, unit: 'EUR', description: '' },
];

describe('formula engine', () => {
  it('evaluates globals, precedence and parentheses', () => {
    expect(evaluateExpression('DAYS * RATE + 500', globals)).toBe(3000);
    expect(evaluateExpression('(DAYS + 2) * RATE', globals)).toBe(3000);
    expect(evaluateExpression('2 * -3', globals)).toBe(-6);
    expect(evaluateExpression('-(DAYS + 2)', globals)).toBe(-12);
  });

  it('rejects unknown globals and division by zero', () => {
    expect(() => evaluateExpression('MISSING * 2', globals)).toThrow('Unknown global');
    expect(() => evaluateExpression('4 / 0', globals)).toThrow('Division by zero');
  });
});

describe('fringe engine', () => {
  it('applies group rules and caps', () => {
    const item: LineItem = {
      id: 'i1', categoryId: 'c1', description: 'Crew', kind: 'labor',
      quantity: '1', units: 'DAYS', rate: 'RATE', multiplier: '1',
      currency: 'EUR', groupId: 'grp', location: '', note: '',
    };
    const data: BudgetData = {
      accounts: [], categories: [], items: [item], globals,
      groups: [{ id: 'grp', name: 'Union', code: 'UNI', fringeIds: ['tax'] }],
      fringes: [{ id: 'tax', code: 'TAX', name: 'Payroll tax', rate: 10, cap: 2000, kinds: ['labor'] }],
      exchangeRates: [{ id: 'eur', currency: 'EUR', name: 'Euro', rateToBase: 1, updatedAt: '' }],
      incentives: [],
    };
    const result = evaluateItem(item, data);
    expect(result.base).toBe(2500);
    expect(result.fringe).toBe(200);
    expect(result.total).toBe(2700);
  });
});
