"use client";

import React, { useState, useMemo } from "react";
import { Search, TrendingUp, Users, Newspaper, FileText, X, RefreshCw } from "lucide-react";
import type { CompanyView, DashboardData, SignalType } from "@/lib/types";
import { SIGNAL_TYPES } from "@/lib/types";

// UI ported from the design mockup (cpa-affiliate-dashboard.jsx) — same layout
// and styling, wired to real data passed down from the server component.

const SIGNAL_META: Record<SignalType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  hire: { label: "HIRE", icon: Users, color: "#8a6d2f", bg: "#f3e6c4" },
  ma: { label: "M&A", icon: TrendingUp, color: "#8c2f24", bg: "#f0d6d0" },
  news: { label: "NEWS", icon: Newspaper, color: "#2f5a8c", bg: "#d6e2f0" },
  filing: { label: "FILING", icon: FileText, color: "#2f6b4f", bg: "#d4e8dc" },
  succession: { label: "SUCCESSION", icon: Users, color: "#6b3f8c", bg: "#e3d6f0" },
  intent: { label: "INTENT", icon: Search, color: "#a13d2e", bg: "#f2ddd6" },
  expansion: { label: "EXPANSION", icon: TrendingUp, color: "#2f7a6e", bg: "#d3ece7" },
  sentiment: { label: "SENTIMENT", icon: Newspaper, color: "#7a5a2f", bg: "#eee0c9" },
  winloss: { label: "WIN/LOSS", icon: FileText, color: "#5c3d8c", bg: "#e2d6ef" },
  usage: { label: "USAGE", icon: TrendingUp, color: "#2f5a8c", bg: "#d6e2f0" },
  compliance: { label: "COMPLIANCE", icon: FileText, color: "#8c2f6b", bg: "#f0d6e6" },
  turnover: { label: "TURNOVER", icon: Users, color: "#8c5a2f", bg: "#f0e0d0" },
  techstack: { label: "TECH RFP", icon: Search, color: "#2f8c6b", bg: "#d0f0e2" },
};

const SIGNAL_FILTER_LABELS: Record<SignalType, string> = {
  hire: "Buyer-role hires",
  ma: "M&A activity",
  news: "Transition news",
  filing: "Growth / filings",
  succession: "Partner succession",
  intent: "Competitor-tool intent",
  expansion: "New office expansion",
  sentiment: "Employee sentiment shift",
  winloss: "Client win/loss",
  usage: "CPA.com usage change",
  compliance: "Compliance deadline",
  turnover: "Staff turnover spike",
  techstack: "Tech modernization RFP",
};

// How many days one refresh cycle covers (Mon → Wed → Mon).
const CYCLE_DAYS = 4;

function Stamp({ type }: { type: SignalType }) {
  const meta = SIGNAL_META[type];
  const Icon = meta.icon;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontFamily: "'Courier New', ui-monospace, monospace",
        fontSize: "10.5px",
        fontWeight: 700,
        letterSpacing: "0.06em",
        color: meta.color,
        border: `1.5px solid ${meta.color}`,
        borderRadius: "3px",
        padding: "2px 6px",
        transform: `rotate(${(type.charCodeAt(0) % 5) - 2}deg)`,
        background: meta.bg,
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={11} strokeWidth={2.5} />
      {meta.label}
    </span>
  );
}

