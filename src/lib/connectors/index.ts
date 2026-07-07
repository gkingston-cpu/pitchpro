import { prisma } from "../db";
import type { Connector } from "./types";
import { tradePressConnector } from "./tradePress";
import { newsConnector } from "./news";
import { jobsConnector } from "./jobs";

export const CONNECTORS: Connector[] = [tradePressConnector, newsConnector, jobsConnector];

export interface ConnectorResult {
  source: string;
  ok: boolean;
  itemsFound: number;
  skipped?: string;
  error?: string;
}

/**
 * Run every configured connector, upserting normalized signals so re-runs are
 * idempotent. One broken source never blocks the rest (spec §6): each failure
 * is logged to connector_runs and reported in the result list.
 */
export async function runConnectors(): Promise<ConnectorResult[]> {
  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  const results: ConnectorResult[] = [];

  for (const connector of CONNECTORS) {
    const configured = connector.isConfigured();
    if (configured !== true) {
      results.push({ source: connector.source, ok: true, itemsFound: 0, skipped: configured.reason });
      continue;
    }

    const run = await prisma.connectorRun.create({ data: { source: connector.source } });
    try {
      const signals = await connector.fetchSignals({ companies });
      let inserted = 0;
      for (const s of signals) {
        const res = await prisma.rawSignal.upsert({
          where: { source_externalId: { source: connector.source, externalId: s.externalId } },
          create: {
            companyId: s.companyId,
            source: connector.source,
            signalType: s.signalType,
            externalId: s.externalId,
            rawPayload: JSON.stringify(s.rawPayload),
            detectedAt: s.detectedAt,
          },
          update: {}, // already seen — leave it (and its processedAt) alone
        });
        if (res.processedAt === null) inserted++;
      }
      await prisma.connectorRun.update({
        where: { id: run.id },
        data: { finishedAt: new Date(), ok: true, itemsFound: inserted },
      });
      results.push({ source: connector.source, ok: true, itemsFound: inserted });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.connectorRun.update({
        where: { id: run.id },
        data: { finishedAt: new Date(), ok: false, error: message },
      });
      results.push({ source: connector.source, ok: false, itemsFound: 0, error: message });
    }
  }
  return results;
}
