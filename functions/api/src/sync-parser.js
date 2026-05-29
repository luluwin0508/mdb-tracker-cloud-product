const { SOURCES } = require("./sources");
const { absoluteUrl, cleanTitle, extractAnchors, filterItemsForSource, parseDate } = require("./scraper");

const SOURCE_BY_KEY = Object.fromEntries(SOURCES.map((source) => [source.key, source]));

function matchSourceKey(url) {
  let visited;
  try {
    visited = new URL(url);
  } catch {
    return "";
  }

  for (const source of SOURCES) {
    const sourceUrl = source.url.replace("{year}", "");
    let parsed;
    try {
      parsed = new URL(sourceUrl);
    } catch {
      continue;
    }
    const sourcePath = parsed.pathname.replace(/\/$/, "");
    if (visited.hostname === parsed.hostname && visited.pathname.startsWith(sourcePath)) {
      return source.key;
    }
  }
  return "";
}

function parseSyncedHtml(key, html, url) {
  const source = SOURCE_BY_KEY[key];
  if (!source) return [];

  if (key === "afdb_annual") {
    return filterItemsForSource(parseAfdbAnnual(html, url), source);
  }

  const items = extractAnchors(html, source.base || url);
  return filterItemsForSource(items, source);
}

function parseAfdbAnnual(html, url) {
  const results = [];
  const seen = new Set();
  const anchorRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorRe.exec(html || ""))) {
    const href = match[1];
    const title = cleanTitle(match[2]);
    const link = absoluteUrl(href, url);
    const haystack = `${title} ${link}`;
    if (!/\b(annual report|financial report)\b/i.test(haystack)) continue;

    const context = stripTags(String(html).slice(Math.max(0, match.index - 900), anchorRe.lastIndex + 900));
    const parsed = parseDate(`${title} ${context}`);
    const sig = link || title;
    if (!title || seen.has(sig)) continue;
    seen.add(sig);
    results.push({
      title,
      link,
      date: parsed.date,
      date_label: parsed.date_label,
    });
  }
  return results;
}

function stripTags(text) {
  return String(text || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = { matchSourceKey, parseSyncedHtml };
