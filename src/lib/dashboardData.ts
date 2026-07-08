import { prisma } from "./db";
import { daysAgo, heatContribution, HORIZON_DAYS } from "./heat";
import { CPA_TIER_LABELS, type CompanyView, type DashboardData, type SignalType } from "./types";

// When a firm's URLs aren't on file yet, fall back to search links that work
// for any firm name — no data entry required to make the buttons useful.
function googleSearchUrl(c: { name: string; city: string | null; state: string | null }) {
  const q = [c.name, c.city, c.state, "CPA"].filter(Boolean).join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}
function linkedinSearchUrl(c: { name: string }) {
  return `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(c.name)}`;
}

export async function getDashboardData(): Promise<DashboardData> {
  const since = new Date(Date.now() - HORIZON_DAYS * 86_400_000);
  const now = new Date();

  const [companies, brief, lastRun] = await Promise.all([
    prisma.company.findMany({
      include: {
        signals: { where: { occurredAt: { gte: since } }, orderBy: { occurredAt: "desc" } },
      },
    }),
    prisma.brief.findFirst({ orderBy: { briefDate: "desc" } }),
    prisma.connectorRun.findFirst({ where: { ok: true }, orderBy: { startedAt: "desc" } }),
  ]);

  const views: CompanyView[] = companies
    .map((c) => {
      const signals = c.signals.map((s) => {
        const d = daysAgo(s.occurredAt, now);
        return {
          type: s.signalType as SignalType,
          headline: s.headline,
          pitch: s.pitchAngle,
          daysAgo: d,
          sourceUrl: s.sourceUrl,
          // Recomputed at read time so heat keeps decaying between refreshes.
          heat: heatContribution(s.signalType as SignalType, d),
        };
      });
      return {
        id: c.id,
        name: c.name,
        city: c.city ?? "—",
        state: c.state ?? "—",
        size: c.sizeTier ?? "—",
        employees: c.employeeCount ?? 0,
        signals,
        // Full-horizon heat; the client re-sums per selected window (7d/6w).
        heat: signals.reduce((acc, s) => acc + s.heat, 0),
        cpaTier: c.cpaAffiliationTier
          ? (CPA_TIER_LABELS[c.cpaAffiliationTier] ?? c.cpaAffiliationTier)
          : null,
        website: c.website ?? googleSearchUrl(c),
        linkedin: c.linkedinUrl ?? linkedinSearchUrl(c),
      };
    })
    .sort((a, b) => b.heat - a.heat);

  return {
    companies: views,
    totalTracked: companies.length,
    brief: brief
      ? { text: brief.summaryText, generatedAt: brief.briefDate.toISOString() }
      : null,
    lastRefreshAt: lastRun?.startedAt.toISOString() ?? null,
  };
}
