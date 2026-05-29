const SOURCES = [
  {
    key: "wb_news",
    bank: "WB",
    name: "News",
    method: "json",
    url: "https://search.worldbank.org/api/v2/news?format=json&rows=80",
  },
  {
    key: "wb_annual",
    bank: "WB",
    name: "Annual Reports",
    method: "html",
    url: "https://www.worldbank.org/en/about/unit/integrity-vice-presidency/annual-reports",
    selectorHint: "lp__list_navigation_section",
    base: "https://www.worldbank.org",
  },
  {
    key: "wb_sdo",
    bank: "WB",
    name: "SDO Determinations",
    method: "jina",
    url: "https://www.worldbank.org/en/about/unit/sanctions-system/osd/determinations",
    urlFilter: /dam\/documents\/sanctions/i,
  },
  {
    key: "wb_board",
    bank: "WB",
    name: "Sanctions Board Decisions",
    method: "jina",
    url: "https://www.worldbank.org/en/about/unit/sanctions-system/sanctions-board/decisions",
    urlFilter: /dam\/documents\/sanctions/i,
  },
  {
    key: "adb_news",
    bank: "ADB",
    name: "News",
    method: "rss",
    url: "https://feeds.feedburner.com/adb_news",
  },
  {
    key: "adb_cases",
    bank: "ADB",
    name: "Case Summaries",
    method: "jina",
    url: "https://www.adb.org/who-we-are/integrity/case-summaries",
  },
  {
    key: "adb_annual",
    bank: "ADB",
    name: "Annual Reports",
    method: "jina",
    url: "https://www.adb.org/documents/series/office-anticorruption-and-integrity-annual-report",
  },
  {
    key: "afdb_sanctions",
    bank: "AFDB",
    name: "Sanctions Decisions",
    method: "jina",
    url: "https://www.afdb.org/en/organisational-structure/sanctions-office/summaries-sanctions-decisions",
  },
  {
    key: "afdb_appeals",
    bank: "AFDB",
    name: "Appeals Board Decisions",
    method: "jina",
    url: "https://www.afdb.org/en/topics-and-sectors/topics/sanctions-system/second-tier-the-secretariat-of-the-sanctions-appeals-board/summaries-of-the-sanctions-appeals-board-decisions",
  },
  {
    key: "afdb_news",
    bank: "AFDB",
    name: "News",
    method: "rss",
    url: "https://news.google.com/rss/search?q=%22African+Development+Bank%22+integrity&hl=en-US&gl=US&ceid=US:en",
  },
  {
    key: "afdb_annual",
    bank: "AFDB",
    name: "Annual Reports",
    method: "jina",
    url: "https://www.afdb.org/en/documents-publications/annual-report",
    includeTitle: /\b(annual report|financial report)\b/i,
    excludeTitle: /^(English|Board Documents|Departmental Annual Reports|Evaluation reports|Integrity & Anti-Corruption Reports|Africa's Macroeconomic Performance and Outlook)$/i,
  },
  {
    key: "aiib_news",
    bank: "AIIB",
    name: "News",
    method: "html",
    url: "https://www.aiib.org/en/news-events/media-center/news/{year}.html",
    base: "https://www.aiib.org",
    yearPlaceholder: true,
  },
  {
    key: "aiib_annual",
    bank: "AIIB",
    name: "Annual Reports",
    method: "jina",
    url: "https://www.aiib.org/en/about-aiib/who-we-are/complaints-resolution-evaluation-integrity-unit/news-publications/index.html",
  },
];

const DISPLAY_SECTIONS = [
  {
    id: "sanctions",
    title: "制裁案例追踪",
    newsFilter: false,
    sources: ["wb_sdo", "wb_board", "adb_cases", "afdb_sanctions", "afdb_appeals"],
  },
  {
    id: "news",
    title: "新闻动态",
    newsFilter: true,
    sources: ["wb_news", "adb_news", "afdb_news", "aiib_news"],
  },
  {
    id: "annual",
    title: "年度报告",
    newsFilter: false,
    sources: ["wb_annual", "adb_annual", "afdb_annual", "aiib_annual"],
  },
];

const BANK_LOGOS = {
  WB: "/logos/wb.svg",
  ADB: "/logos/adb.svg",
  AFDB: "/logos/afdb.svg",
  AIIB: "/logos/aiib.svg",
};

module.exports = { SOURCES, DISPLAY_SECTIONS, BANK_LOGOS };
