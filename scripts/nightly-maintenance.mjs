import process from "node:process";

import { listIssues, replaceIssueLabels, updateIssueState } from "./lib/github.mjs";
import {
  replaceStatusLabels,
  shouldBeHistorical,
  toCanonicalEvent,
  writeJson
} from "./lib/event.mjs";

async function main() {
  const issues = await listIssues({ state: "all" });
  const updated = [];

  for (const issue of issues) {
    const event = toCanonicalEvent(issue);
    if (!event.valid || event.status !== "status:approved") {
      continue;
    }

    if (!shouldBeHistorical(event.datetime)) {
      continue;
    }

    const nextLabels = replaceStatusLabels(issue.labels, "status:historical");
    await replaceIssueLabels(issue.number, nextLabels);

    if (process.env.AUTO_CLOSE_HISTORICAL === "true" && issue.state !== "closed") {
      await updateIssueState(issue.number, "closed");
    }

    updated.push({
      issue_number: issue.number,
      title: event.title,
      next_status: "status:historical"
    });
  }

  await writeJson("dist/nightly-maintenance.json", { updated });
  process.stdout.write(`${JSON.stringify({ updated }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});