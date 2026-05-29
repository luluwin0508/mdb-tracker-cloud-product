const { scrapeAll } = require("./src/scraper");
const { buildSections } = require("./src/sections");
const { readSnapshot, saveSnapshot, blobsStatus } = require("./src/storage");
const { matchSourceKey, parseSyncedHtml } = require("./src/sync-parser");
const { DISPLAY_SECTIONS } = require("./src/sources");

const SECTION_IDS = new Set(DISPLAY_SECTIONS.map((section) => section.id));

// 抓取一个板块（不传 sectionId 则全量），把结果并回既有快照后保存。
// 关键：blocked 只对本次"尝试过"的源做替换，其它板块的失败标记保持不变；
// 抓到空结果时保留上次数据（页面显示"上次保存结果"而非清空）。
async function refreshSection(sectionId) {
  const previous = await readSnapshot().catch(() => ({ results: {}, blocked: [], last_run: null }));
  const scraped = await scrapeAll(sectionId);
  const attempted = new Set(Object.keys(scraped.results || {}));

  const results = { ...(previous.results || {}) };
  for (const [key, items] of Object.entries(scraped.results || {})) {
    if (items && items.length) results[key] = items;
  }

  const blocked = [
    ...(previous.blocked || []).filter((key) => !attempted.has(key)),
    ...(scraped.blocked || []),
  ];

  const snapshot = {
    results,
    blocked: [...new Set(blocked)],
    last_run: scraped.last_run,
  };
  await saveSnapshot(snapshot);
  return snapshot;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
    },
    body: JSON.stringify(body),
  };
}

async function handleRequest(method, rawPath, body = "") {
  const path = String(rawPath || "/").replace(/^\/api/, "") || "/";
  if (method === "OPTIONS") return json(204, {});

  if (method === "GET" && path === "/health") {
    return json(200, { ok: true, service: "mdb-tracker-api", blobs: await blobsStatus() });
  }

  if (method === "GET" && path === "/latest") {
    const snapshot = await readSnapshot();
    return json(200, { ok: true, snapshot, sections: buildSections(snapshot) });
  }

  const refreshMatch = path.match(/^\/refresh(?:\/([\w-]+))?$/);
  if (method === "POST" && refreshMatch) {
    const sectionId = refreshMatch[1] || "";
    if (sectionId && !SECTION_IDS.has(sectionId)) {
      return json(404, { ok: false, error: `unknown section: ${sectionId}` });
    }
    const snapshot = await refreshSection(sectionId);
    return json(200, { ok: true, section: sectionId || "all", snapshot, sections: buildSections(snapshot) });
  }

  if (method === "POST" && path === "/sync") {
    const payload = body ? JSON.parse(body) : {};
    const url = payload.url || "";
    const html = payload.html || "";
    const key = matchSourceKey(url);
    if (!key) return json(200, { ok: false, error: `unknown source: ${url}` });

    const items = parseSyncedHtml(key, html, url);
    if (!items.length) return json(200, { ok: false, key, count: 0, error: "no items parsed" });

    const previous = await readSnapshot().catch(() => ({ results: {}, blocked: [] }));
    const snapshot = {
      ...previous,
      results: { ...(previous.results || {}), [key]: items },
      blocked: ((previous.blocked || []).filter((blockedKey) => blockedKey !== key)),
      last_run: formatShanghaiTime(new Date()),
    };
    await saveSnapshot(snapshot);
    return json(200, { ok: true, key, count: items.length, snapshot, sections: buildSections(snapshot) });
  }

  return json(404, { ok: false, error: `No route for ${method} ${rawPath}` });
}

exports.handleRequest = handleRequest;
exports.refreshSection = refreshSection;

exports.main = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method || "GET";
  const path = event.path || event.requestContext?.http?.path || "/";
  const body = event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : (event.body || "");
  try {
    return await handleRequest(method, path, body);
  } catch (error) {
    return json(500, { ok: false, error: error.message || String(error) });
  }
};

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
