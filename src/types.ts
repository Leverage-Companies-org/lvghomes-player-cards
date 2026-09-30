export interface Stats {
  appts?: number;
  contracts?: number;
  icp5?: number;
  arip?: number;
  dealReview?: number;
  dealReviewLM?: number;
  dealReviewLLM?: number;
  closedPct?: number;
  closedRevAttr?: number;
  closedRevQtr?: number;
  pipeline?: number;
}

export type WeightMap = Record<string, { weight: number; target: number }>;

export interface Player {
  id: string;
  name: string;
  role: 'Vice President' | 'Acquisition Manager';
  stats: Stats;
  weights?: WeightMap;
  headshot?: string;
  /** Optional manager notes from the sheet (Apps Script `notes` field). */
  notes?: string[];
}

export interface PlayerWithOverall extends Player {
  overall: number;
  tier: Tier;
  breakdown: Record<string, BreakdownEntry>;
}

export interface BreakdownEntry {
  ratio: number;
  weight: number;
  target: number;
  value: number;
}

export type Tier = 'diamond' | 'gold' | 'silver' | 'bronze';

export type RoleKey = 'vp' | 'am';

export interface RosterData {
  updatedAt: string;
  quarter: string;
  vps: Player[];
  ams: Player[];
}

export interface StatMeta {
  label: string;
  kind: 'int' | 'pct' | 'money';
  icon: string;
}
