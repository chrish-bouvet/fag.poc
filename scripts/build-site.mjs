import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { listIssues } from "./lib/github.mjs";
import { toCanonicalEvent, writeJson } from "./lib/event.mjs";
import { loadFixtureIssues } from "./lib/test-harness.mjs";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const issues = await loadIssues(args);
  const events = issues.map((issue) => toCanonicalEvent(issue)).filter((event) => event.valid);
  const publishable = events.filter((event) =>
    ["status:approved", "status:historical", "status:cancelled"].includes(event.status)
  );
  const outDir = args.outDir ?? "dist";

  await mkdir(path.join(outDir, "events"), { recursive: true });
  await writeJson(path.join(outDir, "events.json"), publishable);
  await Promise.all(publishable.map((event) => writeEventPage(event, outDir)));
  await writeFile(path.join(outDir, "index.html"), renderIndexPage(publishable));
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--issues-file") {
      args.issuesFile = argv[index + 1];
      index += 1;
    } else if (value === "--issues-dir") {
      args.issuesDir = argv[index + 1];
      index += 1;
    } else if (value === "--labels-file") {
      args.labelsFile = argv[index + 1];
      index += 1;
    } else if (value === "--out-dir") {
      args.outDir = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

async function loadIssues(args) {
  if (args.issuesDir) {
    return loadFixtureIssues({ issuesDir: args.issuesDir, labelsFile: args.labelsFile });
  }

  if (args.issuesFile) {
    return JSON.parse(await readFile(args.issuesFile, "utf8"));
  }

  return listIssues({ state: "all" });
}

async function writeEventPage(event, outDir) {
  const filePath = path.join(outDir, "events", `${event.slug}.html`);
  await writeFile(filePath, renderEventPage(event));
}

function renderIndexPage(events) {
  const upcoming = events.filter((event) => event.status === "status:approved");
  const historical = events.filter((event) => event.status === "status:historical");
  const cancelled = events.filter((event) => event.status === "status:cancelled");

  return `<!doctype html>
<html lang="no">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Faglige arrangementer</title>
    <style>
      :root { color-scheme: light; --bg: #f6f1e8; --surface: #fffaf1; --ink: #13232f; --accent: #0f766e; --muted: #5f6b73; }
      body { margin: 0; font-family: Georgia, serif; background: linear-gradient(180deg, #f5efe2 0%, #f9f6ef 100%); color: var(--ink); }
      header, main { max-width: 960px; margin: 0 auto; padding: 24px; }
      h1, h2, h3 { line-height: 1.1; }
      section { margin-bottom: 32px; }
      .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
      article { background: var(--surface); border: 1px solid rgba(19, 35, 47, 0.12); border-radius: 16px; padding: 20px; box-shadow: 0 10px 25px rgba(19, 35, 47, 0.06); }
      a { color: var(--accent); text-decoration: none; }
      .meta { color: var(--muted); font-size: 0.95rem; }
      .empty { color: var(--muted); font-style: italic; }
      .pill { display: inline-block; margin-right: 8px; margin-top: 8px; padding: 4px 10px; border-radius: 999px; background: rgba(15, 118, 110, 0.1); font-size: 0.85rem; }
    </style>
  </head>
  <body>
    <header>
      <h1>Faglige arrangementer</h1>
      <p>Portal for kommende, historiske og avlyste arrangementer.</p>
    </header>
    <main>
      ${renderSection("Kommende", upcoming, "Ingen kommende arrangementer akkurat na.")}
      ${renderSection("Historikk", historical, "Ingen historiske arrangementer ennå.")}
      ${renderSection("Avlyst", cancelled, "Ingen avlyste arrangementer.")}
    </main>
  </body>
</html>`;
}

function renderSection(title, events, emptyMessage) {
  if (events.length === 0) {
    return `<section><h2>${title}</h2><p class="empty">${emptyMessage}</p></section>`;
  }

  return `<section><h2>${title}</h2><div class="grid">${events
    .map(
      (event) => `<article>
        <h3><a href="events/${event.slug}.html">${escapeHtml(event.title)}</a></h3>
        <p>${escapeHtml(event.short_description)}</p>
        <p class="meta">${escapeHtml(event.datetime)} | ${escapeHtml(event.community)} | ${escapeHtml(event.owner)}</p>
        <div>${event.tags.map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join("")}</div>
      </article>`
    )
    .join("")}</div></section>`;
}

function renderEventPage(event) {
  return `<!doctype html>
<html lang="no">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(event.title)}</title>
    <style>
      body { margin: 0; font-family: Georgia, serif; background: #fcfaf6; color: #13232f; }
      main { max-width: 760px; margin: 0 auto; padding: 32px 24px 64px; }
      a { color: #0f766e; }
      .meta { color: #5f6b73; }
      .status { display: inline-block; margin-bottom: 16px; padding: 6px 12px; border-radius: 999px; background: rgba(15, 118, 110, 0.1); }
    </style>
  </head>
  <body>
    <main>
      <p><a href="../index.html">Tilbake til oversikten</a></p>
      <span class="status">${escapeHtml(event.status)}</span>
      <h1>${escapeHtml(event.title)}</h1>
      <p class="meta">${escapeHtml(event.datetime)} | ${escapeHtml(event.community)} | ${escapeHtml(event.owner)}</p>
      <p>${escapeHtml(event.short_description)}</p>
      <p><a href="${escapeHtml(event.signup_url)}">Pamelding</a></p>
      <article>${renderParagraphs(event.description)}</article>
    </main>
  </body>
</html>`;
}

function renderParagraphs(text) {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => `<p>${escapeHtml(paragraph.trim())}</p>`)
    .join("");
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});