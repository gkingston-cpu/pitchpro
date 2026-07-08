"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  TrendingUp,
  Users,
  Newspaper,
  FileText,
  X,
  RefreshCw,
  Globe,
  Linkedin,
} from "lucide-react";
import type { CompanyView, DashboardData, SignalType } from "@/lib/types";
import { SIGNAL_TYPES } from "@/lib/types";

// FinReg-branded dashboard UI. Styling lives in app/globals.css; signal-type
// tints are the only per-type inline styles.

const SIGNAL_META: Record<
  SignalType,
  { label: string; icon: React.ElementType; lt: string; lb: string; dt: string; db: string; filter: string }
> = {
  hire: { label: "HIRE", icon: Users, lt: "#7a5f13", lb: "#f6ecce", dt: "#e3c56a", db: "#332a10", filter: "Buyer-role hires" },
  ma: { label: "M&A", icon: TrendingUp, lt: "#9c3a2b", lb: "#f9e3de", dt: "#ef9282", db: "#3a1d18", filter: "M&A activity" },
  news: { label: "NEWS", icon: Newspaper, lt: "#2f5a8c", lb: "#e0eaf6", dt: "#8ab4e8", db: "#182636", filter: "Transition news" },
  filing: { label: "FILING", icon: FileText, lt: "#2f6b4f", lb: "#ddf0e6", dt: "#7ecfa8", db: "#152b21", filter: "Growth / filings" },
  succession: { label: "SUCCESSION", icon: Users, lt: "#6b3f8c", lb: "#eee2f7", dt: "#c79df0", db: "#2a1c36", filter: "Partner succession" },
  intent: { label: "INTENT", icon: Search, lt: "#a13d2e", lb: "#f9e2dc", dt: "#f2957f", db: "#3a1e17", filter: "Competitor-tool intent" },
  expansion: { label: "EXPANSION", icon: TrendingUp, lt: "#22705f", lb: "#dbf0eb", dt: "#7bd0bc", db: "#142b26", filter: "New office expansion" },
  sentiment: { label: "SENTIMENT", icon: Newspaper, lt: "#7a5a2f", lb: "#f3e8d5", dt: "#dcb87a", db: "#312512", filter: "Employee sentiment shift" },
  winloss: { label: "WIN/LOSS", icon: FileText, lt: "#5c3d8c", lb: "#e9e0f5", dt: "#b99cef", db: "#251c36", filter: "Client win/loss" },
  usage: { label: "USAGE", icon: TrendingUp, lt: "#2f5a8c", lb: "#e0eaf6", dt: "#8ab4e8", db: "#182636", filter: "CPA.com usage change" },
  compliance: { label: "COMPLIANCE", icon: FileText, lt: "#8c2f6b", lb: "#f6e0ee", dt: "#e793c8", db: "#33172a", filter: "Compliance deadline" },
  turnover: { label: "TURNOVER", icon: Users, lt: "#8c5a2f", lb: "#f4e6d8", dt: "#dfae76", db: "#322214", filter: "Staff turnover spike" },
  techstack: { label: "TECH RFP", icon: Search, lt: "#1f7a5c", lb: "#daf0e7", dt: "#75d1ac", db: "#132b22", filter: "Tech modernization RFP" },
};

// How many days one refresh cycle covers (Mon → Wed → Mon).
const CYCLE_DAYS = 4;

function Stamp({ type }: { type: SignalType }) {
  const m = SIGNAL_META[type];
  const Icon = m.icon;
  return (
    <span
      className="stamp"
      style={
        {
          color: `light-dark(${m.lt}, ${m.dt})`,
          background: `light-dark(${m.lb}, ${m.db})`,
        } as React.CSSProperties
      }
    >
      <Icon size={11} strokeWidth={2.5} />
      {m.label}
    </span>
  );
}

function HeatBar({ heat, max }: { heat: number; max: number }) {
  const pct = Math.min(100, Math.round((heat / max) * 100));
  return (
    <div className={`heatbar${pct <= 20 ? " cool" : ""}`}>
      <i style={{ width: `${Math.max(pct, 4)}%` }} />
    </div>
  );
}

function age(d: number) {
  return d === 0 ? "Today" : `${d}d ago`;
}

