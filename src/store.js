import { DEFAULT_CATEGORIES, DEFAULT_SEARCH_ENGINES, DEFAULT_SITES } from "./data/defaultSites.js";

export const STORAGE_KEY = "navhub.state.v2";
export const LEGACY_STORAGE_KEY = "navhub.state.v1";
export const THEMES = [
  { id: "starlight", name: "星穹", colorScheme: "dark", themeColor: "#090b1a" },
  { id: "sakura", name: "昼樱", colorScheme: "light", themeColor: "#fff7fa" },
  { id: "akiba", name: "秋叶原", colorScheme: "dark", themeColor: "#070614" },
  { id: "miku", name: "初音", colorScheme: "dark", themeColor: "#071521" },
];

const ACCENT_PALETTE = ["#38bdf8", "#6366f1", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#0ea5e9"];
const DEFAULT_VISUAL_PREFERENCES = {
  mascotId: "auto",
  mascotHidden: false,
  backdropMode: "balanced",
  customWallpaper: "",
};
const VALID_MASCOT_IDS = new Set([
  "auto", "sena", "sakura", "gemini", "claude", "deepseek", "gpt", "qwen", "kimi", "glm", "grok", "doubao",
]);
const LEGACY_SEARCH_TEMPLATES = new Map([
  ["baidu", "https://www.baidu.com/s?wd={q}"],
  ["zhihu", "https://www.zhihu.com/search?type=content&q={q}"],
]);

export function isSafeHttpUrl(rawUrl) {
  if (typeof rawUrl !== "string" || !/^https?:\/\/[^/\s?#\\]/i.test(rawUrl)
    || /^https?:\/\/[^/?#]*@/i.test(rawUrl)
    || /[\u0000-\u0020\u007f\\]/.test(rawUrl)) return false;
  try {
    const parsed = new URL(rawUrl);
    return Boolean(parsed.hostname) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

export function normalizeUrl(rawInput) {
  const trimmed = typeof rawInput === "string" ? rawInput.trim() : "";
  if (!trimmed) {
    throw new Error("请输入网站地址");
  }
  const bareHostWithPort = /^(?:localhost|[^/:]+\.[^/:]+):\d+(?:[/?#]|$)/i.test(trimmed);
  const hasExplicitScheme = !bareHostWithPort && /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);
  const candidate = hasExplicitScheme ? trimmed : `https://${trimmed}`;
  if (!isSafeHttpUrl(candidate)) {
    throw new Error("仅支持 http:// 或 https:// 开头的安全网址");
  }
  const parsed = new URL(candidate);
  if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost" && !parsed.hostname.startsWith("[")) {
    throw new Error("请输入完整有效的域名（例如 example.com）");
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  if (parsed.search) {
    const kept = parsed.search.slice(1).split("&").filter((pair) => {
      const key = new URLSearchParams(pair).keys().next().value ?? "";
      return !/^(utm_.*|gclid|dclid|fbclid|msclkid)$/i.test(key);
    });
    parsed.search = kept.join("&");
  }
  return parsed.toString();
}

export function sanitizeCustomWallpaperInput(raw) {
  if (typeof raw !== "string") throw new Error("请输入有效的壁纸网址");
  if (!raw.trim()) return "";
  const url = normalizeUrl(raw);
  if (!isSafeHttpUrl(url)) throw new Error("壁纸仅支持 http:// 或 https:// 开头的安全网址");
  return url;
}

export function extractDomainLabel(rawUrl) {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const HOST_PET_RULES = [
  [/^(?:chat\.)?deepseek\.com$/i, "deepseek"],
  [/^(?:chatgpt\.com|(?:chat\.)?openai\.com)$/i, "gpt"],
  [/^(?:claude\.ai|(?:console\.)?anthropic\.com)$/i, "claude"],
  [/^(?:gemini\.google\.com|aistudio\.google\.com)$/i, "gemini"],
  [/^(?:kimi\.moonshot\.cn|kimi\.ai|moonshot\.cn)$/i, "kimi"],
  [/^(?:tongyi\.aliyun\.com|qianwen\.aliyun\.com)$/i, "qwen"],
];

const HOST_EMBLEM_RULES = [
  [/(?:^|\.)github\.com$/i, "code"],
  [/(?:^|\.)cloudflare\.com$|^cloud\.tencent\.com$/i, "cloud"],
  [/(?:^|\.)deepl\.com$/i, "translate"],
  [/(?:^|\.)notion\.so$|^docs\.qq\.com$/i, "docs"],
  [/(?:^|\.)pixiv\.net$|(?:^|\.)canva\.(?:com|cn)$/i, "art"],
  [/(?:^|\.)vndb\.org$|(?:^|\.)ymgal\.games$|(?:^|\.)2dfan\.org$|store\.steampowered\.com$/i, "galgame"],
  [/(?:^|\.)bgm\.tv$|(?:^|\.)bilibili\.com$|gamer\.com\.tw$|(?:^|\.)myanimelist\.net$|(?:^|\.)anilist\.co$/i, "anime"],
];

export function resolveSiteEmblem(site) {
  const host = extractDomainLabel(site?.url || "");
  for (const [pattern, petId] of HOST_PET_RULES) {
    if (pattern.test(host)) return { type: "pet", petId, icon: "ai" };
  }
  for (const [pattern, icon] of HOST_EMBLEM_RULES) {
    if (pattern.test(host)) return { type: "icon", petId: null, icon };
  }
  const cat = site?.category || "";
  const icon = cat === "Galgame 档案" ? "galgame"
    : cat === "动漫追番" ? "anime"
    : cat === "二次元插画与社区" ? "art"
    : cat === "AI 大模型入口" ? "ai"
    : "docs";
  return { type: "icon", petId: null, icon };
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
    version: 2,
    theme: THEMES[0].id,
    motionPaused: false,
    ...DEFAULT_VISUAL_PREFERENCES,
    searchEngineId: DEFAULT_SEARCH_ENGINES[0].id,
    sites: DEFAULT_SITES.map((site) => ({ ...site, url: normalizeUrl(site.url), tags: [...site.tags] })),
  };
}

function knownThemeId(value) {
  if (value === "dark") return "starlight";
  if (value === "light") return "sakura";
  return THEMES.find(({ id }) => id === value)?.id;
}

export function resolveThemeId(value) {
  return knownThemeId(value) ?? THEMES[0].id;
}

export function sanitizeVisualPreferences({ mascotId, mascotHidden, backdropMode, customWallpaper } = {}) {
  let wallpaper = DEFAULT_VISUAL_PREFERENCES.customWallpaper;
  if (typeof customWallpaper === "string") {
    try {
      wallpaper = sanitizeCustomWallpaperInput(customWallpaper);
    } catch {
      // Recover the other preferences when the saved wallpaper URL is invalid.
    }
  }
  return {
    mascotId: VALID_MASCOT_IDS.has(mascotId) ? mascotId : DEFAULT_VISUAL_PREFERENCES.mascotId,
    mascotHidden: mascotHidden === true,
    backdropMode: ["balanced", "vivid"].includes(backdropMode) ? backdropMode : DEFAULT_VISUAL_PREFERENCES.backdropMode,
    customWallpaper: wallpaper,
  };
}

function sanitizeTags(value) {
  const tags = typeof value === "string" ? value.split(/[,，\s]+/u) : value;
  if (!Array.isArray(tags)) return [];
  const unique = new Map();
  for (const item of tags) {
    if (typeof item !== "string") continue;
    const tag = Array.from(item.trim()).slice(0, 16).join("");
    const key = tag.toLowerCase();
    if (tag && !unique.has(key)) unique.set(key, tag);
    if (unique.size === 3) break;
  }
  return [...unique.values()];
}

function siteId(value) {
  return typeof value === "string" && !["__proto__", "constructor", "prototype"].includes(value.trim())
    ? value.trim() : "";
}

function uniqueId(base, taken) {
  let id = base;
  for (let suffix = 2; taken.has(id); suffix += 1) id = base + "-" + suffix;
  return id;
}

function cleanSites(items, defaultsByUrl = new Map()) {
  const reserved = new Set(items.map((item) => siteId(item?.id)));
  const seen = new Set();
  const sites = [];
  for (const [index, raw] of items.entries()) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    try {
      const url = normalizeUrl(raw.url);
      const draft = validateSiteDraft({ ...defaultsByUrl.get(url), ...raw, url });
      const explicitId = siteId(raw.id);
      if (explicitId && seen.has(explicitId)) continue;
      const id = explicitId || uniqueId("site-import-" + (index + 1), reserved);
      seen.add(id);
      reserved.add(id);
      sites.push({ id, ...draft });
    } catch {
      // Keep valid rows when a saved or imported record is malformed.
    }
  }
  return sites;
}

export function sanitizeImportedSites(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("导入数据中未找到有效的网站列表");
  }
  const clean = cleanSites(items);
  if (clean.length === 0) {
    throw new Error("导入的网站记录均格式无效，仅支持 http:// 或 https:// 网址");
  }
  return clean;
}

function readStoredState(storage, key) {
  try {
    const parsed = JSON.parse(storage?.getItem(key) ?? "null");
    return Array.isArray(parsed?.sites) ? parsed : null;
  } catch {
    return null;
  }
}

function resolveStorage(storage) {
  return storage === undefined ? globalThis.localStorage : storage;
}

function mergeLegacySites(items, defaults) {
  const defaultsByUrl = new Map(defaults.map((site) => [site.url, site]));
  const byUrl = new Map();
  for (const site of cleanSites(items, defaultsByUrl)) {
    if (!byUrl.has(site.url)) byUrl.set(site.url, site);
  }
  const ids = new Set([...byUrl.values()].map((site) => site.id));
  for (const site of defaults) {
    if (byUrl.has(site.url)) continue;
    const id = uniqueId(site.id, ids);
    ids.add(id);
    byUrl.set(site.url, { ...site, id });
  }
  return [...byUrl.values()];
}

export function loadState(storage) {
  const fallback = createDefaultState();
  try {
    storage = resolveStorage(storage);
    const current = readStoredState(storage, STORAGE_KEY);
    const legacy = current ? null : readStoredState(storage, LEGACY_STORAGE_KEY);
    const parsed = current ?? legacy;
    if (!parsed) return fallback;
    const engineOk = DEFAULT_SEARCH_ENGINES.some((engine) => engine.id === parsed.searchEngineId);
    const sites = legacy ? mergeLegacySites(parsed.sites, fallback.sites) : cleanSites(parsed.sites);
    const state = {
      ...fallback,
      theme: resolveThemeId(parsed.theme),
      motionPaused: parsed.motionPaused === true,
      ...sanitizeVisualPreferences(parsed),
      searchEngineId: engineOk ? parsed.searchEngineId : fallback.searchEngineId,
      sites: parsed.sites.length > 0 && sites.length === 0 ? fallback.sites : sites,
    };
    return legacy ? saveState(state, storage) : state;
  } catch {
    return fallback;
  }
}

export function saveState(state, storage) {
  try {
    resolveStorage(storage)?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be blocked or full. Keep the current in-memory state.
  }
  return state;
}

export function validateSiteDraft({ name, url, category, description, pinned, accent, tags } = {}) {
  const cleanName = typeof name === "string" ? name.trim() : "";
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
    accent: typeof accent === "string" && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(accent) ? accent : pickAccent(cleanName),
    tags: sanitizeTags(tags),
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
    return { ...s, ...validated, tags: Object.hasOwn(draft, "tags") ? validated.tags : (s.tags ?? []) };
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
    return [s.name, s.description, s.category, s.url, ...sanitizeTags(s.tags)]
      .some((value) => typeof value === "string" && value.toLowerCase().includes(q));
  });
}

export function buildSearchUrl(engineId, rawQuery) {
  const q = String(rawQuery ?? "").trim();
  if (!q) return null;
  const template = DEFAULT_SEARCH_ENGINES.find((engine) => engine.id === engineId)?.urlTemplate
    ?? LEGACY_SEARCH_TEMPLATES.get(engineId)
    ?? DEFAULT_SEARCH_ENGINES[0].urlTemplate;
  return template.replace("{q}", encodeURIComponent(q));
}

export function exportStateJson(state) {
  return JSON.stringify(
    {
      app: "nav-hub",
      exportedAt: new Date().toISOString(),
      theme: state.theme,
      motionPaused: state.motionPaused === true,
      ...sanitizeVisualPreferences(state),
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
  const imported = Array.isArray(parsed) ? parsed : parsed?.sites;
  const sites = Array.isArray(parsed?.sites) && imported.length === 0 ? [] : sanitizeImportedSites(imported);
  const engineOk = DEFAULT_SEARCH_ENGINES.some((e) => e.id === parsed?.searchEngineId);
  const hasTheme = Object.hasOwn(parsed, "theme");
  const preferences = Array.isArray(parsed) ? currentState : { ...currentState, ...parsed };
  return {
    ...currentState,
    version: 2,
    ...(hasTheme ? { theme: resolveThemeId(parsed.theme) } : {}),
    ...(typeof parsed?.motionPaused === "boolean" ? { motionPaused: parsed.motionPaused } : {}),
    ...sanitizeVisualPreferences(preferences),
    ...(engineOk ? { searchEngineId: parsed.searchEngineId } : {}),
    sites,
  };
}
