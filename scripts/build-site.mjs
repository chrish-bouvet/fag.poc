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

const SHARED_STYLES = `
      :root {
        color-scheme: light;
        --bg: #fcf8f3;
        --surface: #ffffff;
        --ink: #010203;
        --ink-soft: #11133c;
        --muted: #454545;
        --accent: #0617bf;
        --accent-strong: #11133c;
        --border: #010203;
        --pill-bg: #ffffff;
        --pill-bg-active: #0617bf;
        --pill-ink-active: #ffffff;
        --creme: #f9ead4;
        --baby-blue: #edf5fa;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif;
        background: var(--bg);
        color: var(--ink);
        line-height: 1.5;
        -webkit-font-smoothing: antialiased;
      }
      a { color: var(--accent); text-decoration: none; }
      a:hover { text-decoration: underline; }
      h1, h2, h3 { font-weight: 700; letter-spacing: -0.01em; line-height: 1.15; margin: 0 0 0.5em; }
      h1 { font-size: clamp(2rem, 4vw, 3rem); }
      h2 { font-size: 1.5rem; }
      h3 { font-size: 1.15rem; }
      p { margin: 0 0 1em; }
      .site-header {
        background: var(--bg);
        border-bottom: 2px solid var(--border);
      }
      .site-header-inner {
        max-width: 1100px;
        margin: 0 auto;
        padding: 28px 24px 24px;
      }
      .site-header h1 { margin-bottom: 4px; }
      .site-header p { color: var(--muted); margin: 0; }
      main { max-width: 1100px; margin: 0 auto; padding: 32px 24px 80px; }
      .meta { color: var(--muted); font-size: 0.95rem; }
      .empty { color: var(--muted); font-style: italic; }
      section { margin-bottom: 48px; }
      section h2 {
        display: inline-block;
        margin-bottom: 20px;
        padding-bottom: 6px;
        border-bottom: 2px solid var(--border);
      }
      .grid {
        display: grid;
        gap: 20px;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      }
      article.event-card {
        background: var(--surface);
        border: 1px solid var(--border);
        padding: 22px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        transition: transform 0.1s ease, box-shadow 0.1s ease;
      }
      article.event-card:hover {
        transform: translate(-2px, -2px);
        box-shadow: 4px 4px 0 var(--border);
      }
      article.event-card h3 a { color: var(--ink); }
      article.event-card h3 a:hover { color: var(--accent); }
      .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: auto; padding-top: 8px; }
      .pill {
        display: inline-block;
        padding: 4px 12px;
        border: 1px solid var(--border);
        background: var(--pill-bg);
        color: var(--ink);
        font-size: 0.82rem;
        font-weight: 500;
        line-height: 1.4;
        border-radius: 999px;
        cursor: pointer;
        font-family: inherit;
      }
      .pill:hover {
        background: var(--baby-blue);
        text-decoration: none;
      }
      .pill.is-active {
        background: var(--pill-bg-active);
        color: var(--pill-ink-active);
        border-color: var(--pill-bg-active);
      }
      .pill.is-active:hover { background: var(--accent-strong); border-color: var(--accent-strong); }
      .filter-banner {
        display: none;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        background: var(--creme);
        border: 1px solid var(--border);
        padding: 14px 18px;
        margin-bottom: 28px;
      }
      .filter-banner.is-visible { display: flex; }
      .filter-banner-label { font-weight: 500; }
      .filter-banner-tag {
        font-weight: 700;
        background: var(--ink);
        color: #fff;
        padding: 2px 10px;
        border-radius: 999px;
        font-size: 0.85rem;
      }
      .filter-clear {
        margin-left: auto;
        background: transparent;
        border: 1px solid var(--border);
        padding: 6px 14px;
        cursor: pointer;
        font-family: inherit;
        font-weight: 500;
        border-radius: 999px;
      }
      .filter-clear:hover { background: var(--ink); color: #fff; }
      .status-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 999px;
        background: var(--baby-blue);
        border: 1px solid var(--border);
        font-size: 0.85rem;
        font-weight: 500;
        margin-bottom: 16px;
      }
      .back-link { display: inline-block; margin-bottom: 24px; font-weight: 500; }
      .signup {
        display: inline-block;
        margin: 8px 0 24px;
        padding: 12px 22px;
        background: var(--accent);
        color: #fff;
        font-weight: 600;
        border-radius: 999px;
      }
      .signup:hover { background: var(--accent-strong); text-decoration: none; }
      article.event-detail { background: var(--surface); border: 1px solid var(--border); padding: 28px; }
      .no-matches { display: none; }
      section.is-empty .no-matches { display: block; }
      section.is-empty .grid { display: none; }
`;

