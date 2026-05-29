const assert = require("assert");
const { handleRequest } = require("../functions/api");
const { matchSourceKey } = require("../functions/api/src/sync-parser");
const { markSourceVisits, mergeNewItems } = require("../functions/api/src/snapshot");

(async () => {
  assert.strictEqual(
    matchSourceKey("https://www.afdb.org/en/organisational-structure/secretariat-sanctions-appeals-board/summaries-sanctions-appeals-board-decisions"),
    "afdb_appeals",
  );
  assert.strictEqual(
    matchSourceKey("https://www.afdb.org/en/organisational-structure/sanctions-office/summaries-sanctions-decisions"),
    "afdb_sanctions",
  );
  assert.deepStrictEqual(
    markSourceVisits({ wb_news: "2026-05-30 09:00" }, ["afdb_appeals"], "2026-05-30 10:00"),
    { wb_news: "2026-05-30 09:00", afdb_appeals: "2026-05-30 10:00" },
  );
  assert.deepStrictEqual(
    mergeNewItems(
      [{ title: "Manual note", link: "https://example.com/a#old" }],
      [{ title: "Fetched duplicate", link: "https://example.com/a#new" }],
    ),
    { items: [{ title: "Manual note", link: "https://example.com/a#old" }], added: 0 },
  );

  const health = await handleRequest("GET", "/api/health");
  assert.strictEqual(health.statusCode, 200);

  const latest = await handleRequest("GET", "/api/latest");
  assert.strictEqual(latest.statusCode, 200);
  const payload = JSON.parse(latest.body);
  assert.strictEqual(payload.ok, true);
  assert.ok(Array.isArray(payload.sections));
  assert.ok(payload.sections.length >= 3);
  assert.ok(payload.sections.some((section) => section.rows.some((row) => row.logo)));
  assert.ok(payload.sections.some((section) => section.rows.some((row) => Object.hasOwn(row, "last_visited"))));

  const unknownSource = await handleRequest("POST", "/api/refresh-source/not_a_source");
  assert.strictEqual(unknownSource.statusCode, 404);

  console.log("check passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
