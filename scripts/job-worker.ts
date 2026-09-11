import { env } from "@/lib/db/env";
import { runPendingBackgroundJobs } from "@/lib/jobs/queue";

const args = new Set(process.argv.slice(2));
const runOnce = args.has("--once");

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  do {
    const result = await runPendingBackgroundJobs({
      limit: 10,
    });

    // eslint-disable-next-line no-console
    console.log(
      `[jobs] processed=${result.processed} succeeded=${result.succeeded} retryable=${result.retryable} failed=${result.failed}`,
    );

    if (runOnce) {
      break;
    }

    await sleep(env.backgroundJobsPollIntervalMs);
  } while (true);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[jobs] worker failed", error);
  process.exitCode = 1;
});
