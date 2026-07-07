// Manual refresh from the command line: `npm run refresh`
// (same pipeline the Mon/Wed cron endpoint runs).
import { runRefresh } from "../src/lib/refresh";
import { prisma } from "../src/lib/db";

runRefresh()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    if (!result.synthesis.usedLlm) {
      console.warn(
        "\n[warn] ANTHROPIC_API_KEY not set — used rule-based fallback synthesis instead of the LLM.",
      );
    }
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    // Connector HTTP internals can leave open handles; don't let a finished run hang.
    process.exit(process.exitCode ?? 0);
  });
