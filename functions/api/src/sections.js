const { BANK_LOGOS, DISPLAY_SECTIONS, SOURCES } = require("./sources");
const { filterItemsForSource } = require("./scraper");

const MAX_FUTURE = "2028-12-31";
const TOPIC_RE = /sanction|debar|integrity|corrupt|fraud|collus|coerc|obstruct|case|decision|determination|appeal|board|annual|report/i;
const SOURCE_BY_KEY = Object.fromEntries(SOURCES.map((source) => [source.key, source]));

function comparableDate(item) {
  const date = item && item.date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
    return date <= MAX_FUTURE ? date : "";
  }
  const labelYear = String((item && item.date_label) || "").match(/20\d{2}/);
  if (labelYear) {
    const candidate = `${labelYear[0]}-12-31`;
    return candidate <= MAX_FUTURE ? candidate : "";
  }
  const titleYear = String((item && item.title) || "").match(/20\d{2}/);
  if (titleYear) {
    const candidate = `${titleYear[0]}-12-31`;
    return candidate <= MAX_FUTURE ? candidate : "";
  }
  return "";
}

function latestItem(items, newsFilter) {
  if (!items || !items.length) return null;
  const relevant = items.filter((item) => TOPIC_RE.test(`${item.title || ""} ${item.link || ""}`));
  const pool = relevant.length ? relevant : items;
  if (newsFilter && !relevant.length) return null;
  return pool.reduce((best, item) => comparableDate(item) > comparableDate(best) ? item : best, pool[0]);
}

function buildSections(snapshot) {
  const results = (snapshot && snapshot.results) || {};
  const blocked = new Set((snapshot && snapshot.blocked) || []);
  const sourceVisits = (snapshot && snapshot.source_visits) || {};
  return DISPLAY_SECTIONS.map((section) => ({
    id: section.id,
    title: section.title,
    rows: section.sources.map((key) => {
      const source = SOURCE_BY_KEY[key];
      const items = filterItemsForSource(results[key] || [], source);
      const latest = latestItem(items, section.newsFilter);
      return {
        key,
        bank: source.bank,
        logo: BANK_LOGOS[source.bank] || "",
        name: source.name,
        url: source.url.replace("{year}", new Date().getFullYear()),
        failed: blocked.has(key),
        last_visited: sourceVisits[key] || "",
        latest_date: latest ? (latest.date || latest.date_label || "") : "",
        latest_item: latest,
      };
    }),
  }));
}

module.exports = { buildSections };
