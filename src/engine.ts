import type {
  BudgetData,
  BudgetTotals,
  EvaluatedItem,
  GlobalVariable,
  IncentiveResult,
  LineItem,
} from './types';

type Token = { type: 'number' | 'symbol' | 'operator' | 'left' | 'right'; value: string };

const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, 'u-': 3 };

function tokenize(expression: string): Token[] {
  const source = expression.trim();
  if (!source) throw new Error('Empty expression');

  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const rest = source.slice(index);
    const whitespace = rest.match(/^\s+/);
    if (whitespace) {
      index += whitespace[0].length;
      continue;
    }
    const number = rest.match(/^(?:\d+\.?\d*|\.\d+)/);
    if (number) {
      tokens.push({ type: 'number', value: number[0] });
      index += number[0].length;
      continue;
    }
    const symbol = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (symbol) {
      tokens.push({ type: 'symbol', value: symbol[0].toUpperCase() });
      index += symbol[0].length;
      continue;
    }
    const char = source[index];
    if ('+-*/'.includes(char)) tokens.push({ type: 'operator', value: char });
    else if (char === '(') tokens.push({ type: 'left', value: char });
    else if (char === ')') tokens.push({ type: 'right', value: char });
    else throw new Error(`Unexpected character “${char}”`);
    index += 1;
  }
  return tokens;
}

export function evaluateExpression(expression: string, globals: GlobalVariable[]): number {
  const values = new Map(globals.map((global) => [global.symbol.toUpperCase(), global.value]));
  const rawTokens = tokenize(expression);
  const tokens: Token[] = [];

  rawTokens.forEach((token, index) => {
    const previous = rawTokens[index - 1];
    const unaryMinus = token.type === 'operator' && token.value === '-' &&
      (!previous || previous.type === 'operator' || previous.type === 'left');
    tokens.push(unaryMinus ? { type: 'operator', value: 'u-' } : token);
  });

  const output: Token[] = [];
  const operators: Token[] = [];
  tokens.forEach((token) => {
    if (token.type === 'number' || token.type === 'symbol') output.push(token);
    else if (token.type === 'operator') {
      while (
        operators.length &&
        operators.at(-1)?.type === 'operator' &&
        (precedence[operators.at(-1)!.value] > precedence[token.value] ||
          (precedence[operators.at(-1)!.value] === precedence[token.value] && token.value !== 'u-'))
      ) output.push(operators.pop()!);
      operators.push(token);
    } else if (token.type === 'left') operators.push(token);
    else {
      while (operators.length && operators.at(-1)?.type !== 'left') output.push(operators.pop()!);
      if (!operators.length) throw new Error('Mismatched parentheses');
      operators.pop();
    }
  });
  while (operators.length) {
    const token = operators.pop()!;
    if (token.type === 'left') throw new Error('Mismatched parentheses');
    output.push(token);
  }

  const stack: number[] = [];
  output.forEach((token) => {
    if (token.type === 'number') stack.push(Number(token.value));
    else if (token.type === 'symbol') {
      const value = values.get(token.value);
      if (value === undefined) throw new Error(`Unknown global ${token.value}`);
      stack.push(value);
    } else {
      if (token.value === 'u-') {
        const operand = stack.pop();
        if (operand === undefined) throw new Error('Invalid expression');
        stack.push(-operand);
        return;
      }
      const right = stack.pop();
      const left = stack.pop();
      if (left === undefined || right === undefined) throw new Error('Invalid expression');
      if (token.value === '+') stack.push(left + right);
      if (token.value === '-') stack.push(left - right);
      if (token.value === '*') stack.push(left * right);
      if (token.value === '/') {
        if (right === 0) throw new Error('Division by zero');
        stack.push(left / right);
      }
    }
  });
  if (stack.length !== 1 || !Number.isFinite(stack[0])) throw new Error('Invalid expression');
  return stack[0];
}

function evaluateField(value: string, globals: GlobalVariable[], label: string, errors: string[]): number {
  try {
    return evaluateExpression(value, globals);
  } catch (error) {
    errors.push(`${label}: ${error instanceof Error ? error.message : 'invalid value'}`);
    return 0;
  }
}

export function evaluateItem(item: LineItem, data: BudgetData): EvaluatedItem {
  const errors: string[] = [];
  const quantity = evaluateField(item.quantity, data.globals, 'Quantity', errors);
  const units = evaluateField(item.units, data.globals, 'Units', errors);
  const rate = evaluateField(item.rate, data.globals, 'Rate', errors);
  const multiplier = evaluateField(item.multiplier, data.globals, 'Multiplier', errors);
  const exchange = data.exchangeRates.find((candidate) => candidate.currency === item.currency);
  if (!exchange) errors.push(`Currency: missing ${item.currency} exchange rate`);
  const fxRate = exchange?.rateToBase ?? 0;
  const sourceBase = quantity * units * rate * multiplier;
  const base = sourceBase * fxRate;
  const group = data.groups.find((candidate) => candidate.id === item.groupId);
  const rules = group
    ? data.fringes.filter((rule) => group.fringeIds.includes(rule.id) && rule.kinds.includes(item.kind))
    : [];
  const fringeBreakdown = rules.map((rule) => ({
    rule,
    amount: Math.max(0, Math.min(base, rule.cap ?? base) * (rule.rate / 100)),
  }));
  const fringe = fringeBreakdown.reduce((sum, entry) => sum + entry.amount, 0);
  return { item, quantity, units, rate, multiplier, fxRate, sourceCurrency: item.currency, sourceBase, base, fringe, total: base + fringe, fringeBreakdown, errors };
}

export function evaluateBudget(data: BudgetData): EvaluatedItem[] {
  return data.items.map((item) => evaluateItem(item, data));
}

export function calculateIncentives(data: BudgetData, items: EvaluatedItem[]): IncentiveResult[] {
  return data.incentives.map((incentive) => {
    const eligibleCost = items
      .filter((entry) => incentive.kinds.includes(entry.item.kind) && incentive.locations.includes(entry.item.location))
      .reduce((sum, entry) => sum + entry.total, 0);
    const calculated = eligibleCost * (incentive.rate / 100);
    return { incentive, eligibleCost, amount: Math.max(0, Math.min(calculated, incentive.cap ?? calculated)) };
  });
}

export function sumEvaluated(items: EvaluatedItem[], incentive = 0): BudgetTotals {
  const totals = items.reduce<BudgetTotals>(
    (totals, item) => ({
      base: totals.base + item.base,
      fringe: totals.fringe + item.fringe,
      total: totals.total + item.total,
      incentive: totals.incentive,
      net: totals.net + item.total,
      errors: totals.errors + item.errors.length,
    }),
    { base: 0, fringe: 0, total: 0, incentive: 0, net: 0, errors: 0 },
  );
  totals.incentive = incentive;
  totals.net = totals.total - incentive;
  return totals;
}

export function calculateBudgetTotals(data: BudgetData, items = evaluateBudget(data)): BudgetTotals {
  const incentive = calculateIncentives(data, items).reduce((sum, result) => sum + result.amount, 0);
  return sumEvaluated(items, incentive);
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
