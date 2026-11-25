import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  AI_PROVIDER_SPECS, buildAiRadarSnapshot, fetchLiveAiRadar, formatContextWindow,
  loadAiRadarCache, mapStatuspageSummary, normalizeOpenRouterModels, resolveSyncMode,
  saveAiRadarCache,
} from "../src/aiRadar.js";
import { buildSnapshotFromSources, runSync, writeSnapshotAtomic } from "../scripts/sync-ai-models.mjs";

const nowIso = "2026-01-02T03:04:05.000Z";
const catalog = { data: [
  { id: "openai/example", name: "Example", context_length: 128000, created: 20,
    pricing: { prompt: "0.000002", completion: "0" } },
  { id: "openai/older", name: "Older", created: 10 },
] };
const summary = { page: { url: "https://status.openai.com" },
  status: { indicator: "none", description: "All Systems Operational" } };
const release = { tag_name: "v1.2.3", html_url: "https://github.com/ollama/ollama/releases/tag/v1.2.3",
  published_at: "2026-01-01T00:00:00Z" };
const fallback = buildAiRadarSnapshot({ nowIso: "2025-01-01T00:00:00Z" });
const cacheKey = "navhub.ai_radar.cache.v1";
const provider = (snapshot, id) => snapshot.providers.find((entry) => entry.id === id);
const ok = (value) => ({ ok: true, json: async () => value });

function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
}

test("context sizes format for human reading and reject invalid values", () => {
  for (const [value, expected] of [[null, "—"], [0, "—"], [999, "999"], [1024, "1K"],
    [128000, "128K"], [1000000, "1M"], [-1, "—"], ["2000", "—"], [NaN, "—"]]) {
    assert.equal(formatContextWindow(value), expected);
  }
});

test("catalog assigns exact organization aliases, deduplicates and sorts by creation", () => {
  assert.deepEqual(AI_PROVIDER_SPECS.map(({ id }) => id),
    ["openai", "anthropic", "google", "deepseek", "qwen", "xai", "moonshot", "zhipu"]);
  const rows = normalizeOpenRouterModels({ data: [
    catalog.data[1], { id: "openai/example", created: 2 }, catalog.data[0],
    { id: "moonshotai/kimi" }, { id: "z-ai/glm" }, { id: "alibaba/qwen" },
    { id: "notxai/grok" }, { id: "x-ai/grok" }, { id: "openai/../../bad" },
    { id: "javascript:alert(1)" },
  ] });
  const openai = rows.find(({ id }) => id === "openai");
  assert.equal(openai.modelCount, 2);
  assert.deepEqual(openai.recentModels.map(({ id }) => id), ["openai/example", "openai/older"]);
  assert.equal(openai.featuredModel.contextWindow, 128000);
  assert.deepEqual(openai.featuredModel.pricing, { prompt: "0.000002", completion: "0" });
  assert.equal(openai.recentModels[1].pricing, null);
  assert.equal(openai.recentModels[1].contextWindow, null);
  assert.equal(openai.featuredModel.url, "https://openrouter.ai/openai/example");
  for (const [id, model] of [["moonshot", "moonshotai/kimi"], ["zhipu", "z-ai/glm"],
    ["qwen", "alibaba/qwen"], ["xai", "x-ai/grok"]]) {
    assert.equal(rows.find((entry) => entry.id === id).featuredModel.id, model);
  }
  const previous = buildAiRadarSnapshot({ openrouterJson: catalog, nowIso });
  assert.equal(normalizeOpenRouterModels({ data: [] }, previous)[0].modelCount, 2);
  assert.equal(normalizeOpenRouterModels({ data: [] })[0].modelCount, 0);
});

test("Statuspage maps severity and only returns safe links", () => {
  for (const [indicator, severity] of [["none", "operational"], ["minor", "degraded"],
    ["major", "outage"], ["critical", "outage"], ["maintenance", "maintenance"]]) {
    assert.equal(mapStatuspageSummary({ status: { indicator } }, "Provider").severity, severity);
  }
  assert.equal(mapStatuspageSummary({}, "Provider").severity, "unknown");
  const mapped = mapStatuspageSummary({ ...summary, page: { url: "javascript:bad" } }, "OpenAI");
  assert.equal(mapped.url, null);
  assert.equal(mapped.sourceName, "OpenAI");
  assert.equal(mapped.description, "All Systems Operational");
});

