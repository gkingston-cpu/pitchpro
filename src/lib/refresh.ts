import { runConnectors, type ConnectorResult } from "./connectors";
import { runSynthesis, type SynthesisResult } from "./synthesis";

export interface RefreshResult {
  startedAt: string;
  finishedAt: string;
  connectors: ConnectorResult[];
  synthesis: SynthesisResult;
}

// The twice-weekly pipeline: connectors → synthesis → brief (spec §2, §6).
export async function runRefresh(): Promise<RefreshResult> {
  const startedAt = new Date().toISOString();
  const connectors = await runConnectors();
  const synthesis = await runSynthesis();
  return { startedAt, finishedAt: new Date().toISOString(), connectors, synthesis };
}
