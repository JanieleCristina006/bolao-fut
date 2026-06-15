import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
const SHEETS_PROXY_PATH = "/api/sheets";
function setProxyHeaders(res) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
}
function sendProxyJson(res, statusCode, payload) {
    res.statusCode = statusCode;
    setProxyHeaders(res);
    res.end(JSON.stringify(payload));
}
function appendRequestQuery(targetUrl, requestUrl) {
    const sourceUrl = new URL(requestUrl || "/", "http://localhost");
    sourceUrl.searchParams.forEach((value, key) => {
        targetUrl.searchParams.set(key, value);
    });
}
function readRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", (chunk) => {
            body += String(chunk);
        });
        req.on("end", () => resolve(body));
        req.on("error", reject);
    });
}
async function proxySheetsRequest(req, res, scriptUrl) {
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
            requestInit.body = await readRequestBody(req);
        }
        const response = await fetch(targetUrl.toString(), requestInit);
        const body = await response.text();
        res.statusCode = response.status;
        setProxyHeaders(res);
        res.end(body);
    }
    catch (error) {
        sendProxyJson(res, 502, {
            ok: false,
            message: error instanceof Error ? error.message : "Nao foi possivel acessar o Google Apps Script."
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
                },
                configurePreviewServer(server) {
                    server.middlewares.use(SHEETS_PROXY_PATH, (req, res) => {
                        void proxySheetsRequest(req, res, env.GOOGLE_SCRIPT_API_URL);
                    });
                }
            }
        ]
    };
});