test("sync mode follows source success, valid cache and build snapshot precedence", () => {
  for (const hasCache of [false, true]) {
    assert.equal(resolveSyncMode({ openrouterOk: true, statusOrOllamaOk: true, allSourcesOk: true, hasCache }), "live");
    assert.equal(resolveSyncMode({ allSourcesOk: true, hasCache }), "live");
    assert.equal(resolveSyncMode({ openrouterOk: true, statusOrOllamaOk: true, hasCache }), "partial-live");
    assert.equal(resolveSyncMode({ openrouterOk: true, statusOrOllamaOk: true, allSourcesOk: false, hasCache }), "partial-live");
    assert.equal(resolveSyncMode({ openrouterOk: true, statusOrOllamaOk: false, hasCache }), "partial-live");
    assert.equal(resolveSyncMode({ openrouterOk: false, statusOrOllamaOk: true, hasCache }), "partial-live");
  }
  assert.equal(resolveSyncMode({ hasCache: true }), "cache");
  assert.equal(resolveSyncMode({}), "snapshot");
});

test("snapshot preserves earlier catalog on status-only updates and keeps fallback time on total failure", () => {
  const first = buildAiRadarSnapshot({ openrouterJson: catalog, fallbackSnapshot: fallback, nowIso });
  assert.equal(first.snapshotSource, "build-live");
  assert.equal(first.generatedAt, nowIso);
  assert.equal(first.syncMode, "partial-live");
  const updated = buildAiRadarSnapshot({ openaiStatusJson: summary, ollamaJson: release,
    fallbackSnapshot: first, nowIso: "2026-03-01T00:00:00Z" });
  assert.equal(updated.syncMode, "partial-live");
  assert.equal(updated.ollama.version, "v1.2.3");
  assert.equal(provider(updated, "openai").status.severity, "operational");
  assert.equal(provider(updated, "openai").modelCount, 2);
  const offline = buildAiRadarSnapshot({ fallbackSnapshot: updated, nowIso });
  assert.equal(offline.snapshotSource, "fallback");
  assert.equal(offline.generatedAt, updated.generatedAt);
  assert.equal(offline.syncMode, "snapshot");
  assert.equal(provider(offline, "openai").modelCount, 2);
  assert.equal(buildAiRadarSnapshot({ fallbackSnapshot: { ...fallback, generatedAt: null }, nowIso }).generatedAt, null);
  assert.equal(buildAiRadarSnapshot({ openrouterJson: { data: [{ id: "unrelated/model" }] },
    openaiStatusJson: { status: { description: "incomplete" } },
    ollamaJson: { tag_name: "v1", html_url: "//evil.example" } }).syncMode, "snapshot");
});

test("cache round-trips successful data and rejects broken JSON, empty and fallback-only records", () => {
  const storage = memoryStorage();
  const live = buildAiRadarSnapshot({ openrouterJson: catalog, nowIso });
  assert.equal(saveAiRadarCache(live, storage), true);
  assert.deepEqual(loadAiRadarCache(storage), live);
  storage.setItem(cacheKey, JSON.stringify({ ...live, syncMode: "live" }));
  assert.deepEqual(loadAiRadarCache(storage), live);
  assert.equal(saveAiRadarCache(fallback, storage), false);
  assert.deepEqual(loadAiRadarCache(storage), live);
  const inconsistent = buildAiRadarSnapshot({ openrouterJson: catalog, openaiStatusJson: summary, nowIso });
  inconsistent.sourceResults.ollama = true;
  assert.equal(saveAiRadarCache(inconsistent, storage), false);
  storage.setItem(cacheKey, JSON.stringify(inconsistent));
  assert.equal(loadAiRadarCache(storage), null);
  for (const invalid of ["{", "null", "{}", '{"providers":[]}', JSON.stringify(fallback)]) {
    storage.setItem(cacheKey, invalid);
    assert.equal(loadAiRadarCache(storage), null);
  }
  const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("quota"); } };
  assert.equal(loadAiRadarCache(blocked), null);
  assert.equal(saveAiRadarCache(live, blocked), false);
});

