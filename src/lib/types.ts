export const SIGNAL_TYPES = [
  "hire",
  "ma",
  "news",
  "filing",
  "succession",
  "intent",
  "expansion",
  "sentiment",
  "winloss",
  "usage",
  "compliance",
  "turnover",
  "techstack",
] as const;

export type SignalType = (typeof SIGNAL_TYPES)[number];

export const CPA_TIER_LABELS: Record<string, string> = {
  "investor-portfolio": "Investor-portfolio firm",
  "preferred-vendor": "Preferred-vendor user",
  "program-participant": "CPA.com program participant",
};

// Shapes serialized from the server to the dashboard client component.
export interface SignalView {
  type: SignalType;
  headline: string;
  pitch: string;
  daysAgo: number;
  sourceUrl: string | null;
  /** This signal's recency-decayed heat, computed at read time. */
  heat: number;
}

export interface CompanyView {
  id: number;
  name: string;
  city: string;
  state: string;
  size: string;
  employees: number;
  signals: SignalView[];
  heat: number;
  cpaTier: string | null;
  /** Direct URL when on file, otherwise a search link that works for any firm name. */
  website: string;
  linkedin: string;
}

export interface DashboardData {
  companies: CompanyView[];
  totalTracked: number;
  brief: { text: string; generatedAt: string } | null;
  lastRefreshAt: string | null;
}
