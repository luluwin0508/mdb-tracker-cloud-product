const fs = require("fs/promises");
const path = require("path");

const LOCAL_DATA_PATH = path.resolve(__dirname, "../../../data/latest.json");
const COLLECTION = "mdb_tracker_snapshots";
const DOC_ID = "latest";

let cachedDb = null;

function isCloudRuntime() {
  return Boolean(process.env.TCB_ENV || process.env.SCF_NAMESPACE || process.env.TENCENTCLOUD_RUNENV);
}

function getCloudDb() {
  if (!isCloudRuntime()) return null;
  if (cachedDb) return cachedDb;
  try {
    const cloudbase = require("@cloudbase/node-sdk");
    const app = cloudbase.init({ env: process.env.TCB_ENV || cloudbase.SYMBOL_CURRENT_ENV });
    cachedDb = app.database();
    return cachedDb;
  } catch {
    return null;
  }
}

async function readSnapshot() {
  const db = getCloudDb();
  if (db) {
    try {
      const result = await db.collection(COLLECTION).doc(DOC_ID).get();
      const data = Array.isArray(result.data) ? result.data[0] : result.data;
      if (data && data.snapshot) return data.snapshot;
    } catch {
      // Fall back to bundled seed data below.
    }
  }
  const raw = await fs.readFile(LOCAL_DATA_PATH, "utf8");
  return JSON.parse(raw);
}

async function saveSnapshot(snapshot) {
  const db = getCloudDb();
  if (db) {
    const payload = { snapshot, updated_at: new Date() };
    try {
      await db.collection(COLLECTION).doc(DOC_ID).set(payload);
    } catch {
      await db.collection(COLLECTION).add({ _id: DOC_ID, ...payload });
    }
    return;
  }
  await fs.mkdir(path.dirname(LOCAL_DATA_PATH), { recursive: true });
  await fs.writeFile(LOCAL_DATA_PATH, JSON.stringify(snapshot, null, 2), "utf8");
}

module.exports = { readSnapshot, saveSnapshot };
