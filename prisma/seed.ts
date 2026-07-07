// Seed the database with the sample firm list. With --demo, also generate a
// batch of demo raw signals + a synthesis pass so the dashboard has content
// before any real connectors/API keys are configured.
import { execFileSync } from "node:child_process";
import { prisma } from "../src/lib/db";
import { heatContribution } from "../src/lib/heat";
import type { SignalType } from "../src/lib/types";

const DEMO_SIGNALS: {
  firm: string;
  type: SignalType;
  daysAgo: number;
  headline: string;
  pitch: string;
}[] = [
  {
    firm: "Whitfield & Marsh LLP",
    type: "intent",
    daysAgo: 1,
    headline: "Job posting cites replacing legacy document management tool",
    pitch: "Direct intent signal — they're actively shopping for a replacement right now.",
  },
  {
    firm: "Sterling Advisory Group",
    type: "ma",
    daysAgo: 2,
    headline: "Merged with a private-equity-backed platform",
    pitch: "Post-merger integration underway — systems consolidation creates urgency for a unified platform.",
  },
  {
    firm: "Granger & Associates",
    type: "compliance",
    daysAgo: 3,
    headline: "Peer review finding requires corrective action plan",
    pitch: "A compliance deadline is real pressure even for a nice-to-have tool — pitch the fastest path to a clean corrective-action file.",
  },
  {
    firm: "Ashcroft Partners",
    type: "hire",
    daysAgo: 4,
    headline: "Hired a new Director of Technology",
    pitch: "New technology lead likely re-evaluating vendors in first 90 days — window to pitch tooling change.",
  },
  {
    firm: "Dunmore & Ellsworth",
    type: "succession",
    daysAgo: 6,
    headline: "Founding partner announced retirement succession plan",
    pitch: "Incoming leadership is a prime window to reset vendor relationships before they inherit legacy contracts.",
  },
  {
    firm: "Prewitt & Holbrook LLP",
    type: "turnover",
    daysAgo: 8,
    headline: "Several senior associates departed this quarter",
    pitch: "High turnover means tribal knowledge is walking out the door — pitch self-documenting data organization as a continuity fix.",
  },
  {
    firm: "Ingram Advisory",
    type: "techstack",
    daysAgo: 10,
    headline: "Posted digital transformation initiative for back-office systems",
    pitch: "They've already budgeted for change — get in before they lock in a competitor's proposal.",
  },
  {
    firm: "Norcross Partners",
    type: "expansion",
    daysAgo: 14,
    headline: "Opened a new office in a neighboring state",
    pitch: "Multi-office growth strains manual processes — pitch centralized/cloud workflow angle.",
  },
];

async function main() {
  const demo = process.argv.includes("--demo");

  execFileSync("npx", ["tsx", "scripts/import-firms.ts", "data/firms.sample.csv"], {
    stdio: "inherit",
  });

  if (!demo) return;

  for (const d of DEMO_SIGNALS) {
    const company = await prisma.company.findFirst({ where: { name: d.firm } });
    if (!company) continue;
    const occurredAt = new Date(Date.now() - d.daysAgo * 86_400_000);
    const externalId = `demo-${company.id}-${d.type}`;
    await prisma.rawSignal.upsert({
      where: { source_externalId: { source: "demo", externalId } },
      create: {
        companyId: company.id,
        source: "demo",
        signalType: d.type,
        externalId,
        rawPayload: JSON.stringify({ title: d.headline }),
        detectedAt: occurredAt,
        processedAt: new Date(),
      },
      update: {},
    });
    const existing = await prisma.signal.findFirst({
      where: { companyId: company.id, signalType: d.type, headline: d.headline },
    });
    if (!existing) {
      await prisma.signal.create({
        data: {
          companyId: company.id,
          signalType: d.type,
          headline: d.headline,
          pitchAngle: d.pitch,
          confidence: 0.9,
          occurredAt,
          heatContribution: heatContribution(d.type, d.daysAgo),
        },
      });
    }
  }

  const existingBrief = await prisma.brief.findFirst();
  if (!existingBrief) {
    const warm = await prisma.company.count({ where: { cpaAffiliationTier: { not: null } } });
    await prisma.brief.create({
      data: {
        summaryText:
          `Demo data loaded. Whitfield & Marsh LLP is the top priority — a job posting names a legacy document tool they want replaced, which is active buying intent. ` +
          `Sterling Advisory Group is mid-merger, a strong window for a systems-consolidation pitch, and Granger & Associates has a peer-review corrective deadline creating real time pressure. ` +
          `${warm} tracked firms are already CPA.com-affiliated — treat those as warm, low-friction intros regardless of other activity.`,
        topCompanyIds: JSON.stringify([]),
      },
    });
  }

  console.log("Demo signals + brief seeded.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
