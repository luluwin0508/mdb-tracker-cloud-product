const fs = require("fs/promises");
const path = require("path");

const LOCAL_DATA_PATH = path.resolve(__dirname, "../../../data/latest.json");
const COLLECTION = "mdb_tracker_snapshots";
const DOC_ID = "latest";
const BLOB_STORE = "mdb-tracker";
const BLOB_KEY = "snapshot";

let cachedDb = null;

function isCloudRuntime() {
  return Boolean(process.env.TCB_ENV || process.env.SCF_NAMESPACE || process.env.TENCENTCLOUD_RUNENV);
}

// Netlify Blobs：部署在 Netlify Functions 时自动可用，无需配置数据库。
function getBlobStore() {
  if (!process.env.NETLIFY) return null;
  try {
    const { getStore } = require("@netlify/blobs");
    return getStore(BLOB_STORE);
  } catch {
    return null;
  }
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

// 打包到 Netlify 后，磁盘上没有 data/latest.json；用静态 require 让
// esbuild 把种子数据内联进函数包，首屏（Blobs 还没数据时）才有内容可显示。
function loadBundledSeed() {
  return require("../../../data/latest.json");
}

async function readSnapshot() {
  const store = getBlobStore();
  if (store) {
    try {
      const data = await store.get(BLOB_KEY, { type: "json" });
      if (data && data.results) return data;
    } catch {
      // Blobs 还没写过或读取失败，落到下面的种子数据。
    }
  }

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

  try {
    const raw = await fs.readFile(LOCAL_DATA_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    try {
      return loadBundledSeed();
    } catch {
      return { results: {}, blocked: [], last_run: null };
    }
  }
}

async function saveSnapshot(snapshot) {
  const store = getBlobStore();
  if (store) {
    await store.setJSON(BLOB_KEY, snapshot);
    return;
  }

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
