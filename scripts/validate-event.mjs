import { readFile } from "node:fs/promises";
import process from "node:process";

import { normalizeEvent, parseIssueBody, validateEvent, writeJson } from "./lib/event.mjs";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const issue = await loadIssue(args);
  const parsed = parseIssueBody(issue.body);
  const normalized = normalizeEvent(parsed, issue);
  const validation = validateEvent(normalized);

  const result = {
    valid: validation.valid,
    status: validation.valid ? "status:needs-review" : "status:invalid",
    errors: validation.errors,
    event: normalized,
    issue: {
      number: issue.number,
      labels: normalized.labels,
      state: normalized.state
    }
  };

  if (args.writeJson) {
    await writeJson(args.writeJson, result);
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--body-file") {
      args.bodyFile = argv[index + 1];
      index += 1;
    } else if (value === "--event-file") {
      args.eventFile = argv[index + 1];
      index += 1;
    } else if (value === "--write-json") {
      args.writeJson = argv[index + 1];
      index += 1;
    }
  }

  return args;
}

async function loadIssue(args) {
  if (args.bodyFile) {
    return {
      number: 0,
      title: "Local example",
      state: "open",
      labels: [],
      body: await readFile(args.bodyFile, "utf8")
    };
  }

  const eventFile = args.eventFile ?? process.env.GITHUB_EVENT_PATH;
  if (!eventFile) {
    throw new Error("Use --body-file, --event-file or set GITHUB_EVENT_PATH.");
  }

  const event = JSON.parse(await readFile(eventFile, "utf8"));
  if (!event.issue?.body) {
    throw new Error("The event payload does not contain issue.body.");
  }

  return {
    number: event.issue.number,
    title: event.issue.title,
    state: event.issue.state,
    labels: event.issue.labels ?? [],
    body: event.issue.body
  };
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});