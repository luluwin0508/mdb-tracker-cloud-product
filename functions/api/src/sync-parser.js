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
    // Match canonical URLs and source-specific alternate navigation paths.
    const candidates = [source.url, ...(source.altUrls || [])];
    for (const candidate of candidates) {
      const cleaned = candidate.replace("{year}", "");
      let parsed;
      try {
        parsed = new URL(cleaned);
      } catch {
        continue;
      }
      const sourcePath = parsed.pathname.replace(/\/$/, "");
      if (visited.hostname === parsed.hostname && visited.pathname.startsWith(sourcePath)) {
        return source.key;
      }
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

  if (key === "adb_cases") {
    const rows = parseAdbCases(html, url);
    if (rows.length) return filterItemsForSource(rows, source);
    // 表格找不到再退回通用解析（保底）
  }

  const items = extractAnchors(html, source.base || url);
  return filterItemsForSource(items, source);
}

// ADB case-summaries 的 HTML 表格解析（与 scraper.js 里 jina markdown 版本同构）。
// 按表头位置取 Date of Sanction / Case Number / Entity Type，避免拿到导航锚。
function parseAdbCases(html, sourceUrl) {
  const results = [];
  const seen = new Set();
  const tableRe = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let tm;
  while ((tm = tableRe.exec(html))) {
    const tableHtml = tm[1];
    if (!/Case\s*Number/i.test(tableHtml)) continue;

    const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    const cellRe = /<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi;
    let cols = null;
    let rm;
    while ((rm = rowRe.exec(tableHtml))) {
      const cells = [...rm[1].matchAll(cellRe)].map((m) => stripTags(m[1]));
      if (!cells.length) continue;

      if (!cols) {
        const lower = cells.map((c) => c.toLowerCase());
        const date = lower.findIndex((c) => c.includes("date"));
        const caseNum = lower.findIndex((c) => c.includes("case number"));
        const entity = lower.findIndex((c) => c.includes("entity"));
        if (date >= 0 && caseNum >= 0) cols = { date, caseNum, entity };
        continue;
      }

      const dateLabel = cells[cols.date] || "";
      const caseNumber = cells[cols.caseNum] || "";
      const entity = cols.entity >= 0 ? cells[cols.entity] || "" : "";
      if (!caseNumber) continue;

      const sig = `${caseNumber}|${entity}`;
      if (seen.has(sig)) continue;
      seen.add(sig);

      const parsed = parseDate(dateLabel);
      results.push({
        title: `Case ${caseNumber}` + (entity ? ` (${entity})` : ""),
        link: sourceUrl,
        date: parsed.date,
        date_label: parsed.date_label || dateLabel,
      });
    }
  }
  return results;
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
