import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

const SOURCE_DIR = join(ROOT, 'data/source');
const ANALYSIS_DIR = join(ROOT, 'analysis');

export type Category =
  | 'chip_designer'
  | 'hyperscaler'
  | 'ai_lab'
  | 'neocloud'
  | 'data_center'
  | 'memory'
  | 'server_oem'
  | 'networking'
  | 'power'
  | 'equipment'
  | 'packaging'
  | 'foundry'
  | 'investor';

export interface Company {
  slug: string;
  name: string;
  ticker?: string;
  category: Category;
  subline?: string;
}

export type DealType =
  | 'gpu_purchase'
  | 'custom_asic'
  | 'equity_investment'
  | 'cloud_capacity'
  | 'm_and_a'
  | 'funding_round'
  | 'power_ppa'
  | 'equipment_supply';

export interface SourceDeal {
  id: string;
  source_slug: string;
  source_name: string;
  target_slug: string;
  target_name: string;
  deal_type: DealType;
  value_billions: number | null;
  value_display?: string | null;
  date: string;
  date_display: string;
  description: string;
  source_url: string;
}

export type Verdict = 'buildout' | 'circular' | 'mixed' | 'pending';
export type IllustrationTone = 'flattering' | 'satirical' | 'neutral';

export interface RubricItem {
  score: number | null;
  note: string;
}

export interface Analysis {
  id: string;
  verdict: Verdict;
  circularity_score: number | null;
  principals_involved: string[];
  rubric: Record<string, RubricItem>;
  incentive_map?: string;
  circularity_notes?: string;
  illustration_tone: IllustrationTone;
  illustration_prompt?: string;
}

export interface Principal {
  slug: string;
  name: string;
  role: string;
  companies: string[];
  pantheon: { god: string; epithet: string; note: string };
}

export interface Deal extends SourceDeal {
  analysis: Analysis | null;
  source_company: Company | undefined;
  target_company: Company | undefined;
  source_principals: Principal[];
  target_principals: Principal[];
  is_reverse_edge_present: boolean;
}

function loadYaml<T>(path: string): T {
  return yaml.load(readFileSync(path, 'utf8')) as T;
}

let _companies: Company[] | null = null;
export function getCompanies(): Company[] {
  if (_companies) return _companies;
  _companies = loadYaml<Company[]>(join(SOURCE_DIR, 'companies.yml'));
  return _companies;
}

export function getCompanyMap(): Map<string, Company> {
  const m = new Map<string, Company>();
  for (const c of getCompanies()) m.set(c.slug, c);
  return m;
}

let _principals: Principal[] | null = null;
export function getPrincipals(): Principal[] {
  if (_principals) return _principals;
  _principals = loadYaml<Principal[]>(join(ROOT, 'principals.yml'));
  return _principals;
}

export function getPrincipalsByCompany(): Map<string, Principal[]> {
  const m = new Map<string, Principal[]>();
  for (const p of getPrincipals()) {
    for (const company of p.companies) {
      const list = m.get(company) ?? [];
      list.push(p);
      m.set(company, list);
    }
  }
  return m;
}

let _sourceDeals: SourceDeal[] | null = null;
function getSourceDeals(): SourceDeal[] {
  if (_sourceDeals) return _sourceDeals;
  const dir = join(SOURCE_DIR, 'deals');
  const files = readdirSync(dir).filter((f) => f.endsWith('.yml'));
  _sourceDeals = files.map((f) => loadYaml<SourceDeal>(join(dir, f)));
  return _sourceDeals;
}

function getAnalysisMap(): Map<string, Analysis> {
  const m = new Map<string, Analysis>();
  if (!existsSync(ANALYSIS_DIR)) return m;
  const files = readdirSync(ANALYSIS_DIR).filter(
    (f) => f.endsWith('.yml') && !f.startsWith('_'),
  );
  for (const f of files) {
    const a = loadYaml<Analysis>(join(ANALYSIS_DIR, f));
    if (!a?.id) continue;
    m.set(a.id, a);
  }
  return m;
}

function buildReverseEdgeSet(deals: SourceDeal[]): Set<string> {
  // Set of "source_slug->target_slug" pairs. We then ask, for a deal A→B,
  // whether B→A also exists. Crude but useful first-pass circularity hint.
  const present = new Set<string>();
  for (const d of deals) {
    present.add(`${d.source_slug}->${d.target_slug}`);
  }
  const reversed = new Set<string>();
  for (const key of present) {
    const [a, b] = key.split('->');
    if (present.has(`${b}->${a}`)) reversed.add(key);
  }
  return reversed;
}

let _deals: Deal[] | null = null;
export function getDeals(): Deal[] {
  if (_deals) return _deals;
  const source = getSourceDeals();
  const analysisMap = getAnalysisMap();
  const companyMap = getCompanyMap();
  const principalsByCo = getPrincipalsByCompany();
  const reverseSet = buildReverseEdgeSet(source);

  _deals = source.map((d) => ({
    ...d,
    analysis: analysisMap.get(d.id) ?? null,
    source_company: companyMap.get(d.source_slug),
    target_company: companyMap.get(d.target_slug),
    source_principals: principalsByCo.get(d.source_slug) ?? [],
    target_principals: principalsByCo.get(d.target_slug) ?? [],
    is_reverse_edge_present: reverseSet.has(`${d.source_slug}->${d.target_slug}`),
  }));

  _deals.sort((a, b) => b.date.localeCompare(a.date));
  return _deals;
}

export function getDealById(id: string): Deal | undefined {
  return getDeals().find((d) => d.id === id);
}

export function getDealsByPrincipal(slug: string): Deal[] {
  const principal = getPrincipals().find((p) => p.slug === slug);
  if (!principal) return [];
  const companies = new Set(principal.companies);
  return getDeals().filter(
    (d) => companies.has(d.source_slug) || companies.has(d.target_slug),
  );
}

export function verdictLabel(v: Verdict): string {
  return {
    buildout: 'Buildout',
    circular: 'Circular',
    mixed: 'Mixed',
    pending: 'Pending verdict',
  }[v];
}