test("large multi-provider data is compacted into valid cache JSON under 10 KB", () => {
  const storage = memoryStorage();
  const data = ["openai", "anthropic", "google", "deepseek", "qwen", "x-ai", "moonshotai", "z-ai"]
    .flatMap((prefix) => Array.from({ length: 20 }, (_, created) => ({
      id: prefix + "/" + "x".repeat(100) + created, name: "星".repeat(400), created,
    })));
  const live = buildAiRadarSnapshot({ openrouterJson: { data }, nowIso });
  assert.equal(saveAiRadarCache(live, storage), true);
  const persisted = storage.getItem(cacheKey);
  assert.ok(Buffer.byteLength(persisted, "utf8") < 10_000);
  const cached = loadAiRadarCache(storage);
  assert.deepEqual(cached, JSON.parse(persisted));
  assert.ok(cached.providers.every(({ modelCount, featuredModel }) => modelCount === 20 && featuredModel));
  assert.ok(cached.providers.some(({ recentModels }) => recentModels.length < 5));
});

test("independent requests produce all four honest browser sync modes", async () => {
  const storage = memoryStorage();
  const responses = new Map([
    ["https://openrouter.ai/api/v1/models", ok(catalog)],
    ["https://status.openai.com/api/v2/summary.json", ok(summary)],
    ["https://status.claude.com/api/v2/summary.json", ok(summary)],
    ["https://api.github.com/repos/ollama/ollama/releases/latest", ok(release)],
  ]);
  const signals = new Set();
  const sync = () => fetchLiveAiRadar({ fallbackSnapshot: fallback, storage, fetchImpl(url, { signal }) {
    signals.add(signal);
    if (responses.has(url)) return responses.get(url);
    throw new Error("offline");
  } });
  const live = await sync();
  assert.equal(live.syncMode, "live");
  assert.deepEqual(live.sourceResults, {
    openrouter: true, openaiStatus: true, claudeStatus: true, ollama: true,
  });
  assert.equal(live.ollama.version, "v1.2.3");
  assert.equal(signals.size, 4);
  assert.ok([...signals].every((signal) => signal instanceof AbortSignal && !signal.aborted));
  const openrouter = "https://openrouter.ai/api/v1/models";
  const openaiStatus = "https://status.openai.com/api/v2/summary.json";
  const claudeStatus = "https://status.claude.com/api/v2/summary.json";
  responses.delete("https://api.github.com/repos/ollama/ollama/releases/latest");
  responses.delete(openaiStatus);
  responses.delete(claudeStatus);
  const catalogOnly = await sync();
  assert.equal(catalogOnly.syncMode, "partial-live");
  assert.deepEqual(catalogOnly.sourceResults, {
    openrouter: true, openaiStatus: false, claudeStatus: false, ollama: false,
  });
  assert.deepEqual(loadAiRadarCache(storage), catalogOnly);
  responses.set(openrouter, { ok: false, json: async () => catalog });
  responses.set(openaiStatus, ok(summary));
  responses.set(claudeStatus, {
    ok: true, async json() { throw new SyntaxError("malformed JSON"); },
  });
  const partial = await sync();
  assert.equal(partial.syncMode, "partial-live");
  assert.deepEqual(partial.sourceResults, {
    openrouter: false, openaiStatus: true, claudeStatus: false, ollama: false,
  });
  assert.equal(provider(partial, "openai").modelCount, 2);
  responses.clear();
  assert.equal((await sync()).syncMode, "cache");
  storage.setItem(cacheKey, "{");
  assert.equal((await sync()).syncMode, "snapshot");
});

test("four independent request deadlines abort stuck headers or bodies and clear timers", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const signals = [];
  const pending = new Promise(() => {});
  const sync = fetchLiveAiRadar({ fallbackSnapshot: fallback, storage: memoryStorage(), timeoutMs: 10,
    async fetchImpl(url, { signal }) {
      signals.push(signal);
      return url.includes("openrouter") ? { ok: true, json: () => pending } : pending;
    },
  });
  await Promise.resolve();
  t.mock.timers.tick(10);
  assert.equal((await sync).syncMode, "snapshot");
  assert.equal(new Set(signals).size, 4);
  assert.ok(signals.every((signal) => signal.aborted));
  const completedSignals = [];
  const completed = await fetchLiveAiRadar({ timeoutMs: 10, storage: memoryStorage(),
    fetchImpl(_url, { signal }) { completedSignals.push(signal); return ok(catalog); },
  });
  assert.equal(completed.syncMode, "partial-live");
  t.mock.timers.tick(10);
  assert.equal(completedSignals.length, 4);
  assert.ok(completedSignals.every((signal) => !signal.aborted));
});

