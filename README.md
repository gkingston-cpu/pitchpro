# PitchPro — CPA.com Affiliate Signal Dashboard

A shared sales-intelligence dashboard ("The Ledger") for two salespeople covering the top
~1,000 CPA.com affiliate firms. A twice-weekly job (Monday & Wednesday mornings) pulls fresh
buying signals per firm, a Claude-powered synthesis step turns them into a headline, a
suggested pitch angle, and a heat score, and CPA.com-affiliated firms are flagged as warm,
low-friction accounts regardless of other activity.

```
[Source connectors] --> [raw_signals] --> [Synthesis agent (Claude)] --> [signals + brief] --> [Dashboard]
     Mon/Wed cron                                                                                2 users
```

## Quick start (local)

```bash
cp .env.example .env        # fill in what you have; everything degrades gracefully
npm install
npx prisma migrate dev      # creates the SQLite dev DB
npm run db:seed:demo        # sample firms + demo signals so the UI has content
npm run dev                 # http://localhost:3000
```

Without Google OAuth env vars the app runs in **open preview mode** (a red banner reminds
you). Without `ANTHROPIC_API_KEY` the synthesis step uses a rule-based fallback instead of
the LLM. Without connector keys, unconfigured connectors skip themselves and say so in the
refresh result.

## Loading the real firm list (do this first)

The CPA.com affiliation tier is internal data and the highest-value, lowest-effort signal.
Export your list to CSV with these columns and import it:

```csv
name,city,state,size_tier,employee_count,cpa_com_id,cpa_affiliation_tier,website,linkedin_url
Whitfield & Marsh LLP,Dallas,TX,Regional,120,CPA-1001,investor-portfolio,https://whitfieldmarsh.com,https://linkedin.com/company/whitfield-marsh
```

`cpa_affiliation_tier` ∈ `investor-portfolio` | `preferred-vendor` | `program-participant` | blank.
`website` / `linkedin_url` are optional — when blank, the firm drawer's Website/LinkedIn
buttons fall back to a Google / LinkedIn company search for the firm name, so they work
for all firms with zero data entry.

```bash
npm run import:firms -- path/to/your-firms.csv
```

Re-run any time the list changes — rows are upserted by `cpa_com_id` (or name).

## The refresh pipeline

`npm run refresh` (or `GET /api/refresh` with `Authorization: Bearer $CRON_SECRET`) runs:

1. **Connectors** — each normalizes into `raw_signals`, upserts idempotently (keyed by
   source + external id), and logs per-source success/failure to `connector_runs` so one
   broken source never blocks the rest.
   | Connector | Source | Signals | Needs |
   |---|---|---|---|
   | `trade-press` | Accounting Today, CPA Practice Advisor, Going Concern RSS | M&A, succession, compliance, expansion, news | nothing |
   | `newsapi` | NewsAPI.org (batched OR-queries over firm names) | transition news, M&A, growth | `NEWSAPI_KEY` |
   | `adzuna` | Adzuna job search | competitor-tool intent, tech-modernization RFP | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` |
2. **Synthesis agent** — one Claude call per firm with new raw signals (prompt per the build
   spec: headline <12 words, 1-sentence pitch angle, confidence ≥ 0.6, no invented facts),
   writing to `signals` with a recency- and type-weighted `heat_contribution`.
3. **Agent brief** — a second Claude call rolls the cycle's top firms into the paragraph at
   the top of the dashboard (`daily_briefs`).

Failed firms keep their raw signals unprocessed and are retried next cycle.

## Scheduling

`vercel.json` defines a Vercel Cron hitting `/api/refresh` at **09:00 UTC Mon & Wed**
(5:00 AM ET during daylight time — done before the 6:00 AM login). Set `CRON_SECRET` in the
Vercel project env; Vercel Cron sends it automatically. On any other host, use system cron:

```cron
0 9 * * 1,3 curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://your-host/api/refresh
```

## Auth

NextAuth with Google sign-in, restricted to `ALLOWED_EMAILS` (comma-separated — just the two
salespeople). Create an OAuth client in Google Cloud Console with redirect URI
`https://your-host/api/auth/callback/google`, then set `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET` (`openssl rand -base64 32`), `NEXTAUTH_URL`, and
`ALLOWED_EMAILS`.

## Switching to Postgres (production)

SQLite is fine locally but ephemeral on serverless hosts. For Supabase/Neon:

1. In `prisma/schema.prisma`, change `provider = "sqlite"` → `provider = "postgresql"`.
2. Set `DATABASE_URL` to your Postgres connection string.
3. Delete `prisma/migrations/` (they're SQLite-flavored) and run `npx prisma migrate dev`
   once against the new DB, then `npx prisma migrate deploy` in CI/deploy.

## Signal model

Heat = Σ over the firm's last-30-day signals of `(30 − days_ago) × type_weight`, where
intent (1.5), tech-RFP (1.4), M&A (1.3), and compliance (1.2) are weighted highest — this
product sells on **timing and pressure**, not mandate (see `src/lib/heat.ts`).

## Known gaps / open items (flagged, not scraped around)

- **LinkedIn hires/turnover, Glassdoor sentiment, PitchBook M&A** need licensed data
  providers — connectors for them slot into `src/lib/connectors/` behind the same
  `Connector` interface once you pick vendors. Direct scraping of those platforms violates
  their ToS, so it is deliberately not implemented.
- **Indeed Publisher API** is closed to new signups; Adzuna is the stand-in job-board source.
  Put your real competitor product names into `INTENT_TERMS` in `src/lib/connectors/jobs.ts`.
- **CPA.com usage data** (`usage` signals) needs an internal export — out of scope until
  that exists.
- **Client win/loss** stays manual/rep-reported for now, per the spec.
- Firm-name matching for news is exact/stem-based; very generic firm names may need a
  per-firm alias column later.
