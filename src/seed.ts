import type { BudgetData, BudgetLibrary, BudgetProject, LineItem } from './types';

const item = (
  id: string,
  categoryId: string,
  description: string,
  kind: LineItem['kind'],
  quantity: string,
  units: string,
  rate: string,
  groupId: string | null,
  location: string,
  note = '',
  currency = 'EUR',
): LineItem => ({ id, categoryId, description, kind, quantity, units, rate, multiplier: '1', currency, groupId, location, note });

export function createSeedData(): BudgetData {
  return {
    accounts: [
      { id: 'acc-1000', code: '1000', name: 'Story & Rights' },
      { id: 'acc-2000', code: '2000', name: 'Cast' },
      { id: 'acc-3000', code: '3000', name: 'Production' },
      { id: 'acc-4000', code: '4000', name: 'Camera & Lighting' },
      { id: 'acc-5000', code: '5000', name: 'Art Department' },
      { id: 'acc-6000', code: '6000', name: 'Locations & Travel' },
      { id: 'acc-7000', code: '7000', name: 'Post Production' },
    ],
    categories: [
      { id: 'cat-1100', accountId: 'acc-1000', code: '1100', name: 'Development' },
      { id: 'cat-2100', accountId: 'acc-2000', code: '2100', name: 'Principal cast' },
      { id: 'cat-3100', accountId: 'acc-3000', code: '3100', name: 'Production staff' },
      { id: 'cat-3200', accountId: 'acc-3000', code: '3200', name: 'Assistant directors' },
      { id: 'cat-4100', accountId: 'acc-4000', code: '4100', name: 'Camera crew' },
      { id: 'cat-4200', accountId: 'acc-4000', code: '4200', name: 'Camera equipment' },
      { id: 'cat-4300', accountId: 'acc-4000', code: '4300', name: 'Lighting & grip' },
      { id: 'cat-5100', accountId: 'acc-5000', code: '5100', name: 'Art crew' },
      { id: 'cat-5200', accountId: 'acc-5000', code: '5200', name: 'Set dressing' },
      { id: 'cat-6100', accountId: 'acc-6000', code: '6100', name: 'Locations' },
      { id: 'cat-6200', accountId: 'acc-6000', code: '6200', name: 'Travel & accommodation' },
      { id: 'cat-7100', accountId: 'acc-7000', code: '7100', name: 'Editorial' },
      { id: 'cat-7200', accountId: 'acc-7000', code: '7200', name: 'Sound & finishing' },
    ],
    globals: [
      { id: 'global-days', symbol: 'SHOOT_DAYS', name: 'Shooting days', value: 24, unit: 'days', description: 'Principal photography days' },
      { id: 'global-prep', symbol: 'PREP_WEEKS', name: 'Prep weeks', value: 4, unit: 'weeks', description: 'Standard department preparation' },
      { id: 'global-week', symbol: 'DAYS_WEEK', name: 'Working week', value: 5, unit: 'days', description: 'Paid days in a standard week' },
      { id: 'global-hours', symbol: 'HOURS_DAY', name: 'Hours per day', value: 10, unit: 'hours', description: 'Default working day' },
      { id: 'global-exchange', symbol: 'EUR_USD', name: 'EUR / USD rate', value: 1.09, unit: 'ratio', description: 'Working exchange rate' },
      { id: 'global-contingency', symbol: 'CONTINGENCY', name: 'Contingency', value: 5, unit: '%', description: 'Planning reserve percentage' },
    ],
    fringes: [
      { id: 'fringe-payroll', code: 'PAY', name: 'Payroll taxes', rate: 9.19, cap: null, kinds: ['labor'] },
      { id: 'fringe-pension', code: 'PEN', name: 'Pension contribution', rate: 7.5, cap: 55000, kinds: ['labor'] },
      { id: 'fringe-insurance', code: 'INS', name: 'Workers insurance', rate: 2.25, cap: null, kinds: ['labor'] },
      { id: 'fringe-kit', code: 'EQI', name: 'Equipment insurance', rate: 1.5, cap: null, kinds: ['equipment'] },
    ],
    groups: [
      { id: 'group-union', code: 'UNION', name: 'Union crew', fringeIds: ['fringe-payroll', 'fringe-pension', 'fringe-insurance'] },
      { id: 'group-cast', code: 'CAST', name: 'Principal cast', fringeIds: ['fringe-payroll', 'fringe-pension'] },
      { id: 'group-nonunion', code: 'NON-U', name: 'Non-union crew', fringeIds: ['fringe-payroll', 'fringe-insurance'] },
      { id: 'group-equipment', code: 'EQUIP', name: 'Insured equipment', fringeIds: ['fringe-kit'] },
    ],
    exchangeRates: [
      { id: 'fx-eur', currency: 'EUR', name: 'Euro', rateToBase: 1, updatedAt: '2026-07-19T10:00:00.000Z' },
      { id: 'fx-usd', currency: 'USD', name: 'US Dollar', rateToBase: 0.9174, updatedAt: '2026-07-19T10:00:00.000Z' },
      { id: 'fx-gbp', currency: 'GBP', name: 'Pound Sterling', rateToBase: 1.155, updatedAt: '2026-07-19T10:00:00.000Z' },
      { id: 'fx-chf', currency: 'CHF', name: 'Swiss Franc', rateToBase: 1.039, updatedAt: '2026-07-19T10:00:00.000Z' },
    ],
    incentives: [
      { id: 'incentive-italy', name: 'Italy production tax credit', jurisdiction: 'Italy', rate: 40, cap: 200000, locations: ['Rome', 'Tuscany', 'Milan'], kinds: ['labor', 'equipment', 'other'] },
    ],
    items: [
      item('item-writer', 'cat-1100', 'Screenplay rights & writer', 'labor', '1', '1', '28000', 'group-nonunion', 'Rome'),
      item('item-cast-a', 'cat-2100', 'Lead performer', 'labor', '1', 'SHOOT_DAYS', '1800', 'group-cast', 'Rome'),
      item('item-cast-b', 'cat-2100', 'Supporting performer', 'labor', '2', 'SHOOT_DAYS / 2', '850', 'group-cast', 'Rome'),
      item('item-line-producer', 'cat-3100', 'Line producer', 'labor', '1', 'PREP_WEEKS + 6', '2750', 'group-union', 'Rome'),
      item('item-coordinator', 'cat-3100', 'Production coordinator', 'labor', '1', 'PREP_WEEKS + 5', '1450', 'group-union', 'Rome'),
      item('item-ad1', 'cat-3200', '1st assistant director', 'labor', '1', 'SHOOT_DAYS', '520', 'group-union', 'Rome'),
      item('item-ad2', 'cat-3200', '2nd assistant director', 'labor', '1', 'SHOOT_DAYS', '360', 'group-union', 'Rome'),
      item('item-dop', 'cat-4100', 'Director of photography', 'labor', '1', 'SHOOT_DAYS + 5', '780', 'group-union', 'Rome'),
      item('item-focus', 'cat-4100', '1st AC / focus puller', 'labor', '1', 'SHOOT_DAYS + 3', '420', 'group-union', 'Rome'),
      item('item-camera', 'cat-4200', 'Cinema camera package', 'equipment', '1', 'SHOOT_DAYS', '940', 'group-equipment', 'Rome', 'Camera body, lenses and accessories'),
      item('item-digital', 'cat-4200', 'DIT & data package', 'equipment', '1', 'SHOOT_DAYS', '280', 'group-equipment', 'Rome'),
      item('item-lighting', 'cat-4300', 'Lighting package', 'equipment', '1', 'SHOOT_DAYS', '760', 'group-equipment', 'Rome'),
      item('item-grip', 'cat-4300', 'Grip package', 'equipment', '1', 'SHOOT_DAYS', '410', 'group-equipment', 'Rome'),
      item('item-designer', 'cat-5100', 'Production designer', 'labor', '1', 'PREP_WEEKS + 6', '2200', 'group-union', 'Rome'),
      item('item-setdress', 'cat-5200', 'Set dressing purchases', 'other', '1', '1', '22000', null, 'Rome'),
      item('item-location-rome', 'cat-6100', 'Rome permits & fees', 'other', '1', '1', '18500', null, 'Rome'),
      item('item-location-tuscany', 'cat-6100', 'Tuscany estate location', 'other', '1', '5', '3200', null, 'Tuscany'),
      item('item-hotel', 'cat-6200', 'Tuscany accommodation', 'travel', '32', '6', '145', null, 'Tuscany'),
      item('item-editor', 'cat-7100', 'Picture editor', 'labor', '1', '10', '2300', 'group-union', 'Remote'),
      item('item-grade', 'cat-7200', 'Color grade & online', 'other', '1', '5', '1800', null, 'Milan'),
      item('item-mix', 'cat-7200', 'Final sound mix', 'other', '1', '6', '1450', null, 'Milan'),
    ],
  };
}

