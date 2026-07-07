import { prisma } from "./db";
import { daysAgo } from "./heat";
import { CPA_TIER_LABELS, type CompanyView, type DashboardData, type SignalType } from "./types";

const WINDOW_DAYS = 30;

export async function getDashboardData(): Promise<DashboardData> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
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
    .map((c) => ({
      id: c.id,
      name: c.name,
      city: c.city ?? "—",
      state: c.state ?? "—",
      size: c.sizeTier ?? "—",
      employees: c.employeeCount ?? 0,
      signals: c.signals.map((s) => ({
        type: s.signalType as SignalType,
        headline: s.headline,
        pitch: s.pitchAngle,
        daysAgo: daysAgo(s.occurredAt, now),
      })),
      heat: c.signals.reduce((acc, s) => acc + s.heatContribution, 0),
      cpaTier: c.cpaAffiliationTier
        ? (CPA_TIER_LABELS[c.cpaAffiliationTier] ?? c.cpaAffiliationTier)
        : null,
    }))
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
