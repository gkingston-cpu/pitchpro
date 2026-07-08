// Import SQMS / quality-management headlines for the market-watch rail:
//   npx tsx scripts/import-market-news.ts data/market-news.json
// Each entry: { title, source, url, published ("YYYY-MM" or null) }
// Upserted by url — safe to re-run whenever the list is refreshed.
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/db";

interface NewsItem {
  title: string;
  source: string;
  url: string;
  published: string | null;
}

async function main() {
  const path = process.argv[2] ?? "data/market-news.json";
  const items = JSON.parse(readFileSync(path, "utf8")) as NewsItem[];
  for (const item of items) {
    const publishedAt = item.published ? new Date(`${item.published}-01T12:00:00Z`) : null;
    await prisma.marketNews.upsert({
      where: { url: item.url },
      create: { title: item.title, source: item.source, url: item.url, publishedAt },
      update: { title: item.title, source: item.source, publishedAt },
    });
  }
  console.log(`Imported ${items.length} market news items from ${path}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
