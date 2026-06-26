import { handleAuthPayload } from "./auth-core.js";

function setCommonHeaders(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, status, payload) {
  setCommonHeaders(res);
  res.status(status).json(payload);
}

async function readBody(req) {
  if (typeof req.body === "string") return req.body;
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body);

  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += String(chunk);
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    setCommonHeaders(res);
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, message: "Metodo nao permitido." });
    return;
  }

  try {
    const rawBody = await readBody(req);
    const payload = rawBody ? JSON.parse(rawBody) : {};
    const result = await handleAuthPayload(payload);
    sendJson(res, result.statusCode, result.payload);
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      message: error instanceof Error ? error.message : "Nao foi possivel autenticar."
    });
  }
}
