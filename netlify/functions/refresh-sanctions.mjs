// 定时刷新「制裁案例追踪」板块（v2 scheduled function，cron 为 UTC）
import core from "../../functions/api/index.js";

const { refreshSection } = core;

export default async () => {
  try {
    const snapshot = await refreshSection("sanctions");
    console.log(`[scheduled] sanctions refreshed, last_run=${snapshot.last_run}`);
  } catch (error) {
    console.error(`[scheduled] sanctions refresh failed: ${error.message}`);
  }
  return new Response("ok");
};

export const config = { schedule: "30 1,13 * * *" };
