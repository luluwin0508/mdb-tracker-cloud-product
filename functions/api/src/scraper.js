const http = require("http");
const https = require("https");
const { URL } = require("url");
const { SOURCES, DISPLAY_SECTIONS } = require("./sources");

// Netlify 免费版函数同步执行上限约 10s，所以云端每个源给更短的超时，
// 保证分板块刷新能在限额内返回（拿到部分结果也比整体被杀好）。本地放宽。
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS) || (process.env.NETLIFY ? 8500 : 45000);

const DATE_RE = /(\d{1,2}-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-20\d{2})|(\d{1,2}-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2})\b|(\d{4}-\d{2}-\d{2})|((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+20\d{2})|(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+20\d{2})|(FY\s?20\d{2})/i;
const TOPIC_RE = /sanction|debar|integrity|corrupt|fraud|collus|coerc|obstruct|case|decision|determination|appeal|board|annual|report/i;
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };

function requestText(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const req = client.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
        "Cache-Control": "no-cache",
        ...headers,
      },
      timeout: REQUEST_TIMEOUT_MS,
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          resolve(requestText(new URL(res.headers.location, url).toString(), headers));
          return;
        }
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        resolve(body);
      });
    });
    req.on("timeout", () => req.destroy(new Error(`timeout for ${url}`)));
    req.on("error", reject);
  });
}

function decodeHtml(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(text) {
  return decodeHtml(String(text || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim());
}

function cleanTitle(text) {
  let title = stripTags(text)
    .replace(/https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp|svg)\S+/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[ ,|:;-]+|[ ,|:;-]+$/g, "");
  if (title.length > 220) {
    title = title.slice(0, 220).replace(/\s+\S+$/, "").trim();
  }
  return title;
}

function absoluteUrl(href, base) {
  try {
    return new URL(href || "", base).toString();
  } catch {
    return href || "";
  }
}

function parseDateLabel(label) {
  const raw = String(label || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^FY\s?20\d{2}$/i.test(raw)) return "";

  let match = raw.match(/^(\d{1,2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)-(\d{2,4})$/i);
  if (match) {
    const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
    return toIso(year, MONTHS[match[2].toLowerCase()], Number(match[1]));
  }

  match = raw.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2})$/i);
  if (match) return toIso(Number(match[3]), MONTHS[match[1].toLowerCase()], Number(match[2]));

  match = raw.match(/^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+(20\d{2})$/i);
  if (match) return toIso(Number(match[3]), MONTHS[match[2].toLowerCase()], Number(match[1]));

  return "";
}

function toIso(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return "";
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDate(text) {
  const match = String(text || "").match(DATE_RE);
  if (!match) return { date: "", date_label: "" };
  const dateLabel = match[0];
  return { date: parseDateLabel(dateLabel), date_label: dateLabel };
}

function pushUnique(results, seen, item) {
  const sig = item.link || item.title;
  if (!item.title || seen.has(sig)) return;
  seen.add(sig);
  results.push(item);
}

function extractAnchors(html, baseUrl) {
  const results = [];
  const seen = new Set();
  const anchorRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorRe.exec(html || ""))) {
    const href = match[1];
    if (/\.(jpg|jpeg|png|gif|webp|svg|css|js)(\?|$)/i.test(href)) continue;
    const title = cleanTitle(match[2]);
    if (title.length < 4) continue;
    const context = stripTags(String(html).slice(Math.max(0, match.index - 500), anchorRe.lastIndex + 500));
    const parsed = parseDate(`${title} ${context}`);
    if (!parsed.date_label && !TOPIC_RE.test(`${title} ${href}`)) continue;
    pushUnique(results, seen, {
      title,
      link: absoluteUrl(href, baseUrl),
      date: parsed.date,
      date_label: parsed.date_label,
    });
  }
  return results;
}

async function fetchRss(url) {
  const xml = await requestText(url);
  const items = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)];
  return items.map((item) => {
    const body = item[0];
    const title = cleanTitle((body.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i) || body.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "");
    const link = stripTags((body.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] || "");
    const pub = stripTags((body.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || body.match(/<updated>([\s\S]*?)<\/updated>/i) || [])[1] || "");
    const parsedDate = pub ? new Date(pub) : null;
    const date = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString().slice(0, 10) : "";
    return { title: title.replace(/\s+-\s+[^-]+$/, ""), link, date, date_label: date };
  }).filter((item) => item.title);
}

