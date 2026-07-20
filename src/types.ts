export type LineKind = 'labor' | 'equipment' | 'travel' | 'other';

export interface BudgetAccount {
  id: string;
  code: string;
  name: string;
  description?: string;
}

export interface BudgetCategory {
  id: string;
  accountId: string;
  code: string;
  name: string;
}

export interface GlobalVariable {
  id: string;
  symbol: string;
  name: string;
  value: number;
  unit: string;
  description: string;
}

export interface FringeRule {
  id: string;
  code: string;
  name: string;
  rate: number;
  cap: number | null;
  kinds: LineKind[];
  provenance?: RateProvenance;
}

export interface BudgetGroup {
  id: string;
  name: string;
  code: string;
  fringeIds: string[];
}

export interface ExchangeRate {
  id: string;
  currency: string;
  name: string;
  rateToBase: number;
  updatedAt: string;
}

export interface TaxIncentive {
  id: string;
  name: string;
  jurisdiction: string;
  rate: number;
  cap: number | null;
  locations: string[];
  kinds: LineKind[];
  provenance?: RateProvenance;
}

export interface RateProvenance {
  authority: string;
  title: string;
  sourceUrl: string;
  effectiveFrom: string;
  effectiveTo?: string;
  verifiedAt: string;
}

export interface RiskEstimate {
  lowPercent: number;
  highPercent: number;
  note?: string;
}

export interface LineItem {
  id: string;
  categoryId: string;
  description: string;
  kind: LineKind;
  quantity: string;
  units: string;
  rate: string;
  multiplier: string;
  currency: string;
  groupId: string | null;
  location: string;
  note: string;
  entityId?: string | null;
  rateProvenance?: RateProvenance;
  risk?: RiskEstimate;
}

export interface ProjectJurisdiction {
  countryCode: string;
  countryName: string;
  region: string;
  effectiveDate: string;
  euApplicable: boolean;
  lastLegalCheckAt: string | null;
  lastLegalQuery: string;
}

export interface ProductionEntity {
  id: string;
  name: string;
  countryCode: string;
  currency: string;
  sharePercent: number;
}

export interface CashFlowEntry {
  id: string;
  date: string;
  label: string;
  type: 'inflow' | 'outflow';
  amount: number;
  status: 'forecast' | 'committed' | 'paid';
  entityId?: string | null;
}

export interface ProjectIntelligence {
  jurisdiction: ProjectJurisdiction;
  productionEntities: ProductionEntity[];
  cashFlow: CashFlowEntry[];
  targetBudget: number | null;
  benchmarkOptIn: boolean;
}

export interface BudgetData {
  accounts: BudgetAccount[];
  categories: BudgetCategory[];
  items: LineItem[];
  globals: GlobalVariable[];
  fringes: FringeRule[];
  groups: BudgetGroup[];
  exchangeRates: ExchangeRate[];
  incentives: TaxIncentive[];
}

export interface BudgetScenario {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  basedOn: string | null;
  isBase: boolean;
  scope: string;
  data: BudgetData;
}

export interface LibraryItem {
  description: string;
  kind: LineKind;
  quantity: string;
  units: string;
  rate: string;
  multiplier: string;
  currency: string;
  groupCode: string | null;
  location: string;
  note: string;
}

export interface BudgetLibrary {
  id: string;
  name: string;
  type: 'crew' | 'equipment' | 'package' | 'custom' | 'setup';
  description: string;
  updatedAt: string;
  items: LibraryItem[];
  setup?: Pick<BudgetData, 'globals' | 'fringes' | 'groups'>;
}

export interface BudgetProject {
  id: string;
  title: string;
  company: string;
  currency: string;
  currencyLocale: string;
  activeScenarioId: string;
  scenarios: BudgetScenario[];
  libraries: BudgetLibrary[];
  changeLog: ChangeLogEntry[];
  syncMode: 'local' | 'cloud';
  updatedAt: string;
  intelligence?: ProjectIntelligence;
}

export interface ChangeLogEntry {
  id: string;
  timestamp: string;
  label: string;
  scenarioId: string;
}

export interface EvaluatedItem {
  item: LineItem;
  quantity: number;
  units: number;
  rate: number;
  multiplier: number;
  fxRate: number;
  sourceCurrency: string;
  sourceBase: number;
  base: number;
  fringe: number;
  total: number;
  fringeBreakdown: Array<{ rule: FringeRule; amount: number }>;
  errors: string[];
}

export interface BudgetTotals {
  base: number;
  fringe: number;
  total: number;
  incentive: number;
  net: number;
  errors: number;
}

export interface IncentiveResult {
  incentive: TaxIncentive;
  eligibleCost: number;
  amount: number;
}

export type AppView = 'topsheet' | 'budget' | 'globals' | 'fringes' | 'scenarios' | 'libraries' | 'resources' | 'compliance';
