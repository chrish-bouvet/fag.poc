import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export async function loadFixtureIssues({ issuesDir, labelsFile }) {
  if (!issuesDir) {
    throw new Error("issuesDir is required.");
  }

  const labelsMap = labelsFile ? JSON.parse(await readFile(labelsFile, "utf8")) : {};
  const entries = await readdir(issuesDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && /^issue-\d+\.md$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => extractIssueNumber(left) - extractIssueNumber(right));

  const issues = [];

  for (const fileName of files) {
    const issueNumber = extractIssueNumber(fileName);
    const body = await readFile(path.join(issuesDir, fileName), "utf8");
    const labelNames = labelsMap[String(issueNumber)] ?? [];

    issues.push({
      number: issueNumber,
      title: `[Fixture] Issue ${issueNumber}`,
      state: labelNames.includes("status:historical") ? "closed" : "open",
      labels: labelNames.map((name) => ({ name })),
      body,
      html_url: null
    });
  }

  return issues;
}

function extractIssueNumber(fileName) {
  const match = fileName.match(/issue-(\d+)\.md/i);
  if (!match) {
    throw new Error(`Could not extract issue number from ${fileName}.`);
  }

  return Number(match[1]);
}