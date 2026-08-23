import { runEmailOutboxOnce } from "./worker.js";

async function main() {
  while (true) {
    const processed = await runEmailOutboxOnce();
    if (!processed) await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
}

main().catch((error) => {
  console.error("Worker stopped:", error instanceof Error ? error.name : "Unknown");
  process.exitCode = 1;
});
