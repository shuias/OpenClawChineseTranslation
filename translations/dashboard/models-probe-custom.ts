import pMap from "p-map";
import { resolveUsableCustomProviderApiKey } from "../../agents/model-auth.js";
import type { AuthProbeResult, AuthProbeStatus } from "../../commands/models/list.probe.js";
import { resolveMergedModelProviderEntry } from "../../config/model-provider-config.js";
import type { OpenClawConfig } from "../../config/types.openclaw.js";

const PROBE_PROMPT = "Reply with OK. Do not use tools.";
const PROBE_MAX_TOKENS = 128;
const MAX_PROBE_MODELS = 16;
const PROBE_CONCURRENCY = 2;

type CustomProbePlan = {
  apiKey: string;
  baseUrl: string;
  modelIds: string[];
};

// Only multi-model custom providers configured directly under models.providers
// with a usable literal/env API key take the per-model path; everything else
// keeps the upstream credential-profile probe.
function planCustomProviderProbe(
  cfg: OpenClawConfig,
  provider: string,
): CustomProbePlan | null {
  const providerConfig = resolveMergedModelProviderEntry(cfg, provider)?.providerConfig;
  if (!providerConfig || providerConfig.api !== "openai-completions") {
    return null;
  }
  const baseUrl = providerConfig.baseUrl?.trim().replace(/\/+$/, "");
  if (!baseUrl || !/^https?:\/\//.test(baseUrl)) {
    return null;
  }
  const seen = new Set<string>();
  for (const model of providerConfig.models ?? []) {
    const id = typeof model?.id === "string" ? model.id.trim() : "";
    if (id) {
      seen.add(id);
    }
    if (seen.size >= MAX_PROBE_MODELS) {
      break;
    }
  }
  if (seen.size < 2) {
    return null;
  }
  const apiKey = resolveUsableCustomProviderApiKey({ cfg, provider })?.apiKey?.trim();
  if (!apiKey) {
    return null;
  }
  return { apiKey, baseUrl, modelIds: [...seen] };
}

function statusFromHttpStatus(status: number): AuthProbeStatus {
  if (status === 401 || status === 403) {
    return "auth";
  }
  if (status === 402) {
    return "billing";
  }
  if (status === 429) {
    return "rate_limit";
  }
  return "unknown";
}

function hasVisibleReply(payload: unknown): boolean {
  const choices = (payload as { choices?: unknown } | undefined)?.choices;
  const first = Array.isArray(choices) ? choices[0] : undefined;
  const content = (first as { message?: { content?: unknown } } | undefined)?.message?.content;
  return typeof content === "string" && content.trim().length > 0;
}

async function probeSingleModel(
  plan: CustomProbePlan,
  modelId: string,
  timeoutMs: number,
): Promise<Omit<AuthProbeResult, "provider">> {
  const startedAt = Date.now();
  const latency = () => Date.now() - startedAt;
  try {
    const response = await fetch(`${plan.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${plan.apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: PROBE_PROMPT }],
        max_tokens: PROBE_MAX_TOKENS,
        stream: false,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      return {
        model: modelId,
        label: "config",
        source: "models.json",
        mode: "api_key",
        status: statusFromHttpStatus(response.status),
        latencyMs: latency(),
      };
    }
    const status: AuthProbeStatus = hasVisibleReply(await response.json()) ? "ok" : "format";
    return {
      model: modelId,
      label: "config",
      source: "models.json",
      mode: "api_key",
      status,
      latencyMs: latency(),
    };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return {
      model: modelId,
      label: "config",
      source: "models.json",
      mode: "api_key",
      status: timedOut ? "timeout" : "unknown",
      latencyMs: latency(),
    };
  }
}

export async function probeCustomProviderModels(params: {
  cfg: OpenClawConfig;
  provider: string;
  timeoutMs: number;
}): Promise<AuthProbeResult[] | null> {
  const plan = planCustomProviderProbe(params.cfg, params.provider);
  if (!plan) {
    return null;
  }
  const results = await pMap(
    plan.modelIds,
    (modelId) => probeSingleModel(plan, modelId, params.timeoutMs),
    { concurrency: PROBE_CONCURRENCY },
  );
  return results.map((result) => ({
    ...result,
    provider: params.provider,
    model: `${params.provider}/${result.model}`,
  }));
}
