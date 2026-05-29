const { scrapeAll } = require("./src/scraper");
const { buildSections } = require("./src/sections");
const { readSnapshot, saveSnapshot } = require("./src/storage");
const { matchSourceKey, parseSyncedHtml } = require("./src/sync-parser");

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
    return json(200, { ok: true, service: "mdb-tracker-api" });
  }

  if (method === "GET" && path === "/latest") {
    const snapshot = await readSnapshot();
    return json(200, { ok: true, snapshot, sections: buildSections(snapshot) });
  }

  if (method === "POST" && path === "/refresh") {
    const previous = await readSnapshot().catch(() => ({ results: {}, blocked: [] }));
    const scraped = await scrapeAll();
    const merged = {
      ...scraped,
      results: { ...(previous.results || {}) },
      blocked: scraped.blocked,
    };
    for (const [key, items] of Object.entries(scraped.results || {})) {
      if (items && items.length) merged.results[key] = items;
    }
    await saveSnapshot(merged);
    return json(200, { ok: true, snapshot: merged, sections: buildSections(merged) });
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
