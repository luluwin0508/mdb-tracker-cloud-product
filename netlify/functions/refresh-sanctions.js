// 定时刷新「制裁案例追踪」板块（jina 慢源，cron 见 netlify.toml）
const { refreshSection } = require("../../functions/api/index");

exports.handler = async () => {
  try {
    const snapshot = await refreshSection("sanctions");
    console.log(`[scheduled] sanctions refreshed, last_run=${snapshot.last_run}`);
  } catch (error) {
    console.error(`[scheduled] sanctions refresh failed: ${error.message}`);
  }
  return { statusCode: 200 };
};
