import Parser from "rss-parser";
import type { Connector, NormalizedRawSignal } from "./types";
import { classifyText, matchCompany } from "./match";

// Accounting-industry trade press — no API key required, and often faster than
// general M&A databases for CPA-firm-specific news (build spec §3).
const FEEDS = [
  "https://www.accountingtoday.com/feed",
  "https://www.cpapracticeadvisor.com/rss.xml",
  "https://www.goingconcern.com/feed/",
];

export const tradePressConnector: Connector = {
  source: "trade-press",

  isConfigured() {
    return true;
  },

  async fetchSignals({ companies }) {
    const parser = new Parser({ timeout: 15_000 });
    const out: NormalizedRawSignal[] = [];
    const errors: string[] = [];

    for (const feedUrl of FEEDS) {
      try {
        const feed = await parser.parseURL(feedUrl);
        for (const item of feed.items ?? []) {
          const text = `${item.title ?? ""} ${item.contentSnippet ?? ""}`;
          const company = matchCompany(text, companies);
          if (!company || !item.link) continue;
          out.push({
            companyId: company.id,
            signalType: classifyText(text),
            externalId: item.link,
            rawPayload: {
              feed: feedUrl,
              title: item.title,
              snippet: item.contentSnippet,
              link: item.link,
              pubDate: item.pubDate,
            },
            detectedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
          });
        }
      } catch (err) {
        errors.push(`${feedUrl}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Partial results are fine; only fail the run if every feed broke.
    if (out.length === 0 && errors.length === FEEDS.length) {
      throw new Error(`all feeds failed — ${errors.join("; ")}`);
    }
    return out;
  },
};
