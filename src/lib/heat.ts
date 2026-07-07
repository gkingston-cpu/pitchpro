import type { SignalType } from "./types";

// Recency-decayed heat, matching the mockup: a signal is worth up to 30 points
// on day 0, fading to 0 after 30 days — scaled by how strong the signal type is.
const SIGNAL_WEIGHTS: Record<SignalType, number> = {
  intent: 1.5, // named-competitor job posting: active buying intent, highest tier
  techstack: 1.4, // budgeted modernization initiative
  ma: 1.3, // systems consolidation pressure
  compliance: 1.2, // real external deadline
  hire: 1.1, // new buyer re-evaluating vendors
  succession: 1.1,
  turnover: 1.0,
  usage: 1.0,
  filing: 0.9,
  expansion: 0.9,
  winloss: 0.8,
  sentiment: 0.7,
  news: 0.7,
};

export function heatContribution(type: SignalType, daysAgo: number): number {
  const recency = Math.max(0, 30 - daysAgo);
  return Math.round(recency * (SIGNAL_WEIGHTS[type] ?? 1));
}

export function daysAgo(date: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}
