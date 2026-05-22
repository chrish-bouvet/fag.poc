import process from "node:process";

import { shouldBeHistorical, toCanonicalEvent, writeJson } from "./lib/event.mjs";
import { loadFixtureIssues } from "./lib/test-harness.mjs";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const issues = await loadFixtureIssues({
    issuesDir: args.issuesDir,
    labelsFile: args.labelsFile
  });

  const updates = issues
    .map((issue) => toCanonicalEvent(issue))
    .filter((event) => event.valid && event.status === "status:approved")
    .filter((event) => shouldBeHistorical(event.datetime, args.now ? new Date(args.now) : new Date()))
    .map((event) => ({
      issue_number: event.issue_number,
      title: event.title,
      from: event.status,
      to: "status:historical"
    }));

  const report = {
    now: args.now ?? new Date().toISOString(),
    updates
  };

  if (args.writeJson) {
    await writeJson(args.writeJson, report);
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--issues-dir") {
      args.issuesDir = argv[index + 1];
      index += 1;
    } else if (value === "--labels-file") {
      args.labelsFile = argv[index + 1];
      index += 1;
    } else if (value === "--write-json") {
      args.writeJson = argv[index + 1];
      index += 1;
    } else if (value === "--now") {
      args.now = argv[index + 1];
      index += 1;
    }
  }

  return args;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});