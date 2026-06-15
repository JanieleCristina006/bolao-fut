const SCRIPT_URL = process.env.GOOGLE_SCRIPT_API_URL;

const COMMON_HEADERS = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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

function appendQueryParams(targetUrl, event) {
  const rawQuery = event.rawQuery || "";
  if (rawQuery) {
    new URLSearchParams(rawQuery).forEach((value, key) => {
      targetUrl.searchParams.set(key, value);
    });
    return;
  }

  Object.entries(event.queryStringParameters || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      targetUrl.searchParams.set(key, value);
    }
  });
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

  if (!SCRIPT_URL) {
    return jsonResponse(500, {
      ok: false,
      message: "GOOGLE_SCRIPT_API_URL nao configurada no servidor Netlify."
    });
  }

  try {
    const targetUrl = new URL(SCRIPT_URL);
    appendQueryParams(targetUrl, event);

    const method = event.httpMethod || "GET";
    const requestInit = {
      method,
      redirect: "follow",
      headers: { Accept: "application/json" }
    };

    if (method !== "GET" && method !== "HEAD") {
      requestInit.headers = {
        ...requestInit.headers,
        "Content-Type": "text/plain;charset=utf-8"
      };
      requestInit.body = readBody(event);
    }

    const response = await fetch(targetUrl.toString(), requestInit);
    const body = await response.text();

    return {
      statusCode: response.status,
      headers: {
        ...COMMON_HEADERS,
        "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8"
      },
      body
    };
  } catch (error) {
    return jsonResponse(502, {
      ok: false,
      message: error instanceof Error ? error.message : "Nao foi possivel acessar o Google Apps Script."
    });
  }
}
