import { isSafeHttpUrl } from "./store.js";

export const AI_PROVIDER_SPECS = [
  { id: "openai", name: "OpenAI", family: "GPT / Codex / o 系列", aliases: ["openai"],
    url: "https://openai.com", apiUrl: "https://platform.openai.com/docs/models" },
  { id: "anthropic", name: "Anthropic", family: "Claude", aliases: ["anthropic"],
    url: "https://www.anthropic.com", apiUrl: "https://platform.claude.com/docs/en/about-claude/models/overview" },
  { id: "google", name: "Google", family: "Gemini", aliases: ["google"],
    url: "https://gemini.google.com", apiUrl: "https://ai.google.dev/gemini-api/docs/models" },
  { id: "deepseek", name: "DeepSeek", family: "R1 / V3", aliases: ["deepseek"],
    url: "https://www.deepseek.com", apiUrl: "https://api-docs.deepseek.com" },
  { id: "qwen", name: "Qwen 通义千问", family: "Qwen", aliases: ["qwen", "alibaba"],
    url: "https://qwen.ai", apiUrl: "https://www.alibabacloud.com/help/en/model-studio/models" },
  { id: "xai", name: "xAI", family: "Grok", aliases: ["xai", "x-ai"],
    url: "https://x.ai", apiUrl: "https://docs.x.ai/docs/models" },
  { id: "moonshot", name: "Moonshot", family: "Kimi", aliases: ["moonshot", "moonshotai"],
    url: "https://www.moonshot.cn", apiUrl: "https://platform.moonshot.cn/docs" },
  { id: "zhipu", name: "Zhipu 智谱", family: "GLM", aliases: ["zhipu", "zhipuai", "z-ai"],
    url: "https://www.zhipuai.cn", apiUrl: "https://open.bigmodel.cn" },
];

const SOURCES = {
  openrouter: "https://openrouter.ai/api/v1/models",
  openaiStatus: "https://status.openai.com/api/v2/summary.json",
  claudeStatus: "https://status.claude.com/api/v2/summary.json",
  ollama: "https://api.github.com/repos/ollama/ollama/releases/latest",
};
const ALIAS_TO_PROVIDER = new Map(AI_PROVIDER_SPECS.flatMap(({ id, aliases }) =>
  aliases.map((alias) => [alias, id])));
const STATUS_SEVERITY = new Map([
  ["none", "operational"], ["minor", "degraded"], ["major", "outage"],
  ["critical", "outage"], ["maintenance", "maintenance"],
]);
const CACHE_KEY = "navhub.ai_radar.cache.v1";
const CACHE_LIMIT_BYTES = 10_000;
const RECENT_MODEL_LIMIT = 5;

const safeUrl = (value) => typeof value === "string" && value.length <= 300 && isSafeHttpUrl(value)
  ? value : null;
const shortText = (value, size) => typeof value === "string"
  ? Array.from(value.trim()).slice(0, size).join("") : "";
const timestamp = (value) => typeof value === "string" && value.length <= 40
  && Number.isFinite(Date.parse(value)) ? value : null;
const positiveInteger = (value) => Number.isSafeInteger(value) && value > 0 ? value : null;

export function formatContextWindow(tokens) {
  if (!positiveInteger(tokens)) return "—";
  if (tokens < 1000) return String(tokens);
  const [unit, suffix] = tokens >= 1_000_000 ? [1_000_000, "M"] : [1000, "K"];
  return Number((tokens / unit).toFixed(1)) + suffix;
}

function modelProviderId(id) {
  if (typeof id !== "string" || id.length > 150 || !/^[\w-]+\/[\w][\w.:-]*$/i.test(id)) return null;
  return ALIAS_TO_PROVIDER.get(id.split("/")[0].toLowerCase()) ?? null;
}

function normalizePrice(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const price = String(value);
  return price.length <= 24 && /^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(price)
    && Number.isFinite(Number(price)) ? price : null;
}

function modelRecord(raw, providerId, contextWindow) {
  if (modelProviderId(raw?.id) !== providerId) return null;
  const url = safeUrl("https://openrouter.ai/" + raw.id);
  if (!url) return null;
  const prompt = normalizePrice(raw.pricing?.prompt);
  const completion = normalizePrice(raw.pricing?.completion);
  return {
    id: raw.id,
    name: shortText(raw.name, 80) || raw.id.split("/")[1],
    url,
    contextWindow: positiveInteger(contextWindow),
    created: positiveInteger(raw.created),
    pricing: prompt === null && completion === null ? null : { prompt, completion },
  };
}

function modelGroups(rawResponse) {
  const groups = new Map();
  for (const raw of Array.isArray(rawResponse?.data) ? rawResponse.data : []) {
    const providerId = modelProviderId(raw?.id);
    if (!providerId) continue;
    const model = modelRecord(raw, providerId, raw.context_length);
    if (!model) continue;
    if (!groups.has(providerId)) groups.set(providerId, new Map());
    const byId = groups.get(providerId);
    const key = model.id.toLowerCase();
    if (!byId.has(key) || (model.created ?? 0) > (byId.get(key).created ?? 0)) byId.set(key, model);
  }
  return groups;
}

