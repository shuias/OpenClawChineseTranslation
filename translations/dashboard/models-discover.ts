import {
  ErrorCodes,
  errorShape,
  type ModelsDiscoverResult,
  validateModelsDiscoverParams,
} from "../../../packages/gateway-protocol/src/index.js";
import { formatForLog } from "../ws-log.js";
import type { GatewayRequestHandlers } from "./types.js";
import { assertValidParams } from "./validation.js";

const DEFAULT_TIMEOUT_MS = 15_000;
const MIN_TIMEOUT_MS = 3_000;
const MAX_TIMEOUT_MS = 60_000;
const MAX_MODELS = 512;

function normalizeModelsEndpoint(baseUrl: string): URL | null {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return null;
  }
  try {
    const url = new URL(`${trimmed}/models`);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function extractModelIds(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) {
    return [];
  }
  const seen = new Set<string>();
  for (const entry of data) {
    const id =
      entry && typeof entry === "object" ? (entry as { id?: unknown }).id : undefined;
    if (typeof id === "string" && id.trim() && !seen.has(id)) {
      seen.add(id);
      if (seen.size >= MAX_MODELS) {
        break;
      }
    }
  }
  return [...seen];
}

function discoverErrorMessage(status: number): string {
  if (status === 401 || status === 403) {
    return "鉴权失败，请检查 API Key。";
  }
  if (status === 404) {
    return "未找到 /models 端点，请检查 Base URL（通常需要以 /v1 结尾）。";
  }
  return `端点返回 HTTP ${status}。`;
}

export const modelsDiscoverHandlers: GatewayRequestHandlers = {
  "models.discover": async ({ params, respond, context }) => {
    if (!assertValidParams(params, validateModelsDiscoverParams, "models.discover", respond)) {
      return;
    }
    const url = normalizeModelsEndpoint(params.baseUrl);
    if (!url) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "Base URL 必须是合法的 http(s) 地址。"),
      );
      return;
    }
    const timeoutMs = Math.min(
      MAX_TIMEOUT_MS,
      Math.max(MIN_TIMEOUT_MS, params.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    );
    const startedAt = Date.now();
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      const apiKey = params.apiKey?.trim();
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.UNAVAILABLE, discoverErrorMessage(response.status)),
        );
        return;
      }
      const models = extractModelIds(await response.json());
      const result: ModelsDiscoverResult = {
        models,
        latencyMs: Date.now() - startedAt,
      };
      respond(true, result, undefined);
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      context.logGateway.warn("Model discovery failed.", {
        event: "models_discover_failed",
        host: url.host,
        timeoutMs,
        error: formatForLog(error),
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          timedOut ? "连接超时，请检查 Base URL 与网络。" : "无法连接到该地址，请检查 Base URL。",
        ),
      );
    }
  },
};
