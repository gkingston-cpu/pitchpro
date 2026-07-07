// Import the firm universe + CPA.com affiliation tiers from a CSV export:
//   npm run import:firms -- data/firms.sample.csv
//
// Expected columns (header row required; extras ignored):
//   name, city, state, size_tier, employee_count, cpa_com_id, cpa_affiliation_tier,
//   website, linkedin_url
// cpa_affiliation_tier: investor-portfolio | preferred-vendor | program-participant | (blank)
// website / linkedin_url are optional — the app falls back to search links when blank.
//
// Rows are upserted by cpa_com_id when present, otherwise by exact name — safe
// to re-run whenever the internal list changes.
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/db";
import { parseCsv } from "../src/lib/csv";

const VALID_TIERS = new Set(["investor-portfolio", "preferred-vendor", "program-participant"]);

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: npm run import:firms -- <path-to-csv>");
    process.exit(1);
  }

  const rows = parseCsv(readFileSync(path, "utf8"));
  let imported = 0;
  const warnings: string[] = [];

  for (const row of rows) {
    if (!row.name) {
      warnings.push(`skipped row with no name: ${JSON.stringify(row)}`);
      continue;
    }
    const tier = row.cpa_affiliation_tier || null;
    if (tier && !VALID_TIERS.has(tier)) {
      warnings.push(`"${row.name}": unknown affiliation tier "${tier}" — kept as-is`);
    }
    const data = {
      name: row.name,
      city: row.city || null,
      state: row.state || null,
      sizeTier: row.size_tier || null,
      employeeCount: row.employee_count ? parseInt(row.employee_count, 10) || null : null,
      cpaComId: row.cpa_com_id || null,
      cpaAffiliationTier: tier,
      website: row.website || null,
      linkedinUrl: row.linkedin_url || null,
    };

    if (data.cpaComId) {
      await prisma.company.upsert({
        where: { cpaComId: data.cpaComId },
        create: data,
        update: data,
      });
    } else {
      const existing = await prisma.company.findFirst({ where: { name: data.name } });
      if (existing) await prisma.company.update({ where: { id: existing.id }, data });
      else await prisma.company.create({ data });
    }
    imported++;
  }

  console.log(`Imported/updated ${imported} firms from ${path}`);
  for (const w of warnings) console.warn(`[warn] ${w}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