function priorProviders(snapshot) {
  const providers = Array.isArray(snapshot?.providers) ? snapshot.providers : [];
  return new Map(providers.map((provider) => [provider?.id, provider]));
}

function normalizeProviderModels(groups, previous) {
  return AI_PROVIDER_SPECS.map(({ id, name, family, url, apiUrl }) => {
    const current = groups.get(id);
    const prior = previous.get(id);
    const previousModels = Array.isArray(prior?.recentModels) ? prior.recentModels : [];
    const recentModels = current
      ? [...current.values()].sort((a, b) => (b.created ?? 0) - (a.created ?? 0) || a.id.localeCompare(b.id))
        .slice(0, RECENT_MODEL_LIMIT)
      : previousModels.slice(0, RECENT_MODEL_LIMIT)
        .map((raw) => modelRecord(raw, id, raw?.contextWindow)).filter(Boolean);
    const priorFeatured = prior?.featuredModel;
    const featuredModel = recentModels[0] ?? modelRecord(priorFeatured, id, priorFeatured?.contextWindow);
    return {
      id, name, family, url: safeUrl(url), apiUrl: safeUrl(apiUrl),
      catalogFresh: Boolean(current),
      modelCount: current?.size ?? Math.max(recentModels.length, Number(Boolean(featuredModel)),
        positiveInteger(prior?.modelCount) ?? 0),
      featuredModel,
      recentModels,
    };
  });
}

export function normalizeOpenRouterModels(rawResponse, existingSnapshot) {
  return normalizeProviderModels(modelGroups(rawResponse), priorProviders(existingSnapshot));
}

function statusRecord(indicator, description, url, sourceName) {
  return {
    sourceName,
    indicator: STATUS_SEVERITY.has(indicator) ? indicator : "unknown",
    severity: STATUS_SEVERITY.get(indicator) ?? "unknown",
    description: shortText(description, 100),
    url: safeUrl(url),
  };
}

export function mapStatuspageSummary(rawSummary, sourceName) {
  return statusRecord(rawSummary?.status?.indicator, rawSummary?.status?.description, rawSummary?.page?.url, sourceName);
}

function normalizeOllama(raw, version, url, publishedAt) {
  if (typeof version !== "string" || !/^v?\d[\w.+-]{0,39}$/.test(version) || !safeUrl(url)) return null;
  return { version, name: shortText(raw?.name, 48) || "Ollama", url, publishedAt: timestamp(publishedAt) };
}

export function resolveSyncMode({ openrouterOk, statusOrOllamaOk, allSourcesOk = false, hasCache } = {}) {
  if (allSourcesOk === true) return "live";
  if (openrouterOk || statusOrOllamaOk) return "partial-live";
  return hasCache ? "cache" : "snapshot";
}

function resolveSourceSyncMode({ openrouter, openaiStatus, claudeStatus, ollama }) {
  return resolveSyncMode({
    openrouterOk: openrouter,
    statusOrOllamaOk: openaiStatus || claudeStatus || ollama,
    allSourcesOk: openrouter && openaiStatus && claudeStatus && ollama,
  });
}

export function buildAiRadarSnapshot({
  openrouterJson, openaiStatusJson, claudeStatusJson, ollamaJson, fallbackSnapshot, nowIso,
} = {}) {
  const groups = modelGroups(openrouterJson);
  const previous = priorProviders(fallbackSnapshot);
  const statuses = new Map([
    ["openai", mapStatuspageSummary(openaiStatusJson, "OpenAI Status")],
    ["anthropic", mapStatuspageSummary(claudeStatusJson, "Claude Status")],
  ]);
  const ollama = normalizeOllama(ollamaJson, ollamaJson?.tag_name, ollamaJson?.html_url, ollamaJson?.published_at);
  const sourceResults = {
    openrouter: groups.size > 0,
    openaiStatus: statuses.get("openai").severity !== "unknown",
    claudeStatus: statuses.get("anthropic").severity !== "unknown",
    ollama: Boolean(ollama),
  };
  const syncMode = resolveSourceSyncMode(sourceResults);
  const synced = syncMode !== "snapshot";
  const previousOllama = fallbackSnapshot?.ollama;
  return {
    snapshotSource: synced ? "build-live" : "fallback",
    generatedAt: timestamp(synced || !fallbackSnapshot ? nowIso : fallbackSnapshot.generatedAt),
    syncMode,
    sourceResults,
    providers: normalizeProviderModels(groups, previous).map((provider) => {
      const latest = statuses.get(provider.id);
      const prior = previous.get(provider.id)?.status;
      const status = !latest || latest.severity !== "unknown" || !prior
        ? (latest ?? null) : statusRecord(prior.indicator, prior.description, prior.url, latest.sourceName);
      return { ...provider, status };
    }),
    ollama: ollama ?? normalizeOllama(previousOllama,
      previousOllama?.version, previousOllama?.url, previousOllama?.publishedAt),
  };
}

