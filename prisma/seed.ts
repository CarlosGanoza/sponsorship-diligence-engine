import { resetAndSeedDemo } from "@/lib/seed/run-seed";

async function main() {
  await resetAndSeedDemo();
}

main()
  .then(async () => {
    process.stdout.write("Demo data seeded successfully.\n");
  })
  .catch(async (error) => {
    process.stderr.write(`Seed failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
