// Netlify Functions 入口：薄薄一层包住框架无关的 handleRequest。
// 路由：GET /api/latest、POST /api/refresh[/:section]、POST /api/sync、GET /api/health
const { handleRequest } = require("../../functions/api/index");

exports.handler = async (event) => {
  const method = event.httpMethod || "GET";
  // 把 Netlify 的函数前缀还原成 /api/...，交给 handleRequest 内部再剥离
  const path = (event.path || "/").replace(/^\/\.netlify\/functions\/api/, "/api");
  const body = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf8")
    : (event.body || "");

  try {
    return await handleRequest(method, path, body);
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ ok: false, error: error.message || String(error) }),
    };
  }
};
