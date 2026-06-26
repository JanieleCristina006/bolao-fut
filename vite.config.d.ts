declare module "./api/auth-core.js" {
  export function handleAuthPayload(payload: unknown): Promise<{
    statusCode: number;
    payload: Record<string, unknown>;
  }>;
}

declare const _default: import("vite").UserConfigFnObject;
export default _default;
