import type { Connector, NormalizedRawSignal } from "./types";
import { matchCompany } from "./match";
import type { SignalType } from "../types";

// Adzuna job-search API. Two passes:
//  1. postings naming competitor products → "intent" (highest-priority tier, spec §3)
//  2. postings mentioning digital transformation → "techstack"
// Fill in the real competitor product names your team sells against.
const INTENT_TERMS: { term: string; type: SignalType }[] = [
  { term: '"document management" migration accounting', type: "intent" },
  { term: '"practice management" replacement CPA', type: "intent" },
  { term: '"digital transformation" CPA firm', type: "techstack" },
];

interface AdzunaJob {
  id: string;
  title?: string;
  description?: string;
  redirect_url?: string;
  created?: string;
  company?: { display_name?: string };
}

export const jobsConnector: Connector = {
  source: "adzuna",

  isConfigured() {
    if (!process.env.ADZUNA_APP_ID || !process.env.ADZUNA_APP_KEY)
      return { reason: "ADZUNA_APP_ID / ADZUNA_APP_KEY not set" };
    return true;
  },

  async fetchSignals({ companies }) {
    const out: NormalizedRawSignal[] = [];

    for (const { term, type } of INTENT_TERMS) {
      const url = new URL("https://api.adzuna.com/v1/api/jobs/us/search/1");
      url.searchParams.set("app_id", process.env.ADZUNA_APP_ID!);
      url.searchParams.set("app_key", process.env.ADZUNA_APP_KEY!);
      url.searchParams.set("what", term);
      url.searchParams.set("results_per_page", "50");
      url.searchParams.set("max_days_old", "7");

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Adzuna ${res.status}: ${await res.text()}`);
      const body = (await res.json()) as { results?: AdzunaJob[] };

      for (const job of body.results ?? []) {
        const companyName = job.company?.display_name ?? "";
        const company =
          matchCompany(companyName, companies) ??
          matchCompany(`${job.title ?? ""} ${job.description ?? ""}`, companies);
        if (!company) continue;
        out.push({
          companyId: company.id,
          signalType: type,
          externalId: `adzuna-${job.id}`,
          rawPayload: {
            title: job.title,
            description: job.description?.slice(0, 1000),
            url: job.redirect_url,
            postedBy: companyName,
            searchTerm: term,
          },
          detectedAt: job.created ? new Date(job.created) : new Date(),
        });
      }
    }
    return out;
  },
};
