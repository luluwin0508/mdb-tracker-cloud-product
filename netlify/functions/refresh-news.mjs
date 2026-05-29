// 定时刷新「新闻动态」板块（v2 scheduled function，cron 为 UTC）
import core from "../../functions/api/index.js";

const { refreshSection } = core;

export default async () => {
  try {
    const snapshot = await refreshSection("news");
    console.log(`[scheduled] news refreshed, last_run=${snapshot.last_run}`);
  } catch (error) {
    console.error(`[scheduled] news refresh failed: ${error.message}`);
  }
  return new Response("ok");
};

export const config = { schedule: "0 */3 * * *" };
