import { randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AI_PROVIDER_SPECS, buildAiRadarSnapshot, fetchLiveAiRadar } from "../src/aiRadar.js";
import { isSafeHttpUrl } from "../src/store.js";

const SNAPSHOT_PATH = fileURLToPath(new URL("../src/data/aiModelsSnapshot.json", import.meta.url));

export function buildSnapshotFromSources({
  fallbackSnapshot, fetchImpl, nowIso, timeoutMs = 10_000,
} = {}) {
  return fetchLiveAiRadar({ fallbackSnapshot, fetchImpl, nowIso, timeoutMs, storage: null });
}

export async function writeSnapshotAtomic(outputPath, snapshot) {
  const temporaryPath = outputPath + "." + randomUUID() + ".tmp";
  try {
    await writeFile(temporaryPath, JSON.stringify(snapshot, null, 2) + "\n", { flag: "wx" });
    await rename(temporaryPath, outputPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

async function readSnapshot(outputPath) {
  try {
    const snapshot = JSON.parse(await readFile(outputPath, "utf8"));
    if (!["build-live", "fallback"].includes(snapshot?.snapshotSource)
      || (snapshot.generatedAt !== null && !Number.isFinite(Date.parse(snapshot.generatedAt)))
      || !Array.isArray(snapshot.providers) || snapshot.providers.length !== AI_PROVIDER_SPECS.length) return null;
    const valid = AI_PROVIDER_SPECS.every(({ id }) => snapshot.providers.some((provider) =>
      provider?.id === id && Number.isSafeInteger(provider.modelCount) && provider.modelCount >= 0
      && Array.isArray(provider.recentModels)));
    if (!valid) return null;
    const links = [snapshot.ollama?.url, ...snapshot.providers.flatMap((provider) => [
      provider.url, provider.apiUrl, provider.status?.url, provider.featuredModel?.url,
      ...provider.recentModels.map((model) => model?.url),
    ])];
    return links.every((url) => url == null || isSafeHttpUrl(url)) ? snapshot : null;
  } catch {
    return null;
  }
}

export async function runSync({ outputPath = SNAPSHOT_PATH, allowFallback = false, fetchImpl, nowIso } = {}) {
  try {
    const existing = await readSnapshot(outputPath);
    const snapshot = await buildSnapshotFromSources({ fallbackSnapshot: existing, fetchImpl, nowIso });
    if (snapshot.snapshotSource === "build-live") {
      await writeSnapshotAtomic(outputPath, { ...snapshot, syncMode: "snapshot" });
      const sources = Object.keys(snapshot.sourceResults).filter((source) => snapshot.sourceResults[source]);
      return { exitCode: 0, message: "Updated build snapshot (" + sources.join(", ") + ")." };
    }
    if (!allowFallback) return { exitCode: 1, message: "No usable upstream data." };
    if (existing) return { exitCode: 0, message: "No usable upstream data. Preserved existing snapshot." };
    await writeSnapshotAtomic(outputPath, buildAiRadarSnapshot());
    return { exitCode: 0, message: "No usable upstream data. Wrote offline seed snapshot." };
  } catch (error) {
    return { exitCode: 1, message: "Snapshot sync failed: " + error.message };
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { exitCode, message } = await runSync({ allowFallback: process.argv.includes("--allow-fallback") });
  const log = exitCode === 0 ? console.log : console.error;
  log("[ai-radar] " + message);
  process.exitCode = exitCode;
}
