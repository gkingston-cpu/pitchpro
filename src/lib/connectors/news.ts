import type { Connector, NormalizedRawSignal } from "./types";
import { classifyText, matchCompany } from "./match";

// NewsAPI.org "everything" search. Firm names are batched into OR queries to
// stay well inside the free tier's request budget for ~1,000 firms.
const MAX_QUERY_CHARS = 480; // NewsAPI hard limit is 500
const KEYWORDS =
  '(merger OR acquisition OR relocat* OR office OR rebrand OR "named partner" OR announces OR retirement)';

function buildQueries(companies: { id: number; name: string }[]): string[] {
  const queries: string[] = [];
  let current: string[] = [];
  let len = 0;
  for (const c of companies) {
    const term = `"${c.name}"`;
    if (len + term.length + 4 > MAX_QUERY_CHARS - KEYWORDS.length - 8 && current.length) {
      queries.push(`(${current.join(" OR ")}) AND ${KEYWORDS}`);
      current = [];
      len = 0;
    }
    current.push(term);
    len += term.length + 4;
  }
  if (current.length) queries.push(`(${current.join(" OR ")}) AND ${KEYWORDS}`);
  return queries;
}

export const newsConnector: Connector = {
  source: "newsapi",

  isConfigured() {
    if (!process.env.NEWSAPI_KEY) return { reason: "NEWSAPI_KEY not set" };
    return true;
  },

  async fetchSignals({ companies }) {
    const key = process.env.NEWSAPI_KEY!;
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    const out: NormalizedRawSignal[] = [];

    for (const q of buildQueries(companies)) {
      const url = new URL("https://newsapi.org/v2/everything");
      url.searchParams.set("q", q);
      url.searchParams.set("from", since);
      url.searchParams.set("language", "en");
      url.searchParams.set("sortBy", "publishedAt");
      url.searchParams.set("pageSize", "100");

      const res = await fetch(url, { headers: { "X-Api-Key": key } });
      if (res.status === 429) break; // rate-limited: keep what we have, next cycle catches up
      if (!res.ok) throw new Error(`NewsAPI ${res.status}: ${await res.text()}`);
      const body = (await res.json()) as {
        articles?: { title?: string; description?: string; url?: string; publishedAt?: string }[];
      };

      for (const a of body.articles ?? []) {
        const text = `${a.title ?? ""} ${a.description ?? ""}`;
        const company = matchCompany(text, companies);
        if (!company || !a.url) continue;
        out.push({
          companyId: company.id,
          signalType: classifyText(text),
          externalId: a.url,
          rawPayload: a,
          detectedAt: a.publishedAt ? new Date(a.publishedAt) : new Date(),
        });
      }
    }
    return out;
  },
};
