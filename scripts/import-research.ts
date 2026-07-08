// Import manually researched / rep-reported signals from a JSON file:
//   npx tsx scripts/import-research.ts data/research-signals-2026-07.json
//
// Each entry: { firm, type, date (YYYY-MM-DD), headline, pitch, url }
// Writes both a raw_signal (source "research", for provenance) and the
// synthesized signal, keyed by url+firm so re-runs are idempotent.
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/db";
import { heatContribution, daysAgo } from "../src/lib/heat";
import { SIGNAL_TYPES, type SignalType } from "../src/lib/types";

interface ResearchItem {
  firm: string;
  type: SignalType;
  date: string;
  headline: string;
  pitch: string;
  url: string;
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: npx tsx scripts/import-research.ts <path-to-json>");
    process.exit(1);
  }
  const items = JSON.parse(readFileSync(path, "utf8")) as ResearchItem[];
  let imported = 0;

  for (const item of items) {
    if (!SIGNAL_TYPES.includes(item.type)) {
      console.warn(`[skip] "${item.firm}": unknown signal type "${item.type}"`);
      continue;
    }
    const company = await prisma.company.findFirst({ where: { name: item.firm } });
    if (!company) {
      console.warn(`[skip] firm not found in DB: "${item.firm}"`);
      continue;
    }
    const occurredAt = new Date(`${item.date}T12:00:00Z`);
    const externalId = `${item.url}#${company.id}#${item.type}`;

    const existing = await prisma.rawSignal.findUnique({
      where: { source_externalId: { source: "research", externalId } },
    });
    if (existing) continue;

    await prisma.rawSignal.create({
      data: {
        companyId: company.id,
        source: "research",
        signalType: item.type,
        externalId,
        rawPayload: JSON.stringify({ title: item.headline, link: item.url, date: item.date }),
        detectedAt: occurredAt,
        processedAt: new Date(),
      },
    });
    await prisma.signal.create({
      data: {
        companyId: company.id,
        signalType: item.type,
        headline: item.headline,
        pitchAngle: item.pitch,
        confidence: 0.95,
        occurredAt,
        heatContribution: heatContribution(item.type, daysAgo(occurredAt)),
        sourceUrl: item.url,
      },
    });
    imported++;
  }
  console.log(`Imported ${imported} researched signals from ${path}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
