// 定时刷新「新闻动态」板块（快源，cron 见 netlify.toml）
const { refreshSection } = require("../../functions/api/index");

exports.handler = async () => {
  try {
    const snapshot = await refreshSection("news");
    console.log(`[scheduled] news refreshed, last_run=${snapshot.last_run}`);
  } catch (error) {
    console.error(`[scheduled] news refresh failed: ${error.message}`);
  }
  return { statusCode: 200 };
};
