// Netlify Functions v2 入口（ESM）。用 v2 是为了让 Netlify Blobs 在运行时
// 自动配置（经典 exports.handler 函数拿不到 Blobs context）。
// 复用框架无关的 handleRequest（CJS，default import 取其 module.exports）。
import { getStore } from "@netlify/blobs";
import core from "../../functions/api/index.js";

// 用 ESM import 注入 Blobs（v2 运行时提供），避免 CJS require 失败
core.setBlobStoreFactory(() => getStore({ name: "mdb-tracker", consistency: "strong" }));

const { handleRequest } = core;

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/\.netlify\/functions\/api/, "/api");
  const body = req.method === "GET" || req.method === "HEAD" ? "" : await req.text();

  const result = await handleRequest(req.method, path, body);

  // 204/304 不能带 body，否则 new Response 会抛错（影响 CORS 预检 OPTIONS）
  const noBody = result.statusCode === 204 || result.statusCode === 304;
  return new Response(noBody ? null : result.body, {
    status: result.statusCode,
    headers: result.headers,
  });
};

export const config = { path: "/api/*" };