test("build sync preserves valid fallback bytes and atomically writes live or seed snapshots", async () => {
  const dir = await mkdtemp(join(tmpdir(), "nav-hub-ai-"));
  try {
    const outputPath = join(dir, "snapshot.json");
    const initial = JSON.stringify(fallback);
    const noNetwork = async () => { throw new Error("offline"); };
    await writeFile(outputPath, initial);
    assert.equal((await runSync({ outputPath, allowFallback: true, fetchImpl: noNetwork })).exitCode, 0);
    assert.equal(await readFile(outputPath, "utf8"), initial);
    assert.equal((await runSync({ outputPath, fetchImpl: noNetwork })).exitCode, 1);
    assert.equal(await readFile(outputPath, "utf8"), initial);
    await writeFile(outputPath, "{");
    assert.equal((await runSync({ outputPath, allowFallback: true, fetchImpl: noNetwork })).exitCode, 0);
    assert.equal(JSON.parse(await readFile(outputPath, "utf8")).snapshotSource, "fallback");
    const result = await runSync({ outputPath, nowIso,
      fetchImpl: (url) => ok(url.includes("openrouter") ? catalog : null),
    });
    assert.equal(result.exitCode, 0);
    const persisted = JSON.parse(await readFile(outputPath, "utf8"));
    assert.equal(persisted.snapshotSource, "build-live");
    assert.equal(persisted.syncMode, "snapshot");
    const isolated = await buildSnapshotFromSources({ nowIso, fallbackSnapshot: fallback,
      fetchImpl: (url) => ok(url.includes("openrouter") ? catalog : null),
    });
    assert.equal(isolated.generatedAt, nowIso);
    const missingParent = join(dir, "missing", "snapshot.json");
    await assert.rejects(writeSnapshotAtomic(missingParent, isolated), { code: "ENOENT" });
    for (const fetchImpl of [async () => ok(catalog), noNetwork]) {
      const result = await runSync({ outputPath: missingParent, allowFallback: true, fetchImpl });
      assert.equal(result.exitCode, 1);
      assert.match(result.message, /ENOENT/);
    }
    const lockedPath = await mkdtemp(join(dir, "rename-target-"));
    await assert.rejects(writeSnapshotAtomic(lockedPath, isolated));
    assert.deepEqual((await readdir(dir)).sort(), [lockedPath.slice(dir.length + 1), "snapshot.json"].sort());
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("CLI returns exit 0 with fallback and exit 1 in strict mode on source failure", async () => {
  const dir = await mkdtemp(join(tmpdir(), "nav-hub-ai-cli-"));
  try {
    const setup = join(dir, "setup.mjs");
    const outputPath = join(dir, "src", "data", "aiModelsSnapshot.json");
    const script = join(dir, "scripts", "sync-ai-models.mjs");
    await mkdir(join(dir, "scripts"));
    await mkdir(join(dir, "src", "data"), { recursive: true });
    for (const file of ["scripts/sync-ai-models.mjs", "src/aiRadar.js", "src/store.js", "src/data/defaultSites.js"]) {
      await copyFile(fileURLToPath(new URL("../" + file, import.meta.url)), join(dir, file));
    }
    await writeFile(join(dir, "package.json"), '{"type":"module"}');
    const initial = JSON.stringify(fallback);
    await writeFile(outputPath, initial);
    await writeFile(setup, 'globalThis.fetch = async () => { throw new Error("offline"); };');
    const run = (...flags) => spawnSync(process.execPath, ["--import", pathToFileURL(setup).href, script, ...flags],
      { cwd: dir, encoding: "utf8" });
    const allowed = run("--allow-fallback");
    assert.equal(allowed.status, 0, allowed.stderr);
    assert.equal(await readFile(outputPath, "utf8"), initial);
    const strict = run();
    assert.equal(strict.status, 1, strict.stderr);
    assert.equal(await readFile(outputPath, "utf8"), initial);
    await rm(outputPath);
    const seeded = run("--allow-fallback");
    assert.equal(seeded.status, 0, seeded.stderr);
    const seed = JSON.parse(await readFile(outputPath, "utf8"));
    assert.equal(seed.snapshotSource, "fallback");
    assert.equal(seed.syncMode, "snapshot");
    assert.equal(seed.providers.length, AI_PROVIDER_SPECS.length);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
