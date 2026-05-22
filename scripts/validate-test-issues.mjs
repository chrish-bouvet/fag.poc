import process from "node:process";

import { toCanonicalEvent, writeJson } from "./lib/event.mjs";
import { loadFixtureIssues } from "./lib/test-harness.mjs";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const issues = await loadFixtureIssues({
    issuesDir: args.issuesDir,
    labelsFile: args.labelsFile
  });

  const events = issues.map((issue) => toCanonicalEvent(issue));
  const invalid = events.filter((event) => !event.valid);
  const report = {
    total: events.length,
    valid: events.length - invalid.length,
    invalid: invalid.length,
    issues: events.map((event) => ({
      issue_number: event.issue_number,
      title: event.title,
      status: event.status,
      valid: event.valid,
      errors: event.errors
    }))
  };

  if (args.writeJson) {
    await writeJson(args.writeJson, report);
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  if (invalid.length > 0) {
    process.exitCode = 1;
  }
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
    }
  }

  return args;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});