function createLibraries(): BudgetLibrary[] {
  return [
    {
      id: 'library-camera', name: 'Standard camera department', type: 'crew',
      description: 'Core camera crew for a single-camera production.', updatedAt: '2026-07-19T10:00:00.000Z',
      items: [
        { description: 'Director of photography', kind: 'labor', quantity: '1', units: 'SHOOT_DAYS', rate: '780', multiplier: '1', currency: 'EUR', groupCode: 'UNION', location: 'Rome', note: '' },
        { description: '1st AC / focus puller', kind: 'labor', quantity: '1', units: 'SHOOT_DAYS', rate: '420', multiplier: '1', currency: 'EUR', groupCode: 'UNION', location: 'Rome', note: '' },
        { description: '2nd AC / loader', kind: 'labor', quantity: '1', units: 'SHOOT_DAYS', rate: '310', multiplier: '1', currency: 'EUR', groupCode: 'UNION', location: 'Rome', note: '' },
      ],
    },
    {
      id: 'library-interview', name: 'Documentary interview kit', type: 'package',
      description: 'Compact two-camera interview equipment package.', updatedAt: '2026-07-19T10:00:00.000Z',
      items: [
        { description: 'Two-camera interview package', kind: 'equipment', quantity: '1', units: 'SHOOT_DAYS', rate: '1250', multiplier: '1', currency: 'EUR', groupCode: 'EQUIP', location: '', note: 'Two bodies, primes and tripods' },
        { description: 'Interview lighting package', kind: 'equipment', quantity: '1', units: 'SHOOT_DAYS', rate: '480', multiplier: '1', currency: 'EUR', groupCode: 'EQUIP', location: '', note: '' },
        { description: 'Location sound package', kind: 'equipment', quantity: '1', units: 'SHOOT_DAYS', rate: '320', multiplier: '1', currency: 'EUR', groupCode: 'EQUIP', location: '', note: '' },
      ],
    },
    {
      id: 'library-post', name: 'Feature post package', type: 'package',
      description: 'Editorial, finishing and delivery baseline.', updatedAt: '2026-07-19T10:00:00.000Z',
      items: [
        { description: 'Picture editor', kind: 'labor', quantity: '1', units: '10', rate: '2300', multiplier: '1', currency: 'EUR', groupCode: 'UNION', location: 'Remote', note: '' },
        { description: 'Color grade & online', kind: 'other', quantity: '1', units: '5', rate: '1800', multiplier: '1', currency: 'EUR', groupCode: null, location: 'Milan', note: '' },
        { description: 'Final sound mix', kind: 'other', quantity: '1', units: '6', rate: '1450', multiplier: '1', currency: 'EUR', groupCode: null, location: 'Milan', note: '' },
      ],
    },
  ];
}

export function createSeedProject(): BudgetProject {
  const data = createSeedData();
  return {
    id: 'project-sbs-demo',
    title: 'The Last Frame',
    company: 'Scognamiglio Productions',
    currency: 'EUR',
    currencyLocale: 'it-IT',
    activeScenarioId: 'scenario-base',
    scenarios: [{
      id: 'scenario-base', name: 'Master budget', description: 'Approved working budget',
      createdAt: '2026-07-19T10:00:00.000Z', basedOn: null, isBase: true, scope: 'Full production', data,
    }],
    libraries: createLibraries(),
    changeLog: [{ id: 'change-initial', timestamp: '2026-07-19T10:00:00.000Z', label: 'Master budget created', scenarioId: 'scenario-base' }],
    syncMode: 'local',
    updatedAt: '2026-07-19T10:00:00.000Z',
  };
}
