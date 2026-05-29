const assert = require("assert");
const { handleRequest } = require("../functions/api");
const { matchSourceKey } = require("../functions/api/src/sync-parser");

(async () => {
  assert.strictEqual(
    matchSourceKey("https://www.afdb.org/en/organisational-structure/secretariat-sanctions-appeals-board/summaries-sanctions-appeals-board-decisions"),
    "afdb_appeals",
  );
  assert.strictEqual(
    matchSourceKey("https://www.afdb.org/en/organisational-structure/sanctions-office/summaries-sanctions-decisions"),
    "afdb_sanctions",
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

  console.log("check passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
