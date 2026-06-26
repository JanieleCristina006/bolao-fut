import { handleAuthPayload } from "../../api/auth-core.js";

const COMMON_HEADERS = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store"
};

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      ...COMMON_HEADERS,
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(payload)
  };
}

function readBody(event) {
  if (!event.body) return "";
  return event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: COMMON_HEADERS,
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { ok: false, message: "Metodo nao permitido." });
  }

  try {
    const rawBody = readBody(event);
    const payload = rawBody ? JSON.parse(rawBody) : {};
    const result = await handleAuthPayload(payload);
    return jsonResponse(result.statusCode, result.payload);
  } catch (error) {
    return jsonResponse(500, {
      ok: false,
      message: error instanceof Error ? error.message : "Nao foi possivel autenticar."
    });
  }
}