function HeatBar({ heat, max }: { heat: number; max: number }) {
  const pct = Math.min(100, Math.round((heat / max) * 100));
  const color = pct > 60 ? "#8c2f24" : pct > 30 ? "#8a6d2f" : "#3d5a6c";
  return (
    <div style={{ width: "64px", height: "6px", background: "#e4ddc9", borderRadius: "2px", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: "2px" }} />
    </div>
  );
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
      if (sortKey === "heat") return b.heat - a.heat;
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "employees") return b.employees - a.employees;
      return 0;
    });
  }, [companies, query, stateFilter, signalFilter, sortKey]);

  const topSignals = companies.filter((c) => c.signals.length > 0).slice(0, 6);
  const warmAccounts = companies.filter((c) => c.cpaTier).slice(0, 8);
  const warmTotal = companies.filter((c) => c.cpaTier).length;
  const counts = SIGNAL_TYPES.reduce<Record<string, number>>((acc, t) => {
    acc[t] = companies.filter((c) => c.signals.some((s) => s.type === t)).length;
    return acc;
  }, {});
  const activeThisCycle = companies.filter((c) =>
    c.signals.some((s) => s.daysAgo <= CYCLE_DAYS),
  ).length;

  const paper = "#f2ede1";
  const ink = "#242118";
  const rule = "#c9c0a8";

  const briefFallback =
    companies.length === 0
      ? "No firms loaded yet. Import your firm list (npm run import:firms) and run a refresh (npm run refresh) to populate this brief."
      : `${activeThisCycle} firms show fresh activity this cycle.` +
        (topSignals[0]
          ? ` ${topSignals[0].name} is the top priority — ${topSignals[0].signals[0].headline.toLowerCase()}.`
          : " No synthesized signals yet — run a refresh to generate them.") +
        (warmTotal > 0
          ? ` ${warmTotal} tracked firm${warmTotal === 1 ? "" : "s"} are already CPA.com-affiliated — treat these as warm, low-friction intros regardless of other activity.`
          : "");

  return (
    <div style={{ minHeight: "100vh", background: paper, color: ink, fontFamily: "Georgia, 'Times New Roman', serif" }}>
      {previewMode && (
        <div style={{ background: "#8c2f24", color: "#f2ede1", padding: "6px 28px", fontFamily: "ui-monospace, monospace", fontSize: "11.5px", letterSpacing: "0.04em" }}>
          OPEN PREVIEW MODE — no login configured. Set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / ALLOWED_EMAILS before deploying.
        </div>
      )}

      {/* Header */}
      <div style={{ borderBottom: `2px solid ${ink}`, padding: "20px 28px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ fontFamily: "ui-monospace, 'Courier New', monospace", fontSize: "11px", letterSpacing: "0.12em", color: "#6b6350", marginBottom: "4px" }}>
              SALES INTELLIGENCE · CPA.COM AFFILIATE NETWORK
            </div>
            <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 400, letterSpacing: "-0.01em" }}>
              The Ledger — Mon/Wed Brief
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontFamily: "ui-monospace, monospace", fontSize: "11.5px", color: "#6b6350" }}>
            <RefreshCw size={13} />
            Refreshes Mon &amp; Wed, 6:00 AM ET
            {data.lastRefreshAt
              ? ` · last refresh ${new Date(data.lastRefreshAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
              : " · no refresh run yet"}
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", borderBottom: `1px solid ${rule}` }}>
        {[
          { label: "Firms tracked", value: totalTracked.toLocaleString() },
          { label: "New signals this cycle", value: activeThisCycle },
          { label: "CPA.com-affiliated (warm)", value: warmTotal },
          { label: "Buyer-role hires", value: counts.hire },
          { label: "M&A activity", value: counts.ma },
          { label: "Compliance-deadline pressure", value: counts.compliance },
        ].map((s, idx) => (
          <div key={idx} style={{ padding: "14px 20px", borderRight: idx < 5 ? `1px solid ${rule}` : "none" }}>
            <div style={{ fontFamily: "ui-monospace, monospace", fontSize: "22px", fontWeight: 700 }}>{s.value}</div>
            <div style={{ fontSize: "11px", color: "#6b6350", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: "24px 28px", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "28px" }}>
        {/* Agent brief */}
        <div style={{ background: "#fbf9f2", border: `1px solid ${rule}`, borderRadius: "2px", padding: "16px 18px", position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "11px", letterSpacing: "0.08em", color: "#6b6350", textTransform: "uppercase" }}>
              Agent brief
              {brief
                ? ` — generated ${new Date(brief.generatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                : ""}
            </span>
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "10.5px", border: `1px solid ${ink}`, borderRadius: "2px", padding: "1px 6px", transform: "rotate(-2deg)" }}>
              AUTO-DRAFTED
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6 }}>{brief?.text ?? briefFallback}</p>
        </div>

        {/* Warm accounts */}
        {warmAccounts.length > 0 && (
          <div>
            <h2 style={{ fontSize: "15px", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, margin: "0 0 12px", color: "#4a4536" }}>
              Warm accounts — already in the CPA.com ecosystem
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "10px" }}>
              {warmAccounts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c)}
                  style={{
                    textAlign: "left", background: "#fbf9f2", border: `1px solid ${rule}`,
                    borderLeft: "4px solid #6b3f8c", borderRadius: "2px", padding: "10px 12px",
                    cursor: "pointer", fontFamily: "inherit", color: "inherit",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: "13.5px" }}>{c.name}</div>
                  <div style={{ fontSize: "11px", color: "#6b3f8c", marginTop: "2px", fontWeight: 700 }}>{c.cpaTier}</div>
                  <div style={{ fontSize: "11px", color: "#6b6350", marginTop: "2px", fontFamily: "ui-monospace, monospace" }}>{c.city}, {c.state}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Signal feed */}
        {topSignals.length > 0 && (
          <div>
            <h2 style={{ fontSize: "15px", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, margin: "0 0 12px", color: "#4a4536" }}>
              Today&apos;s priority outreach
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
              {topSignals.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c)}
                  style={{
                    textAlign: "left",
                    background: "#fbf9f2",
                    border: `1px solid ${rule}`,
                    borderLeft: `4px solid ${SIGNAL_META[c.signals[0].type].color}`,
                    borderRadius: "2px",
                    padding: "12px 14px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    color: "inherit",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "8px" }}>
                    <div style={{ fontWeight: 700, fontSize: "14.5px" }}>{c.name}</div>
                    <Stamp type={c.signals[0].type} />
                  </div>
                  <div style={{ fontSize: "11.5px", color: "#6b6350", marginTop: "2px", fontFamily: "ui-monospace, monospace" }}>
                    {c.city}, {c.state} · {c.size} · {c.employees} employees
                  </div>
                  <div style={{ fontSize: "13px", marginTop: "8px", lineHeight: 1.4 }}>{c.signals[0].headline}</div>
                  <div style={{ fontSize: "11px", color: "#6b6350", marginTop: "2px" }}>
                    {c.signals[0].daysAgo === 0 ? "Today" : `${c.signals[0].daysAgo}d ago`}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", borderTop: `1px solid ${rule}`, paddingTop: "18px" }}>
          <div style={{ position: "relative", flex: "1 1 220px" }}>
            <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#8a8362" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search firm name…"
              style={{
                width: "100%", boxSizing: "border-box", padding: "8px 10px 8px 30px",
                border: `1px solid ${rule}`, borderRadius: "2px", background: "#fbf9f2",
                fontFamily: "inherit", fontSize: "13px", color: ink,
              }}
            />
          </div>
          <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} style={selectStyle(rule)}>
            <option value="ALL">All states</option>
            {states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={signalFilter} onChange={(e) => setSignalFilter(e.target.value)} style={selectStyle(rule)}>
            <option value="ALL">All signal types</option>
            {SIGNAL_TYPES.map((t) => (
              <option key={t} value={t}>{SIGNAL_FILTER_LABELS[t]}</option>
            ))}
          </select>
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} style={selectStyle(rule)}>
            <option value="heat">Sort: signal heat</option>
            <option value="name">Sort: name</option>
            <option value="employees">Sort: firm size</option>
          </select>
        </div>

        {/* Table */}
        <div style={{ border: `1px solid ${rule}`, borderRadius: "2px", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 2.5fr 0.8fr", background: "#e9e2cc", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#4a4536", fontWeight: 700 }}>
            <div style={cellStyle}>Firm</div>
            <div style={cellStyle}>Location</div>
            <div style={cellStyle}>Size</div>
            <div style={cellStyle}>Employees</div>
            <div style={cellStyle}>Latest signal</div>
            <div style={cellStyle}>Heat</div>
          </div>
          <div style={{ maxHeight: "480px", overflowY: "auto" }}>
            {filtered.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelected(c)}
                style={{
                  display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 2.5fr 0.8fr",
                  borderTop: `1px solid ${rule}`, cursor: "pointer", fontSize: "13px", background: "#fbf9f2",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f2ecd8")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fbf9f2")}
              >
                <div style={{ ...cellStyle, fontWeight: 700, gap: "6px" }}>
                  {c.name}
                  {c.cpaTier && (
                    <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#6b3f8c", border: "1px solid #6b3f8c", borderRadius: "2px", padding: "1px 4px" }}>
                      WARM
                    </span>
                  )}
                </div>
                <div style={{ ...cellStyle, fontFamily: "ui-monospace, monospace", fontSize: "12px" }}>{c.city}, {c.state}</div>
                <div style={cellStyle}>{c.size}</div>
                <div style={{ ...cellStyle, fontFamily: "ui-monospace, monospace" }}>{c.employees}</div>
                <div style={cellStyle}>
                  {c.signals.length > 0 ? (
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Stamp type={c.signals[0].type} />
                      <span style={{ color: "#4a4536", fontSize: "12px" }}>{c.signals[0].headline}</span>
                    </span>
                  ) : (
                    <span style={{ color: "#a39d84", fontSize: "12px" }}>No recent activity</span>
                  )}
                </div>
                <div style={cellStyle}><HeatBar heat={c.heat} max={maxHeat} /></div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: "24px", textAlign: "center", color: "#8a8362", fontSize: "13px" }}>
                {companies.length === 0
                  ? "No firms loaded yet — import your firm list with `npm run import:firms <csv>`."
                  : "No firms match those filters."}
              </div>
            )}
          </div>
        </div>

        <div style={{ fontSize: "11.5px", color: "#8a8362", fontFamily: "ui-monospace, monospace" }}>
          Refreshes automatically every Monday and Wednesday morning from CPA.com affiliate records, trade press, news, and job-board sources.
        </div>
      </div>

      {/* Detail drawer */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(36,33,24,0.4)", display: "flex", justifyContent: "flex-end", zIndex: 50 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(420px, 92vw)", height: "100%", background: paper, borderLeft: `2px solid ${ink}`, padding: "24px", overflowY: "auto", boxSizing: "border-box" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div>
                <div style={{ fontFamily: "ui-monospace, monospace", fontSize: "11px", color: "#6b6350" }}>{selected.city}, {selected.state} · {selected.size} firm</div>
                <h2 style={{ margin: "4px 0 0", fontSize: "22px", fontWeight: 400 }}>{selected.name}</h2>
                {selected.cpaTier && (
                  <div style={{ fontSize: "11.5px", color: "#6b3f8c", marginTop: "4px", fontWeight: 700 }}>{selected.cpaTier}</div>
                )}
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: ink }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ marginTop: "18px", fontSize: "12px", color: "#6b6350" }}>{selected.employees} employees · Heat score {selected.heat}</div>

            <h3 style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em", color: "#4a4536", marginTop: "24px" }}>Signals (last 30 days)</h3>
            {selected.signals.length === 0 && <div style={{ fontSize: "13px", color: "#8a8362", marginTop: "8px" }}>No flagged activity — steady state.</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "10px" }}>
              {selected.signals.map((s, i) => (
                <div key={i} style={{ border: `1px solid ${rule}`, borderRadius: "2px", padding: "12px", background: "#fbf9f2" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Stamp type={s.type} />
                    <span style={{ fontSize: "11px", color: "#8a8362", fontFamily: "ui-monospace, monospace" }}>{s.daysAgo === 0 ? "Today" : `${s.daysAgo}d ago`}</span>
                  </div>
                  <div style={{ fontSize: "14px", marginTop: "8px", fontWeight: 700 }}>{s.headline}</div>
                  <div style={{ fontSize: "12.5px", marginTop: "6px", lineHeight: 1.5, color: "#4a4536" }}>
                    <span style={{ fontWeight: 700 }}>Pitch angle: </span>{s.pitch}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function selectStyle(rule: string): React.CSSProperties {
  return {
    padding: "8px 10px", border: `1px solid ${rule}`, borderRadius: "2px",
    background: "#fbf9f2", fontFamily: "inherit", fontSize: "12.5px", color: "#242118",
  };
}
const cellStyle: React.CSSProperties = { padding: "10px 12px", display: "flex", alignItems: "center" };
