import type { BudgetData, EvaluatedItem } from './types';

export function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createMoneyFormatter(currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 });
}

export function createDecimalFormatter(locale: string, digits = 2) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits });
}

export function accountItems(data: BudgetData, evaluated: EvaluatedItem[], accountId: string) {
  const categoryIds = new Set(data.categories.filter((category) => category.accountId === accountId).map((category) => category.id));
  return evaluated.filter((entry) => categoryIds.has(entry.item.categoryId));
}

export function relativeTime(timestamp: string) {
  const elapsed = Date.now() - new Date(timestamp).getTime();
  if (elapsed < 60_000) return 'adesso';
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} min fa`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} h fa`;
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(timestamp));
}