async function fetchWorldBankJson(url) {
  const data = JSON.parse(await requestText(url));
  return Object.entries(data.documents || {})
    .filter(([key, value]) => key !== "facets" && value && typeof value === "object")
    .map(([, doc]) => {
      const rawTitle = doc.title;
      const title = cleanTitle(typeof rawTitle === "object" ? rawTitle["cdata!"] : rawTitle);
      const rawDate = String(doc.lnchdt || doc.pub_date || doc.dt || "");
      const date = /^\d{13}$/.test(rawDate) ? new Date(Number(rawDate)).toISOString().slice(0, 10) : rawDate.slice(0, 10);
      return { title, link: doc.url || "", date, date_label: date };
    });
}

async function fetchHtml(url, source) {
  const html = await requestText(url);
  return extractAnchors(html, source.base || url);
}

// ADB case-summaries 是结构化表格（Date of Sanction | Case | Case Number | Entity Type | Period）。
// jina 把它渲染成 markdown pipe-table；按表头位置取列，避免被通用 markdown link 解析器
// 当成普通锚（早先会拿到 "activities" 这种导航词）。
function parseAdbCasesMarkdown(text, sourceUrl) {
  const results = [];
  const seen = new Set();
  let cols = null;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith("|") || !line.endsWith("|")) {
      cols = null;
      continue;
    }
    const cells = line.slice(1, -1).split("|").map((c) => c.trim());
    if (cells.every((c) => /^[-:\s]*$/.test(c))) continue; // 分隔行

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

    // 同一 case 可能有 Firm/Individual 两行，按 entity 区分保留
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
  return results;
}

async function fetchJina(url, source) {
  const text = await requestText(`https://r.jina.ai/${url}`, {
    Accept: "text/markdown",
    "X-No-Cache": "true",
  });
  if (/Enable JavaScript and cookies|Just a moment/i.test(text)) return [];

  if (source.key === "adb_cases") {
    const rows = parseAdbCasesMarkdown(text, url);
    if (rows.length) return rows;
    // 表格找不到（页面结构变了？）就退回通用解析
  }

  const results = [];
  const seen = new Set();
  const linkRe = /\[([^\]]{4,220})\]\((https?:\/\/[^)]+)\)/g;
  let match;
  while ((match = linkRe.exec(text))) {
    const title = cleanTitle(match[1]);
    const link = match[2];
    if (!title || /\.(jpg|jpeg|png|gif|webp|svg|css|js)(\?|$)/i.test(link)) continue;
    if (source.urlFilter && !source.urlFilter.test(link)) continue;
    const context = text.slice(Math.max(0, match.index - 500), linkRe.lastIndex + 500);
    const parsed = parseDate(`${title} ${context}`);
    if (!parsed.date_label && !TOPIC_RE.test(`${title} ${link}`)) continue;
    pushUnique(results, seen, { title, link, date: parsed.date, date_label: parsed.date_label });
  }
  return results;
}

function filterItemsForSource(items, source) {
  return items.filter((item) => {
    const haystack = `${item.title || ""} ${item.link || ""}`;
    if (source.includeTitle && !source.includeTitle.test(haystack)) return false;
    if (source.excludeTitle && source.excludeTitle.test(item.title || "")) return false;
    return true;
  });
}

async function fetchSource(source, year) {
  const url = source.yearPlaceholder ? source.url.replace("{year}", year) : source.url;
  let items = [];
  if (source.method === "rss") items = await fetchRss(url);
  if (source.method === "json") items = await fetchWorldBankJson(url);
  if (source.method === "html") items = await fetchHtml(url, source);
  if (source.method === "jina") items = await fetchJina(url, source);
  return filterItemsForSource(items, source);
}

function sourcesForSection(sectionId) {
  if (!sectionId) return SOURCES;
  const section = DISPLAY_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return [];
  const keys = new Set(section.sources);
  return SOURCES.filter((source) => keys.has(source.key));
}

async function scrapeAll(sectionId) {
  const sources = sourcesForSection(sectionId);
  const year = new Date().getFullYear().toString();
  const pairs = await Promise.all(sources.map(async (source) => {
    try {
      const items = await fetchSource(source, year);
      return [source.key, items, !items.length];
    } catch (error) {
      return [source.key, [], true, error.message];
    }
  }));
  const results = {};
  const blocked = [];
  for (const [key, items, failed] of pairs) {
    results[key] = items;
    if (failed) blocked.push(key);
  }
  return {
    results,
    blocked,
    last_run: formatShanghaiTime(new Date()),
  };
}

function formatShanghaiTime(date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date).replace(" ", " ");
}

module.exports = {
  scrapeAll,
  filterItemsForSource,
  parseDate,
  parseDateLabel,
  extractAnchors,
  absoluteUrl,
  cleanTitle,
  parseAdbCasesMarkdown,
};