export default function Dashboard({
  data,
  previewMode,
}: {
  data: DashboardData;
  previewMode: boolean;
}) {
  const { companies, totalTracked, brief } = data;
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("ALL");
  const [signalFilter, setSignalFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState("heat");
  const [selected, setSelected] = useState<CompanyView | null>(null);

  const maxHeat = Math.max(...companies.map((c) => c.heat), 1);
  const states = useMemo(
    () => Array.from(new Set(companies.map((c) => c.state).filter((s) => s !== "—"))).sort(),
    [companies],
  );

  const filtered = useMemo(() => {
    const rows = companies.filter((c) => {
      if (query && !c.name.toLowerCase().includes(query.toLowerCase())) return false;
      if (stateFilter !== "ALL" && c.state !== stateFilter) return false;
      if (signalFilter !== "ALL" && !c.signals.some((s) => s.type === signalFilter)) return false;
      return true;
    });
    return [...rows].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "employees") return b.employees - a.employees;
      return b.heat - a.heat;
    });
  }, [companies, query, stateFilter, signalFilter, sortKey]);

  // Priority outreach favors actionable events; commentary-grade types
  // (general news, sentiment) never outrank a live M&A or hire.
  const ACTIONABLE = new Set<SignalType>([
    "ma", "hire", "intent", "succession", "compliance", "techstack",
    "turnover", "expansion", "filing", "usage", "winloss",
  ]);
  const topFirms = companies
    .map((c) => ({ company: c, signal: c.signals.find((s) => ACTIONABLE.has(s.type)) }))
    .filter((x): x is { company: CompanyView; signal: (typeof x)["signal"] & {} } => Boolean(x.signal))
    .slice(0, 6);
  const warmAll = companies.filter((c) => c.cpaTier);
  const counts = SIGNAL_TYPES.reduce<Record<string, number>>((acc, t) => {
    acc[t] = companies.filter((c) => c.signals.some((s) => s.type === t)).length;
    return acc;
  }, {});
  const activeThisCycle = companies.filter((c) =>
    c.signals.some((s) => s.daysAgo <= CYCLE_DAYS),
  ).length;

  const lastRefresh = data.lastRefreshAt
    ? new Date(data.lastRefreshAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  const briefFallback =
    companies.length === 0
      ? "No firms loaded yet. Import your firm list and run a refresh to populate this brief."
      : "No brief generated yet — it appears after the first refresh run.";

  return (
    <div>
      <div className="appbar">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/finreg-logo-white.png" alt="FinReg Global" />
          <div className="divider" />
          <div className="app">
            <b>The Ledger</b>
            <span>CPA.com Affiliate Signals &middot; Mon/Wed Brief</span>
          </div>
        </div>
        <div className="bar-right">
          <RefreshCw size={13} />
          <span>
            Refreshes Mon &amp; Wed, 6:00 AM ET
            {lastRefresh ? ` · last ${lastRefresh}` : ""}
          </span>
          {previewMode && <span className="previewchip">PREVIEW — NO LOGIN</span>}
        </div>
      </div>

      <div className="wrap">
        <div className="stats">
          {(
            [
              ["Firms tracked", totalTracked.toLocaleString(), false],
              ["New signals this cycle", activeThisCycle, false],
              ["CPA.com-affiliated (warm)", warmAll.length, true],
              ["Buyer-role hires", counts.hire, false],
              ["M&A activity", counts.ma, false],
              ["Compliance pressure", counts.compliance, false],
            ] as [string, string | number, boolean][]
          ).map(([label, v, gold]) => (
            <div key={label} className={`stat${gold ? " gold" : ""}`}>
              <b>{v}</b>
              <span>{label}</span>
            </div>
          ))}
        </div>

        <div className="brief">
          <div className="brief-head">
            <span className="aichip">AI BRIEF</span>
            <span className="brief-when">
              {brief
                ? `Generated ${new Date(brief.generatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                : ""}
            </span>
          </div>
          <p>{brief?.text ?? briefFallback}</p>
        </div>

        {warmAll.length > 0 && (
          <section>
            <h2 className="section">Warm accounts — already in the CPA.com ecosystem</h2>
            <div className="warm-grid">
              {warmAll.slice(0, 8).map((c) => (
                <button key={c.id} className="warm-card" onClick={() => setSelected(c)}>
                  <div className="nm">{c.name}</div>
                  <div className="tier">{c.cpaTier}</div>
                  <div className="loc">
                    {c.city}, {c.state}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {topFirms.length > 0 && (
          <section>
            <h2 className="section">Today&apos;s priority outreach</h2>
            <div className="feed-grid">
              {topFirms.map(({ company: c, signal }) => (
                <button key={c.id} className="feed-card" onClick={() => setSelected(c)}>
                  <div className="feed-top">
                    <div className="nm">{c.name}</div>
                    <Stamp type={signal.type} />
                  </div>
                  <div className="feed-meta">
                    {c.city}, {c.state} &middot; {c.size} &middot; {c.employees.toLocaleString()}{" "}
                    employees
                  </div>
                  <div className="feed-headline">{signal.headline}</div>
                  <div className="feed-age">{age(signal.daysAgo)}</div>
                </button>
              ))}
            </div>
          </section>
        )}

        <div>
          <h2 className="section">All tracked firms</h2>
          <div className="filters">
            <div className="searchbox">
              <Search size={14} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search firm name…"
                aria-label="Search firm name"
              />
            </div>
            <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} aria-label="Filter by state">
              <option value="ALL">All states</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select value={signalFilter} onChange={(e) => setSignalFilter(e.target.value)} aria-label="Filter by signal type">
              <option value="ALL">All signal types</option>
              {SIGNAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {SIGNAL_META[t].filter}
                </option>
              ))}
            </select>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} aria-label="Sort">
              <option value="heat">Sort: signal heat</option>
              <option value="name">Sort: name</option>
              <option value="employees">Sort: firm size</option>
            </select>
          </div>

          <div className="tablewrap">
            <div className="tablescroll">
              <table>
                <thead>
                  <tr>
                    <th>Firm</th>
                    <th>Location</th>
                    <th>Size</th>
                    <th>Employees</th>
                    <th>Latest signal</th>
                    <th>Heat</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr
                      key={c.id}
                      tabIndex={0}
                      aria-label={`Open ${c.name} details`}
                      onClick={() => setSelected(c)}
                      onKeyDown={(e) => e.key === "Enter" && setSelected(c)}
                    >
                      <td className="nm">
                        {c.name}
                        {c.cpaTier && <span className="warmtag">WARM</span>}
                      </td>
                      <td className="dim">
                        {c.city}, {c.state}
                      </td>
                      <td className="dim">{c.size}</td>
                      <td className="num">{c.employees.toLocaleString()}</td>
                      <td>
                        {c.signals.length > 0 ? (
                          <span className="sig-cell">
                            <Stamp type={c.signals[0].type} />
                            <span className="hl">{c.signals[0].headline}</span>
                          </span>
                        ) : (
                          <span className="quiet">No recent activity</span>
                        )}
                      </td>
                      <td>
                        <HeatBar heat={c.heat} max={maxHeat} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="empty">
                  {companies.length === 0
                    ? "No firms loaded yet — import your firm list to get started."
                    : "No firms match those filters."}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="foot">
          The Ledger refreshes automatically every Monday and Wednesday morning from CPA.com
          affiliate records, trade press, news, and job-board sources.
        </div>
      </div>

      {selected && (
        <div className="overlay" onClick={() => setSelected(null)}>
          <div
            className="drawer"
            role="dialog"
            aria-label={`${selected.name} details`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-top">
              <div>
                <div className="loc">
                  {selected.city}, {selected.state} &middot; {selected.size} firm
                </div>
                <h2 className="firm">{selected.name}</h2>
                {selected.cpaTier && <div className="tier">{selected.cpaTier}</div>}
              </div>
              <button className="closebtn" aria-label="Close" onClick={() => setSelected(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="meta">
              {selected.employees.toLocaleString()} employees &middot; Heat score {selected.heat}
            </div>

            <div className="linkrow">
              <a className="linkbtn" href={selected.website} target="_blank" rel="noopener noreferrer">
                <Globe size={13} />
                Website
              </a>
              <a className="linkbtn" href={selected.linkedin} target="_blank" rel="noopener noreferrer">
                <Linkedin size={13} />
                LinkedIn
              </a>
            </div>

            <h3>Signals — last 30 days</h3>
            {selected.signals.length === 0 && (
              <div className="none">No flagged activity — steady state.</div>
            )}
            <div className="sigs">
              {selected.signals.map((s, i) => (
                <div key={i} className="sig">
                  <div className="sig-head">
                    <Stamp type={s.type} />
                    <span className="sig-age">{age(s.daysAgo)}</span>
                  </div>
                  <div className="sig-hl">{s.headline}</div>
                  <div className="sig-pitch">
                    <b>Pitch angle</b> &middot; {s.pitch}
                  </div>
                  {s.sourceUrl && (
                    <a
                      className="srclink"
                      href={s.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View source ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
