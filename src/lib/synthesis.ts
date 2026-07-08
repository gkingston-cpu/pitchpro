import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./db";
import { heatContribution, daysAgo } from "./heat";
import { SIGNAL_TYPES, type SignalType } from "./types";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const MIN_CONFIDENCE = 0.6;

interface SynthesizedSignal {
  type: SignalType;
  headline: string;
  pitch_angle: string;
  confidence: number;
}

function getClient(): Anthropic | null {
  return process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
}

function extractJson<T>(text: string): T | null {
  // The model is asked for bare JSON, but tolerate a fenced block.
  const match = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

// Prompt template from the build spec (§5).
async function synthesizeCompany(
  client: Anthropic,
  companyName: string,
  rawSignals: { signalType: string; rawPayload: string; detectedAt: Date }[],
): Promise<SynthesizedSignal[]> {
  const payload = rawSignals.map((s) => ({
    type: s.signalType,
    detected_at: s.detectedAt.toISOString(),
    data: JSON.parse(s.rawPayload),
  }));

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: `You are a sales intelligence analyst for a CPA-firm software vendor selling a regulatory data-organization product (a speed/organization upgrade, not a mandatory tool — timing and pressure matter most).
Given these raw signals for ${companyName} detected since the last refresh:
${JSON.stringify(payload, null, 2)}

For each signal, output a JSON array of objects: { "type" (one of ${SIGNAL_TYPES.join(", ")}), "headline" (<12 words, plain language), "pitch_angle" (1 sentence: why this is a moment to reach out), "confidence" (0-1) }.
Only include signals with confidence >= ${MIN_CONFIDENCE}. Do not invent facts not present in the input. Output only the JSON array, nothing else.`,
      },
    ],
  });

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const parsed = extractJson<SynthesizedSignal[]>(text);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (s) =>
      s &&
      SIGNAL_TYPES.includes(s.type) &&
      typeof s.headline === "string" &&
      typeof s.pitch_angle === "string" &&
      typeof s.confidence === "number" &&
      s.confidence >= MIN_CONFIDENCE,
  );
}

// Deterministic fallback so the pipeline still produces usable rows when no
// ANTHROPIC_API_KEY is configured (flagged in the refresh result).
const FALLBACK_PITCHES: Record<SignalType, string> = {
  hire: "A new buyer-side hire is likely re-evaluating vendors in their first 90 days.",
  ma: "Post-merger systems consolidation creates urgency for a unified platform.",
  news: "Growth-mode investment — good timing to pitch scalable infrastructure.",
  filing: "Growth targets imply capacity strain — pitch the efficiency/automation angle.",
  succession: "Incoming leadership is a prime window to reset vendor relationships.",
  intent: "Direct intent signal — they are actively shopping for a replacement.",
  expansion: "Multi-office growth strains manual processes — pitch centralized workflow.",
  sentiment: "Internal friction often precedes a tooling change.",
  winloss: "Competitive pressure makes firms more receptive to differentiating investments.",
  usage: "Usage shift — time for proactive outreach before contract review.",
  compliance: "A compliance deadline is real pressure even for a nice-to-have tool.",
  turnover: "High turnover means knowledge is walking out the door — pitch continuity.",
  techstack: "They have already budgeted for change — get in before a competitor locks it in.",
};

function fallbackSynthesis(
  rawSignals: { signalType: string; rawPayload: string }[],
): SynthesizedSignal[] {
  return rawSignals.map((s) => {
    const type = (SIGNAL_TYPES as readonly string[]).includes(s.signalType)
      ? (s.signalType as SignalType)
      : "news";
    let headline = "New activity detected";
    try {
      const payload = JSON.parse(s.rawPayload) as { title?: string; headline?: string };
      headline = payload.title ?? payload.headline ?? headline;
    } catch {
      /* keep default */
    }
    return { type, headline: headline.slice(0, 120), pitch_angle: FALLBACK_PITCHES[type], confidence: 0.6 };
  });
}

export interface SynthesisResult {
  companiesProcessed: number;
  signalsCreated: number;
  usedLlm: boolean;
  briefCreated: boolean;
  errors: string[];
}

/**
 * Read each firm's unprocessed raw signals, produce headline/pitch/heat rows,
 * then roll everything up into the cycle's Agent Brief (spec §2, §5).
 */