const FILTER_SCRIPT = `
    (function () {
      const root = document.documentElement;
      const banner = document.querySelector("[data-filter-banner]");
      const bannerTag = document.querySelector("[data-filter-tag]");
      const clearButton = document.querySelector("[data-filter-clear]");
      const sections = Array.from(document.querySelectorAll("[data-section]"));
      const cards = Array.from(document.querySelectorAll("[data-tags]"));
      const pills = Array.from(document.querySelectorAll(".pill[data-tag]"));

      function readTag() {
        const hash = window.location.hash || "";
        const match = hash.match(/^#tag=(.+)$/);
        return match ? decodeURIComponent(match[1]) : null;
      }

      function apply() {
        const tag = readTag();
        const normalized = tag ? tag.toLowerCase() : null;

        if (normalized) {
          banner.classList.add("is-visible");
          bannerTag.textContent = tag;
        } else {
          banner.classList.remove("is-visible");
        }

        for (const card of cards) {
          const tags = (card.getAttribute("data-tags") || "").split("|");
          const matches = !normalized || tags.some((value) => value === normalized);
          card.style.display = matches ? "" : "none";
        }

        for (const section of sections) {
          const cardsInSection = section.querySelectorAll("article.event-card");
          let visible = 0;
          for (const card of cardsInSection) {
            if (card.style.display !== "none") visible += 1;
          }
          section.classList.toggle("is-empty", cardsInSection.length > 0 && visible === 0);
        }

        for (const pill of pills) {
          pill.classList.toggle("is-active", normalized !== null && pill.getAttribute("data-tag").toLowerCase() === normalized);
        }
      }

      clearButton.addEventListener("click", function () {
        history.pushState("", document.title, window.location.pathname + window.location.search);
        apply();
      });

      window.addEventListener("hashchange", apply);
      apply();
    })();
`;

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
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>${SHARED_STYLES}</style>
  </head>
  <body>
    <header class="site-header">
      <div class="site-header-inner">
        <h1>Faglige arrangementer</h1>
        <p>Portal for kommende, historiske og avlyste arrangementer.</p>
      </div>
    </header>
    <main>
      <div class="filter-banner" data-filter-banner>
        <span class="filter-banner-label">Filtrert på tag:</span>
        <span class="filter-banner-tag" data-filter-tag></span>
        <button type="button" class="filter-clear" data-filter-clear>Fjern filter</button>
      </div>
      ${renderSection("Kommende", upcoming, "Ingen kommende arrangementer akkurat nå.")}
      ${renderSection("Tidligere arrangement", historical, "Ingen tidligere arrangementer ennå.")}
      ${renderSection("Avlyst", cancelled, "Ingen avlyste arrangementer.")}
    </main>
    <script>${FILTER_SCRIPT}</script>
  </body>
</html>`;
}

function renderSection(title, events, emptyMessage) {
  if (events.length === 0) {
    return `<section data-section><h2>${title}</h2><p class="empty">${escapeHtml(emptyMessage)}</p></section>`;
  }

  const cards = events
    .map(
      (event) => `<article class="event-card" data-tags="${escapeHtml(
        event.tags.map((tag) => tag.toLowerCase()).join("|")
      )}">
        <h3><a href="events/${event.slug}.html">${escapeHtml(event.title)}</a></h3>
        <p>${escapeHtml(event.short_description)}</p>
        <p class="meta">${escapeHtml(event.datetime)} · ${escapeHtml(event.community)} · ${escapeHtml(event.owner)}</p>
        <div class="tags">${event.tags
          .map(
            (tag) =>
              `<a class="pill" data-tag="${escapeHtml(tag)}" href="#tag=${encodeURIComponent(
                tag
              )}">${escapeHtml(tag)}</a>`
          )
          .join("")}</div>
      </article>`
    )
    .join("");

  return `<section data-section>
      <h2>${escapeHtml(title)}</h2>
      <div class="grid">${cards}</div>
      <p class="empty no-matches">Ingen arrangementer matcher dette filteret.</p>
    </section>`;
}

function renderEventPage(event) {
  return `<!doctype html>
<html lang="no">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(event.title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>${SHARED_STYLES}</style>
  </head>
  <body>
    <header class="site-header">
      <div class="site-header-inner">
        <h1>Faglige arrangementer</h1>
        <p>Portal for kommende, historiske og avlyste arrangementer.</p>
      </div>
    </header>
    <main>
      <a class="back-link" href="../index.html">← Tilbake til oversikten</a>
      <article class="event-detail">
        <span class="status-badge">${escapeHtml(event.status)}</span>
        <h1>${escapeHtml(event.title)}</h1>
        <p class="meta">${escapeHtml(event.datetime)} · ${escapeHtml(event.community)} · ${escapeHtml(event.owner)}</p>
        <p>${escapeHtml(event.short_description)}</p>
        <p><a class="signup" href="${escapeHtml(event.signup_url)}">Til påmelding</a></p>
        <div>${renderParagraphs(event.description)}</div>
        <div class="tags" style="margin-top: 24px;">${event.tags
          .map(
            (tag) =>
              `<a class="pill" href="../index.html#tag=${encodeURIComponent(tag)}">${escapeHtml(tag)}</a>`
          )
          .join("")}</div>
      </article>
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