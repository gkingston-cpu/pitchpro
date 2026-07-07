import type { SignalType } from "../types";

// The common shape every connector normalizes into (build spec §2).
export interface NormalizedRawSignal {
  companyId: number;
  signalType: SignalType;
  /** Stable per-source id (article url, job posting id) for idempotent upserts. */
  externalId: string;
  rawPayload: unknown;
  detectedAt: Date;
}

export interface ConnectorContext {
  companies: { id: number; name: string }[];
}

export interface Connector {
  source: string;
  /** Return false (with a reason) when required env/config is missing. */
  isConfigured(): true | { reason: string };
  fetchSignals(ctx: ConnectorContext): Promise<NormalizedRawSignal[]>;
}