export async function runSynthesis(): Promise<SynthesisResult> {
  const client = getClient();
  const errors: string[] = [];
  let signalsCreated = 0;

  const pending = await prisma.rawSignal.findMany({
    where: { processedAt: null },
    include: { company: { select: { name: true } } },
    orderBy: { companyId: "asc" },
  });

  const byCompany = new Map<number, typeof pending>();
  for (const raw of pending) {
    const list = byCompany.get(raw.companyId) ?? [];
    list.push(raw);
    byCompany.set(raw.companyId, list);
  }

  for (const [companyId, rawSignals] of byCompany) {
    try {
      const synthesized = client
        ? await synthesizeCompany(client, rawSignals[0].company.name, rawSignals)
        : fallbackSynthesis(rawSignals);

      for (let i = 0; i < synthesized.length; i++) {
        const s = synthesized[i];
        // Best-effort provenance: pair each output with the raw signal at the
        // same position (fallback synthesis is 1:1; the LLM usually is too).
        const raw = rawSignals[i] ?? rawSignals[0];
        const occurredAt = raw.detectedAt;
        let sourceUrl: string | null = null;
        try {
          const payload = JSON.parse(raw.rawPayload) as { link?: string; url?: string };
          sourceUrl = payload.link ?? payload.url ?? null;
        } catch {
          /* no link available */
        }
        await prisma.signal.create({
          data: {
            companyId,
            signalType: s.type,
            headline: s.headline,
            pitchAngle: s.pitch_angle,
            confidence: s.confidence,
            occurredAt,
            heatContribution: heatContribution(s.type, daysAgo(occurredAt)),
            sourceUrl,
          },
        });
        signalsCreated++;
      }
      await prisma.rawSignal.updateMany({
        where: { id: { in: rawSignals.map((r) => r.id) } },
        data: { processedAt: new Date() },
      });
    } catch (err) {
      // Leave this firm's raw signals unprocessed; next cycle retries them.
      errors.push(
        `company ${companyId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const briefCreated = await generateBrief(client);

  return {
    companiesProcessed: byCompany.size,
    signalsCreated,
    usedLlm: client !== null,
    briefCreated,
    errors,
  };
}

async function generateBrief(client: Anthropic | null): Promise<boolean> {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const companies = await prisma.company.findMany({
    include: { signals: { where: { occurredAt: { gte: since } }, orderBy: { occurredAt: "desc" } } },
  });

  const scored = companies
    .map((c) => ({ ...c, heat: c.signals.reduce((acc, s) => acc + s.heatContribution, 0) }))
    .sort((a, b) => b.heat - a.heat);
  const top = scored.filter((c) => c.signals.length > 0).slice(0, 10);
  const warmCount = companies.filter((c) => c.cpaAffiliationTier).length;
  if (top.length === 0 && warmCount === 0) return false;

  let summaryText: string;
  if (client) {
    const digest = top.map((c) => ({
      name: c.name,
      heat: c.heat,
      warm: Boolean(c.cpaAffiliationTier),
      signals: c.signals.slice(0, 3).map((s) => ({ type: s.signalType, headline: s.headline })),
    }));
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `You are writing the morning "Agent Brief" for two salespeople selling a regulatory data-organization product to CPA firms. ${warmCount} tracked firms are CPA.com-affiliated (warm accounts). Here are today's hottest firms and their signals:
${JSON.stringify(digest, null, 2)}

Write one tight paragraph (3-5 sentences, plain prose, no markdown): name the top 1-2 priority firms and why now, call out any active buying-intent or M&A signals, and remind them warm CPA.com-affiliated accounts are low-friction intros. Do not invent facts.`,
        },
      ],
    });
    summaryText = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
  } else {
    // Rule-based composition: lead with the hottest actionable firm, then the
    // cycle's M&A count, then the warm-account reminder.
    const ACTIONABLE = new Set(["ma", "hire", "intent", "succession", "compliance", "techstack", "turnover", "expansion"]);
    const lead =
      top.find((c) => c.signals.some((s) => ACTIONABLE.has(s.signalType))) ?? top[0];
    const leadSignal = lead?.signals.find((s) => ACTIONABLE.has(s.signalType)) ?? lead?.signals[0];
    const maFirms = new Set(
      top.filter((c) => c.signals.some((s) => s.signalType === "ma")).map((c) => c.name),
    );
    const parts: string[] = [
      `${top.length} firm${top.length === 1 ? "" : "s"} show fresh signal activity this cycle.`,
    ];
    if (lead && leadSignal) {
      parts.push(`Top priority: ${lead.name} — ${leadSignal.headline.replace(/\.$/, "")}.`);
    }
    if (maFirms.size > 1) {
      parts.push(
        `${maFirms.size} firms have live M&A or investment activity — post-deal integration is the strongest window for a systems-consolidation pitch.`,
      );
    }
    if (warmCount > 0) {
      parts.push(
        `${warmCount} tracked firm${warmCount === 1 ? "" : "s"} are already CPA.com-affiliated — treat those as warm, low-friction intros regardless of other activity.`,
      );
    }
    summaryText = parts.join(" ");
  }

  await prisma.brief.create({
    data: { summaryText, topCompanyIds: JSON.stringify(top.map((c) => c.id)) },
  });
  return true;
}
