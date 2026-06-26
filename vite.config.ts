import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

declare const process: { cwd: () => string; env: Record<string, string | undefined> };

const SHEETS_PROXY_PATH = "/api/sheets";
const AUTH_PROXY_PATH = "/api/auth";
const AUTH_CORE_MODULE_URL = encodeURI(`file:///${process.cwd().replace(/\\/g, "/")}/api/auth-core.js`);

function setProxyHeaders(res: any): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
}

function sendProxyJson(res: any, statusCode: number, payload: Record<string, unknown>): void {
  res.statusCode = statusCode;
  setProxyHeaders(res);
  res.end(JSON.stringify(payload));
}

function appendRequestQuery(targetUrl: URL, requestUrl: string | undefined): void {
  const sourceUrl = new URL(requestUrl || "/", "http://localhost");
  sourceUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });
}

function readRequestBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: unknown) => {
      body += String(chunk);
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function proxySheetsRequest(req: any, res: any, scriptUrl: string | undefined): Promise<void> {
  if (!scriptUrl) {
    sendProxyJson(res, 500, {
      ok: false,
      message: "GOOGLE_SCRIPT_API_URL nao configurada no .env."
    });
    return;
  }

  try {
    const targetUrl = new URL(scriptUrl);
    appendRequestQuery(targetUrl, req.url);

    const method = req.method || "GET";
    const requestInit: any = {
      method,
      redirect: "follow",
      headers: { Accept: "application/json" }
    };

    if (method !== "GET" && method !== "HEAD") {
      requestInit.headers = {
        ...requestInit.headers,
        "Content-Type": "text/plain;charset=utf-8"
      };
      requestInit.body = await readRequestBody(req);
    }

    const response = await fetch(targetUrl.toString(), requestInit);
    const body = await response.text();

    res.statusCode = response.status;
    setProxyHeaders(res);
    res.end(body);
  } catch (error) {
    sendProxyJson(res, 502, {
      ok: false,
      message: error instanceof Error ? error.message : "Nao foi possivel acessar o Google Apps Script."
    });
  }
}

async function proxyAuthRequest(req: any, res: any, databaseUrl: string | undefined): Promise<void> {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    setProxyHeaders(res);
    res.end("");
    return;
  }

  if (req.method !== "POST") {
    sendProxyJson(res, 405, { ok: false, message: "Metodo nao permitido." });
    return;
  }

  try {
    if (databaseUrl && !process.env.DATABASE_URL) {
      process.env.DATABASE_URL = databaseUrl;
    }
    const authModule = (await import(AUTH_CORE_MODULE_URL)) as {
      handleAuthPayload: (payload: unknown) => Promise<{ statusCode: number; payload: Record<string, unknown> }>;
    };
    const rawBody = await readRequestBody(req);
    const payload = rawBody ? JSON.parse(rawBody) : {};
    const result = await authModule.handleAuthPayload(payload);
    sendProxyJson(res, result.statusCode, result.payload);
  } catch (error) {
    sendProxyJson(res, 500, {
      ok: false,
      message: error instanceof Error ? error.message : "Nao foi possivel autenticar."
    });
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  return {
    plugins: [
      react(),
      {
        name: "google-sheets-dev-proxy",
        configureServer(server) {
          server.middlewares.use(SHEETS_PROXY_PATH, (req, res) => {
            void proxySheetsRequest(req, res, env.GOOGLE_SCRIPT_API_URL);
          });
          server.middlewares.use(AUTH_PROXY_PATH, (req, res) => {
            void proxyAuthRequest(req, res, env.DATABASE_URL || env.NEON_DATABASE_URL);
          });
        },
        configurePreviewServer(server) {
          server.middlewares.use(SHEETS_PROXY_PATH, (req, res) => {
            void proxySheetsRequest(req, res, env.GOOGLE_SCRIPT_API_URL);
          });
          server.middlewares.use(AUTH_PROXY_PATH, (req, res) => {
            void proxyAuthRequest(req, res, env.DATABASE_URL || env.NEON_DATABASE_URL);
          });
        }
      }
    ]
  };
});
