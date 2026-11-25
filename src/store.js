import { DEFAULT_CATEGORIES, DEFAULT_SEARCH_ENGINES, DEFAULT_SITES } from "./data/defaultSites.js";

export const STORAGE_KEY = "navhub.state.v1";

const ACCENT_PALETTE = ["#38bdf8", "#6366f1", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#0ea5e9"];

export function isSafeHttpUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeUrl(rawInput) {
  const trimmed = String(rawInput ?? "").trim();
  if (!trimmed) {
    throw new Error("请输入网站地址");
  }
  const hasExplicitScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);
  const candidate = hasExplicitScheme ? trimmed : `https://${trimmed}`;
  if (!isSafeHttpUrl(candidate)) {
    throw new Error("仅支持 http:// 或 https:// 开头的安全网址");
  }
  const parsed = new URL(candidate);
  if (!parsed.hostname || !parsed.hostname.includes(".")) {
    if (parsed.hostname !== "localhost") {
      throw new Error("请输入完整有效的域名（例如 example.com）");
    }
  }
  return parsed.toString();
}

export function extractDomainLabel(rawUrl) {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function pickAccent(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return ACCENT_PALETTE[hash % ACCENT_PALETTE.length];
}

export function createDefaultState() {
  return {
    version: 1,
    theme: "dark",
    searchEngineId: DEFAULT_SEARCH_ENGINES[0].id,
    sites: DEFAULT_SITES.map((s) => ({ ...s })),
  };
}

export function sanitizeImportedSites(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("导入数据中未找到有效的网站列表");
  }
  const seen = new Set();
  const clean = [];
  for (let i = 0; i < items.length; i += 1) {
    const raw = items[i];
    if (!raw || typeof raw !== "object") continue;
    const name = String(raw.name ?? "").trim();
    if (!name) continue;
    const url = normalizeUrl(raw.url);
    const id = String(raw.id ?? "").trim() || `site-import-${Date.now()}-${i}`;
    if (seen.has(id)) continue;
    seen.add(id);
    clean.push({
      id,
      name: name.slice(0, 48),
      url,
      category: String(raw.category ?? "").trim().slice(0, 24) || DEFAULT_CATEGORIES[1],
      description: String(raw.description ?? "").trim().slice(0, 96),
      pinned: Boolean(raw.pinned),
      accent: /^#[0-9a-fA-F]{6}$/.test(String(raw.accent ?? "")) ? raw.accent : pickAccent(name),
    });
  }
  if (clean.length === 0) {
    throw new Error("导入的网站记录均格式无效");
  }
  return clean;
}

export function loadState(storage = globalThis?.localStorage) {
  const fallback = createDefaultState();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const sites = Array.isArray(parsed?.sites) ? sanitizeImportedSites(parsed.sites) : fallback.sites;
    const engineOk = DEFAULT_SEARCH_ENGINES.some((e) => e.id === parsed?.searchEngineId);
    return {
      version: 1,
      theme: parsed?.theme === "light" ? "light" : "dark",
      searchEngineId: engineOk ? parsed.searchEngineId : fallback.searchEngineId,
      sites,
    };
  } catch {
    return fallback;
  }
}

export function saveState(state, storage = globalThis?.localStorage) {
  if (!storage) return state;
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}

export function validateSiteDraft({ name, url, category, description, pinned, accent }) {
  const cleanName = String(name ?? "").trim();
  if (!cleanName) {
    throw new Error("请输入网站名称");
  }
  const cleanUrl = normalizeUrl(url);
  const cleanCategory = String(category ?? "").trim() || DEFAULT_CATEGORIES[1];
  return {
    name: cleanName.slice(0, 48),
    url: cleanUrl,
    category: cleanCategory.slice(0, 24),
    description: String(description ?? "").trim().slice(0, 96),
    pinned: Boolean(pinned),
    accent: /^#[0-9a-fA-F]{6}$/.test(String(accent ?? "")) ? accent : pickAccent(cleanName),
  };
}

export function addSite(state, draft) {
  const validated = validateSiteDraft(draft);
  const id = `site-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const nextSite = { id, ...validated };
  return {
    ...state,
    sites: [nextSite, ...state.sites],
  };
}

export function updateSite(state, siteId, draft) {
  const validated = validateSiteDraft(draft);
  let updated = false;
  const nextSites = state.sites.map((s) => {
    if (s.id !== siteId) return s;
    updated = true;
    return { ...s, ...validated };
  });
  if (!updated) {
    throw new Error("未找到要修改的网站条目");
  }
  return { ...state, sites: nextSites };
}

export function deleteSite(state, siteId) {
  return {
    ...state,
    sites: state.sites.filter((s) => s.id !== siteId),
  };
}

export function togglePin(state, siteId) {
  return {
    ...state,
    sites: state.sites.map((s) => (s.id === siteId ? { ...s, pinned: !s.pinned } : s)),
  };
}

export function listCategories(sites) {
  const extra = new Set(DEFAULT_CATEGORIES);
  for (const s of sites) {
    if (s.category) extra.add(s.category);
  }
  return Array.from(extra);
}

export function filterSites(sites, { category = "全部", query = "" } = {}) {
  const q = String(query ?? "").trim().toLowerCase();
  return sites.filter((s) => {
    if (category && category !== "全部" && s.category !== category) {
      return false;
    }
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      extractDomainLabel(s.url).toLowerCase().includes(q)
    );
  });
}

export function buildSearchUrl(engineId, rawQuery) {
  const q = String(rawQuery ?? "").trim();
  const engine =
    DEFAULT_SEARCH_ENGINES.find((e) => e.id === engineId) ?? DEFAULT_SEARCH_ENGINES[0];
  if (!q) return null;
  return engine.template.replace("{q}", encodeURIComponent(q));
}

export function exportStateJson(state) {
  return JSON.stringify(
    {
      app: "nav-hub",
      exportedAt: new Date().toISOString(),
      theme: state.theme,
      searchEngineId: state.searchEngineId,
      sites: state.sites,
    },
    null,
    2
  );
}

export function importStateJson(currentState, rawJson) {
  let parsed;
  try {
    parsed = JSON.parse(String(rawJson ?? ""));
  } catch {
    throw new Error("备份文件不是合法的 JSON 格式");
  }
  const sites = sanitizeImportedSites(Array.isArray(parsed) ? parsed : parsed?.sites);
  const engineOk = DEFAULT_SEARCH_ENGINES.some((e) => e.id === parsed?.searchEngineId);
  return {
    ...currentState,
    ...(parsed?.theme === "light" || parsed?.theme === "dark" ? { theme: parsed.theme } : {}),
    ...(engineOk ? { searchEngineId: parsed.searchEngineId } : {}),
    sites,
  };
}
