// 定时刷新「年度报告」板块（cron 见 netlify.toml）
const { refreshSection } = require("../../functions/api/index");

exports.handler = async () => {
  try {
    const snapshot = await refreshSection("annual");
    console.log(`[scheduled] annual refreshed, last_run=${snapshot.last_run}`);
  } catch (error) {
    console.error(`[scheduled] annual refresh failed: ${error.message}`);
  }
  return { statusCode: 200 };
};
