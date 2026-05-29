const fs = require("fs/promises");
const path = require("path");

const LOCAL_DATA_PATH = path.resolve(__dirname, "../../../data/latest.json");
const BLOB_STORE = "mdb-tracker";
const BLOB_KEY = "snapshot";

// 不靠 process.env.NETLIFY 判断（函数运行时不一定有这个变量）。
// 直接拿 Blobs store：部署在 Netlify 上能拿到；本地 node 调试会抛错，
// 由调用方 try/catch 回退到本地文件。
function getBlobStore() {
  try {
    const { getStore } = require("@netlify/blobs");
    return getStore(BLOB_STORE);
  } catch {
    return null;
  }
}

// 打包到 Netlify 后磁盘上没有 data/latest.json；用静态 require 让 esbuild 把
// 种子 JSON 内联进函数包，首屏（Blobs 还没数据时）才有内容可显示。
function loadBundledSeed() {
  try {
    return require("../../../data/latest.json");
  } catch {
    return { results: {}, blocked: [], last_run: null };
  }
}

async function readLocalFile() {
  try {
    const raw = await fs.readFile(LOCAL_DATA_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function readSnapshot() {
  const store = getBlobStore();
  if (store) {
    try {
      const data = await store.get(BLOB_KEY, { type: "json" });
      if (data && data.results) return data;
      // Blobs 可用但还没写过数据 → 用种子（本地文件优先，其次打包内联）
      return (await readLocalFile()) || loadBundledSeed();
    } catch {
      // Blobs 实际不可用（多为本地 node 调试）→ 落到文件/种子
    }
  }
  return (await readLocalFile()) || loadBundledSeed();
}

async function saveSnapshot(snapshot) {
  const store = getBlobStore();
  if (store) {
    try {
      await store.setJSON(BLOB_KEY, snapshot);
      return;
    } catch {
      // Blobs 不可用 → 落到本地文件（仅本地开发能写）
    }
  }

  try {
    await fs.mkdir(path.dirname(LOCAL_DATA_PATH), { recursive: true });
    await fs.writeFile(LOCAL_DATA_PATH, JSON.stringify(snapshot, null, 2), "utf8");
  } catch (error) {
    // 云端只读文件系统写不了也不致命：本次结果已在响应里返回，下次仍可重抓。
    console.warn(`[storage] 本地持久化跳过: ${error.message}`);
  }
}

// 诊断用：报告 Blobs 在当前运行时是否真的可用（含具体报错），供 /health 调用。
async function blobsStatus() {
  try {
    const { getStore } = require("@netlify/blobs");
    const store = getStore(BLOB_STORE);
    await store.setJSON("__healthcheck__", { t: Date.now() });
    const back = await store.get("__healthcheck__", { type: "json" });
    return { available: Boolean(back), roundtrip: Boolean(back) };
  } catch (error) {
    return { available: false, error: `${error.name}: ${error.message}` };
  }
}

module.exports = { readSnapshot, saveSnapshot, blobsStatus };
