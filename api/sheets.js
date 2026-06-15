const SCRIPT_URL = process.env.GOOGLE_SCRIPT_API_URL;

function setCommonHeaders(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, status, payload) {
  setCommonHeaders(res);
  res.status(status).json(payload);
}

function appendQueryParams(targetUrl, query) {
  Object.entries(query || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => targetUrl.searchParams.append(key, item));
      return;
    }

    if (value !== undefined) {
      targetUrl.searchParams.set(key, value);
    }
  });
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

  if (!SCRIPT_URL) {
    sendJson(res, 500, {
      ok: false,
      message: "GOOGLE_SCRIPT_API_URL nao configurada no servidor."
    });
    return;
  }

  try {
    const targetUrl = new URL(SCRIPT_URL);
    appendQueryParams(targetUrl, req.query);

    const method = req.method || "GET";
    const headers = { Accept: "application/json" };
    const requestInit = {
      method,
      redirect: "follow",
      headers
    };

    if (method !== "GET" && method !== "HEAD") {
      requestInit.headers = {
        ...headers,
        "Content-Type": "text/plain;charset=utf-8"
      };
      requestInit.body = await readBody(req);
    }

    const response = await fetch(targetUrl.toString(), requestInit);
    const body = await response.text();

    setCommonHeaders(res);
    res.setHeader("Content-Type", response.headers.get("content-type") || "application/json; charset=utf-8");
    res.status(response.status).send(body);
  } catch (error) {
    sendJson(res, 502, {
      ok: false,
      message: error instanceof Error ? error.message : "Nao foi possivel acessar o Google Apps Script."
    });
  }
}
