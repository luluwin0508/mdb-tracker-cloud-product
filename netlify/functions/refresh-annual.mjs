// 定时刷新「年度报告」板块（v2 scheduled function，cron 为 UTC）
import { getStore } from "@netlify/blobs";
import core from "../../functions/api/index.js";

core.setBlobStoreFactory(() => getStore("mdb-tracker"));

const { refreshSection } = core;

export default async () => {
  try {
    const snapshot = await refreshSection("annual");
    console.log(`[scheduled] annual refreshed, last_run=${snapshot.last_run}`);
  } catch (error) {
    console.error(`[scheduled] annual refresh failed: ${error.message}`);
  }
  return new Response("ok");
};

export const config = { schedule: "0 2 * * *" };