function validCache(snapshot) {
  if (snapshot?.snapshotSource !== "build-live" || !timestamp(snapshot.generatedAt)
    || !Array.isArray(snapshot.providers) || snapshot.providers.length !== AI_PROVIDER_SPECS.length) return false;
  const previous = priorProviders(snapshot);
  if (!AI_PROVIDER_SPECS.every(({ id }) => {
    const provider = previous.get(id);
    return provider && Number.isSafeInteger(provider.modelCount) && provider.modelCount >= 0
      && Array.isArray(provider.recentModels);
  })) return false;
  const available = {
    openrouter: snapshot.providers.some(({ id, featuredModel, modelCount }) =>
      modelCount > 0 && modelRecord(featuredModel, id, featuredModel?.contextWindow)),
    openaiStatus: STATUS_SEVERITY.has(previous.get("openai").status?.indicator),
    claudeStatus: STATUS_SEVERITY.has(previous.get("anthropic").status?.indicator),
    ollama: Boolean(normalizeOllama(snapshot.ollama, snapshot.ollama?.version,
      snapshot.ollama?.url, snapshot.ollama?.publishedAt)),
  };
  const sources = snapshot.sourceResults;
  if (Object.keys(SOURCES).some((source) =>
    typeof sources?.[source] !== "boolean" || (sources[source] && !available[source]))) return false;
  const mode = resolveSourceSyncMode(sources);
  return mode !== "snapshot" && snapshot.syncMode === mode;
}

function safeCachedSnapshot(snapshot) {
  const clean = buildAiRadarSnapshot({ fallbackSnapshot: snapshot });
  return { ...clean, providers: clean.providers.map((provider) => ({
    ...provider,
    catalogFresh: snapshot.providers.find((item) => item.id === provider.id)?.catalogFresh === true,
  })), snapshotSource: snapshot.snapshotSource, syncMode: snapshot.syncMode,
    sourceResults: Object.fromEntries(Object.keys(SOURCES).map((key) => [key, snapshot.sourceResults[key]])) };
}

function storageOrDefault(storage) {
  return storage === undefined ? globalThis.localStorage : storage;
}

function byteLength(value) {
  return new TextEncoder().encode(value).length;
}

export function loadAiRadarCache(storage) {
  try {
    const raw = storageOrDefault(storage)?.getItem(CACHE_KEY);
    if (typeof raw !== "string" || raw.length >= CACHE_LIMIT_BYTES || byteLength(raw) >= CACHE_LIMIT_BYTES) return null;
    const snapshot = JSON.parse(raw);
    // Older caches labeled any OpenRouter success as live.
    if (snapshot?.syncMode === "live" && snapshot.sourceResults?.openrouter === true) {
      snapshot.syncMode = resolveSourceSyncMode(snapshot.sourceResults);
    }
    return validCache(snapshot) ? safeCachedSnapshot(snapshot) : null;
  } catch {
    return null;
  }
}

export function saveAiRadarCache(snapshot, storage) {
  try {
    const target = storageOrDefault(storage);
    if (!target || !validCache(snapshot)) return false;
    const compact = safeCachedSnapshot(snapshot);
    for (let limit = RECENT_MODEL_LIMIT; limit >= 0; limit -= 1) {
      const json = JSON.stringify({
        ...compact,
        providers: compact.providers.map((provider) => ({ ...provider, recentModels: provider.recentModels.slice(0, limit) })),
      });
      if (byteLength(json) >= CACHE_LIMIT_BYTES) continue;
      target.setItem(CACHE_KEY, json);
      return true;
    }
  } catch {
    // A blocked or full browser store must not affect a successful refresh.
  }
  return false;
}

async function fetchJson(url, fetchImpl, timeoutMs) {
  if (!isSafeHttpUrl(url)) return null;
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      resolve(null);
      controller.abort();
    }, timeoutMs);
  });
  try {
    const request = async () => {
      const response = await fetchImpl(url, { signal: controller.signal });
      return response.ok ? response.json() : null;
    };
    return await Promise.race([timeout, request()]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchLiveAiRadar({
  fallbackSnapshot, storage, fetchImpl = globalThis.fetch, timeoutMs = 8_000, nowIso,
} = {}) {
  const cache = loadAiRadarCache(storage);
  const [openrouterJson, openaiStatusJson, claudeStatusJson, ollamaJson] = await Promise.all(
    Object.values(SOURCES).map((url) => fetchJson(url, fetchImpl, timeoutMs)),
  );
  const snapshot = buildAiRadarSnapshot({
    openrouterJson, openaiStatusJson, claudeStatusJson, ollamaJson,
    fallbackSnapshot: cache ?? fallbackSnapshot,
    nowIso: nowIso ?? new Date().toISOString(),
  });
  if (snapshot.syncMode === "snapshot") return cache ? { ...snapshot, syncMode: "cache" } : snapshot;
  saveAiRadarCache(snapshot, storage);
  return snapshot;
}
