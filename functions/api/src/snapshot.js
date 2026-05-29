function itemSignature(item) {
  const link = normalizeLink(item && item.link);
  if (link) return `link:${link}`;
  const title = String((item && item.title) || "").trim().toLowerCase();
  const date = String((item && (item.date || item.date_label)) || "").trim().toLowerCase();
  return title ? `title:${title}|${date}` : "";
}

function normalizeLink(link) {
  const raw = String(link || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$)/i.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return raw.replace(/#.*$/, "");
  }
}

function mergeNewItems(existingItems, incomingItems) {
  const existing = Array.isArray(existingItems) ? existingItems : [];
  const incoming = Array.isArray(incomingItems) ? incomingItems : [];
  if (!incoming.length) return { items: existing, added: 0 };

  const seen = new Set(existing.map(itemSignature).filter(Boolean));
  const additions = [];
  for (const item of incoming) {
    const signature = itemSignature(item);
    if (!signature || seen.has(signature)) continue;
    seen.add(signature);
    additions.push(item);
  }

  if (!additions.length) return { items: existing, added: 0 };
  return { items: [...additions, ...existing], added: additions.length };
}

function mergeResultSet(previousResults, incomingResults) {
  const results = { ...(previousResults || {}) };
  const addedByKey = {};
  for (const [key, items] of Object.entries(incomingResults || {})) {
    const merged = mergeNewItems(results[key] || [], items || []);
    if (merged.added) {
      results[key] = merged.items;
      addedByKey[key] = merged.added;
    }
  }
  return { results, addedByKey };
}

function markSourceVisits(previousVisits, keys, visitedAt) {
  const visits = { ...(previousVisits || {}) };
  for (const key of keys || []) {
    if (key) visits[key] = visitedAt;
  }
  return visits;
}

module.exports = {
  itemSignature,
  markSourceVisits,
  mergeNewItems,
  mergeResultSet,
};
