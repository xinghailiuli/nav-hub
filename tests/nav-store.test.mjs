import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import {
  addSite,
  buildSearchUrl,
  createDefaultState,
  deleteSite,
  exportStateJson,
  filterSites,
  importStateJson,
  isSafeHttpUrl,
  extractDomainLabel,
  LEGACY_STORAGE_KEY,
  loadState,
  normalizeUrl,
  resolveThemeId,
  sanitizeCustomWallpaperInput,
  sanitizeImportedSites,
  saveState,
  STORAGE_KEY,
  THEMES,
  togglePin,
  updateSite,
  validateSiteDraft,
} from "../src/store.js";
import { CG_ARTWORKS, HAGEMI_PET, MASCOTS, SITE_ARTWORKS, THEME_VISUALS, pickGreeting, pickSiteArt, resolveMascotId } from "../src/data/acgDialogues.js";
import { DEFAULT_CATEGORIES, DEFAULT_SEARCH_ENGINES, DEFAULT_SITES } from "../src/data/defaultSites.js";

function makeMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

const defaultVisualPreferences = {
  mascotId: "auto",
  mascotHidden: false,
  backdropMode: "balanced",
  customWallpaper: "",
};

test("ACG artwork uses relative WebP and JPG paths backed by public files", async () => {
  assert.deepEqual(Object.keys(THEME_VISUALS), THEMES.map(({ id }) => id));
  assert.deepEqual(Object.keys(MASCOTS), ["sena", "sakura"]);
  const artworkPairs = [
    ...Object.values(THEME_VISUALS).map(({ bgWebp, bgJpg }) => [bgWebp, bgJpg]),
    ...Object.values(MASCOTS).map(({ avatarWebp, avatarJpg }) => [avatarWebp, avatarJpg]),
  ];
  const publicDirectory = new URL("../public/", import.meta.url);
  await Promise.all(artworkPairs.map(async ([webp, jpg]) => {
    assert.match(webp, /^\.\/art\/[\w-]+\.webp$/);
    assert.match(jpg, /^\.\/art\/[\w-]+\.jpg$/);
    assert.equal(jpg, webp.replace(/\.webp$/, ".jpg"));
    for (const path of [webp, jpg]) {
      assert.ok((await stat(new URL(path, publicDirectory))).isFile(), path);
    }
  }));
});

async function assertArtworkPair(stem, webp, fallback, extension) {
  assert.equal(webp, `./art/${stem}.webp`);
  assert.equal(fallback, `./art/${stem}.${extension}`);
  const publicDirectory = new URL("../public/", import.meta.url);
  for (const path of [webp, fallback]) {
    const file = await stat(new URL(path, publicDirectory));
    assert.ok(file.isFile() && file.size > 0, path);
  }
}

test("CG illustrations and all six Hagemi poses have matching public artwork files", async () => {
  assert.deepEqual(CG_ARTWORKS.map(({ id }) => id), [
    "cg-galgame", "cg-ymgal", "cg-bangumi", "cg-bili", "cg-pixiv", "cg-moegirl", "cg-nightcafe", "cg-radar",
  ]);
  assert.equal(new Set([...Object.values(THEME_VISUALS), ...CG_ARTWORKS].map(({ bgWebp }) => bgWebp)).size, 12);
  assert.deepEqual(Object.keys(HAGEMI_PET.poses), ["idle", "happy", "pat", "searching", "thinking", "surprised"]);
  await Promise.all([
    ...CG_ARTWORKS.map(({ id, bgWebp, bgJpg }) => assertArtworkPair(id, bgWebp, bgJpg, "jpg")),
    ...Object.entries(HAGEMI_PET.poses).map(([pose, { webp, png }]) => assertArtworkPair(`pet-${pose}`, webp, png, "png")),
  ]);
});

test("site art maps categories and offsets neighboring crops", () => {
  for (const [category, id] of [
    ["Galgame 档案", "cg-galgame"], ["动漫追番", "cg-nightcafe"],
    ["二次元插画与社区", "cg-pixiv"], ["AI 大模型入口", "cg-radar"],
  ]) assert.equal(pickSiteArt(category, 0).id, id);
  assert.equal(pickSiteArt("云端部署与效率", 0).id, "cg-radar");
  assert.equal(pickSiteArt("自定义标签", 0).id, "cg-nightcafe");
  const positions = [0, 1, 2, 3].map((index) => pickSiteArt("Galgame 档案", index).objectPosition);
  assert.equal(new Set(positions.slice(0, 3)).size, 3);
  assert.equal(positions[0], positions[3]);
});

test("all 25 default sites have their specified artwork without duplicate paths", () => {
  const expected = {
    "site-vndb": "cg-galgame",
    "site-ymgal": "cg-ymgal",
    "site-2dfan": "cg-2dfan",
    "site-steam-vn": "bg-sakura",
    "site-bangumi": "cg-bangumi",
    "site-bili-anime": "cg-bili",
    "site-gamer-ani": "bg-akiba",
    "site-mal": "cg-mal",
    "site-anilist": "cg-anilist",
    "site-pixiv": "cg-pixiv",
    "site-moegirl": "cg-moegirl",
    "site-zhihu": "cg-zhihu",
    "site-canva": "cg-canva",
    "site-deepseek": "cg-radar",
    "site-chatgpt": "bg-starlight",
    "site-claude": "cg-claude",
    "site-gemini": "cg-gemini",
    "site-kimi": "cg-kimi",
    "site-tongyi": "cg-tongyi",
    "site-github": "cg-nightcafe",
    "site-cloudflare": "cg-cloudflare",
    "site-edgeone": "bg-miku",
    "site-deepl": "cg-deepl",
    "site-notion": "cg-notion",
    "site-txdocs": "cg-txdocs",
  };
  const selected = DEFAULT_SITES.map((site, index) => {
    const art = pickSiteArt(site, index);
    assert.equal(art, SITE_ARTWORKS[site.id]);
    assert.equal(art.id, expected[site.id], site.id);
    return art;
  });
  assert.deepEqual(Object.keys(SITE_ARTWORKS).sort(), Object.keys(expected).sort());
  assert.equal(new Set(selected.map(({ bgWebp }) => bgWebp)).size, 25);
  assert.equal(new Set(selected.map(({ bgJpg }) => bgJpg)).size, 25);
});

test("site artwork and gallery artwork have bundled WebP and JPEG files", async () => {
  await Promise.all([...Object.values(SITE_ARTWORKS), ...CG_ARTWORKS]
    .map(({ id, bgWebp, bgJpg }) => assertArtworkPair(id, bgWebp, bgJpg, "jpg")));
});

test("custom sites cycle through all 25 artworks before repeating", () => {
  const selected = Array.from({ length: 26 }, (_, index) =>
    pickSiteArt({ id: `custom-${index}`, category: "Galgame 档案" }, index));
  assert.deepEqual(selected.slice(0, 25), Object.values(SITE_ARTWORKS));
  assert.equal(new Set(selected.slice(0, 25).map(({ bgWebp }) => bgWebp)).size, 25);
  assert.equal(selected[25], selected[0]);
  assert.equal(pickSiteArt({ id: "constructor" }, 0), selected[0]);
});

test("mascot selection follows theme defaults and greetings follow hour boundaries", () => {
  for (const [theme, expected] of [
    ["starlight", "sena"], ["sakura", "sakura"], ["akiba", "sena"], ["miku", "sakura"],
  ]) {
    assert.equal(resolveMascotId("auto", theme), expected);
    assert.equal(resolveMascotId("invalid", theme), expected);
    assert.equal(resolveMascotId("sena", theme), "sena");
    assert.equal(resolveMascotId("sakura", theme), "sakura");
  }
  assert.equal(resolveMascotId("auto", "unknown"), "sena");

  for (const { id, greetings } of Object.values(MASCOTS)) {
    assert.equal(pickGreeting(id), greetings.default);
    for (const [hour, period] of [
      [0, "night"], [4, "night"], [5, "morning"], [11, "morning"], [12, "afternoon"],
      [18, "afternoon"], [19, "night"], [23, "night"],
    ]) {
      assert.equal(pickGreeting(id, hour), greetings[period]);
    }
  }
});

test("normalizeUrl auto-prepends https and blocks unsafe protocols", () => {
  assert.equal(normalizeUrl("bilibili.com"), "https://bilibili.com/");
  assert.equal(normalizeUrl("http://localhost:3000/test"), "http://localhost:3000/test");
  assert.throws(() => normalizeUrl(""), /请输入网站地址/);
  assert.throws(() => normalizeUrl("javascript:alert(1)"), /仅支持 http:\/\/ 或 https:\/\//);
  assert.throws(() => normalizeUrl("data:text/html,hi"), /仅支持 http:\/\/ 或 https:\/\//);
  assert.throws(() => normalizeUrl("notadomain"), /完整有效的域名/);
});

test("CRUD, pin toggle, and storage reload persistence work cleanly", () => {
  const storage = makeMemoryStorage();
  let state = loadState(storage);
  const initialCount = state.sites.length;
  assert.ok(initialCount >= 12);

  state = addSite(state, {
    name: "我的测试站",
    url: "example.com/tools",
    category: "常用效率",
    description: "测试自动补全与持久化",
    pinned: true,
  });
  saveState(state, storage);

  const reloaded = loadState(storage);
  assert.equal(reloaded.sites.length, initialCount + 1);
  const created = reloaded.sites[0];
  assert.equal(created.name, "我的测试站");
  assert.equal(created.url, "https://example.com/tools");
  assert.equal(created.pinned, true);

  let updated = updateSite(reloaded, created.id, {
    name: "改名站点",
    url: "https://nav.example.org",
    category: "开发技术",
    description: "更新备注",
    pinned: true,
  });
  updated = togglePin(updated, created.id);
  assert.equal(updated.sites[0].name, "改名站点");
  assert.equal(updated.sites[0].pinned, false);

  const afterDelete = deleteSite(updated, created.id);
  assert.equal(afterDelete.sites.length, initialCount);
});

test("filterSites, buildSearchUrl, and JSON export/import roundtrip work reliably", () => {
  const base = createDefaultState();
  const aiOnly = filterSites(base.sites, { category: "AI 大模型入口" });
  assert.equal(aiOnly.length, 6);
  assert.ok(aiOnly.every((s) => s.category === "AI 大模型入口"));

  const queryMatch = filterSites(base.sites, { category: "全部", query: "github" });
  assert.equal(queryMatch.length, 1);
  assert.equal(queryMatch[0].name, "GitHub");

  assert.equal(buildSearchUrl("baidu", "免费 建站"), "https://www.baidu.com/s?wd=%E5%85%8D%E8%B4%B9%20%E5%BB%BA%E7%AB%99");
  assert.equal(buildSearchUrl("bing", ""), null);

  const modified = addSite(base, {
    name: "Backup Test",
    url: "backup.example.com",
    category: "常用效率",
    pinned: true,
  });
  const exported = exportStateJson(modified);
  const reimported = importStateJson(base, exported);
  assert.deepEqual(reimported, modified);
  assert.equal(reimported.sites[0].name, "Backup Test");

  assert.throws(() => importStateJson(base, "not-json"), /JSON/);
  assert.throws(() => importStateJson(base, JSON.stringify({ sites: [{ name: "Bad", url: "javascript:alert(1)" }] })), /仅支持 http/);
});

test("visual preferences persist through storage and strict backup roundtrips", () => {
  const base = createDefaultState();
  const storage = makeMemoryStorage();
  const rawWallpaper = "  cdn.example.com/images/wallpaper.webp?size=large&utm_source=test  ";
  const customWallpaper = "https://cdn.example.com/images/wallpaper.webp?size=large";
  const modified = { ...base, mascotId: "sakura", mascotHidden: true, backdropMode: "vivid", customWallpaper };

  assert.equal(sanitizeCustomWallpaperInput(" \t "), "");
  assert.equal(sanitizeCustomWallpaperInput(rawWallpaper), customWallpaper);
  assert.equal(sanitizeCustomWallpaperInput("https://cdn.example.com/a@b.jpg"), "https://cdn.example.com/a@b.jpg");
  const rawState = { ...modified, customWallpaper: rawWallpaper };
  saveState(rawState, storage);
  assert.deepEqual(loadState(storage), modified);
  assert.deepEqual(importStateJson(base, exportStateJson(rawState)), modified);
  assert.deepEqual(importStateJson(base, JSON.stringify(rawState)), modified);
  assert.deepEqual(importStateJson(modified, exportStateJson(base)), base);
  assert.deepEqual(importStateJson(modified, JSON.stringify(base.sites)), modified);
  assert.deepEqual(importStateJson(modified, JSON.stringify({ sites: modified.sites })), modified);
});

test("invalid visual preferences fall back safely without losing other settings", () => {
  const base = createDefaultState();
  const storage = makeMemoryStorage();
  const invalid = {
    ...base, mascotId: "unknown", mascotHidden: "true", backdropMode: "unknown", customWallpaper: false,
  };
  const current = { ...base, theme: "akiba", mascotId: "sena", mascotHidden: true, backdropMode: "vivid" };
  assert.throws(() => sanitizeCustomWallpaperInput(false), /壁纸网址/);
  for (const wallpaper of [
    "javascript:alert(1)", "data:image/svg+xml,unsafe", "file:///wallpaper.jpg",
    "blob:https://cdn.example.com/wallpaper", "https://user:pass@cdn.example.com/wallpaper.jpg",
    "https://@cdn.example.com/wallpaper.jpg",
  ]) {
    assert.throws(() => sanitizeCustomWallpaperInput(wallpaper), /仅支持 http/);
    const unsafe = { ...invalid, theme: "unknown", customWallpaper: wallpaper };
    saveState(unsafe, storage);
    assert.deepEqual(loadState(storage), base);
    assert.deepEqual(importStateJson(current, JSON.stringify(unsafe)), base);
    assert.equal(JSON.parse(exportStateJson(unsafe)).customWallpaper, "");
  }

  const badWallpaper = { ...current, customWallpaper: "javascript:alert(1)" };
  saveState(badWallpaper, storage);
  assert.deepEqual(loadState(storage), current);
  assert.deepEqual(importStateJson(base, JSON.stringify(badWallpaper)), current);
  assert.deepEqual(importStateJson(current, exportStateJson(invalid)), base);
});

test("only explicit HTTP(S) URLs qualify as safe external links", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,hi", "vbscript:x", "", "/path",
    "//evil.example", "https:example.com", "https:///example.com", "https://user@example.com",
    "https://example.com\\other", "https://exa\nmple.com"]) {
    assert.equal(isSafeHttpUrl(url), false, url);
  }
  assert.equal(isSafeHttpUrl("HtTpS://EXAMPLE.COM"), true);
  assert.equal(isSafeHttpUrl("http://localhost:3000/test"), true);
  assert.throws(() => normalizeUrl("//evil.example"));
});

test("URL normalization is idempotent and preserves meaningful URL parts", () => {
  const url = "HTTPS://WWW.Example.COM/path/?q=A%20B&utm_source=ad&gclid=123#part";
  const canonical = "https://www.example.com/path?q=A%20B#part";
  assert.equal(normalizeUrl(url), canonical);
  assert.equal(normalizeUrl(canonical), canonical);
  assert.equal(extractDomainLabel(url), "example.com");
  assert.equal(extractDomainLabel("https://blog.example.co.uk"), "blog.example.co.uk");
  assert.equal(extractDomainLabel("https://例子.测试"), "xn--fsqu00a.xn--0zwm56d");
});

test("default catalog contains the five ordered categories and 25 tagged sites", () => {
  assert.deepEqual(DEFAULT_CATEGORIES, [
    "Galgame 档案", "动漫追番", "二次元插画与社区", "AI 大模型入口", "云端部署与效率",
  ]);
  const state = createDefaultState();
  assert.equal(state.version, 2);
  assert.equal(state.theme, "starlight");
  assert.equal(state.motionPaused, false);
  assert.equal(state.sites.length, 25);
  assert.deepEqual(DEFAULT_CATEGORIES.map((category) => filterSites(state.sites, { category }).length),
    [4, 5, 4, 6, 6]);
  assert.equal(new Set(state.sites.map((site) => site.url)).size, 25);
  assert.ok(state.sites.every((site) => isSafeHttpUrl(site.url) && site.tags.length === 3));
  state.sites[0].tags.push("local");
  assert.equal(createDefaultState().sites[0].tags.length, 3);
});

test("legacy migration preserves user edits, fills missing fields, and writes v2 once", () => {
  const storage = makeMemoryStorage();
  const legacy = JSON.stringify({
    theme: "light", searchEngineId: "google", motionPaused: true,
    sites: [
      { id: "mine", name: "我的 VNDB", url: "HTTPS://VNDB.ORG/?utm_source=old",
        pinned: false, description: "", category: "收藏" },
      { id: "site-github", name: "自定义", url: "custom.example", pinned: true },
      { id: "duplicate-url", name: "重复", url: "https://vndb.org" },
    ],
  });
  storage.setItem(LEGACY_STORAGE_KEY, legacy);
  storage.setItem(STORAGE_KEY, "{");
  const migrated = loadState(storage);
  assert.equal(migrated.theme, "sakura");
  assert.equal(migrated.searchEngineId, "google");
  assert.equal(migrated.motionPaused, true);
  const { mascotId, mascotHidden, backdropMode, customWallpaper } = migrated;
  assert.deepEqual({ mascotId, mascotHidden, backdropMode, customWallpaper }, defaultVisualPreferences);
  assert.equal(migrated.sites.length, 26);
  assert.deepEqual(migrated.sites[0], {
    id: "mine", name: "我的 VNDB", url: "https://vndb.org/", pinned: false,
    description: "", category: "收藏", accent: "#a855f7", tags: ["Galgame", "视觉小说", "档案"],
  });
  assert.equal(migrated.sites.find((site) => site.id === "site-github").name, "自定义");
  assert.ok(migrated.sites.some((site) => site.name === "GitHub"));
  assert.ok(migrated.sites.some((site) => site.id === "site-claude"));
  assert.equal(new Set(migrated.sites.map((site) => site.id)).size, 26);
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), migrated);
  assert.equal(storage.getItem(LEGACY_STORAGE_KEY), legacy);
  storage.setItem(STORAGE_KEY, JSON.stringify({ ...migrated, sites: [] }));
  assert.deepEqual(loadState(storage).sites, []);
});

test("head theme initialization matches loaded state before the app starts", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const [script] = html.match(/<head>[\s\S]*?<\/head>/)[0].matchAll(/<script>([\s\S]*?)<\/script>/g);
  assert.ok(script, "expected an inline script in the document head");

  const legacyLight = JSON.stringify({ theme: "light", motionPaused: true, sites: [] });
  const legacyDark = JSON.stringify({ theme: "dark", motionPaused: false, sites: [] });
  for (const [label, current, legacy] of [
    ["broken v2 falls back to legacy light", "{", legacyLight],
    ["v2 without a sites array falls back to legacy dark", '{"theme":"miku"}', legacyDark],
    ["valid v2 takes precedence", '{"theme":"miku","motionPaused":"true","sites":[]}', legacyLight],
    ["valid v2 initializes Akiba", '{"theme":"akiba","motionPaused":true,"sites":[]}', legacyLight],
    ["unknown v2 theme uses the default", '{"theme":"unknown","motionPaused":true,"sites":[]}', legacyLight],
    ["invalid v1 and v2 use defaults", "{", "{"],
  ]) {
    const storage = makeMemoryStorage();
    storage.setItem(STORAGE_KEY, current);
    storage.setItem(LEGACY_STORAGE_KEY, legacy);
    const dataset = {};
    const metas = {
      'meta[name="color-scheme"]': { content: "light dark" },
      "#meta-theme-color": { content: "#090b1a" },
    };
    runInNewContext(script[1], {
      localStorage: storage,
      document: { documentElement: { dataset }, querySelector: (selector) => metas[selector] },
    });

    const state = loadState(storage);
    const theme = THEMES.find(({ id }) => id === state.theme);
    assert.deepEqual(dataset, { theme: theme.id, motionPaused: String(state.motionPaused) }, label);
    assert.equal(metas['meta[name="color-scheme"]'].content, theme.colorScheme, label);
    assert.equal(metas["#meta-theme-color"].content, theme.themeColor, label);
  }
});

test("state handles malformed storage, legacy themes, and strictly boolean motion", () => {
  assert.deepEqual(THEMES.map(({ id, colorScheme, themeColor }) => [id, colorScheme, themeColor]), [
    ["starlight", "dark", "#090b1a"], ["sakura", "light", "#fff7fa"],
    ["akiba", "dark", "#070614"], ["miku", "dark", "#071521"],
  ]);
  assert.equal(resolveThemeId("dark"), "starlight");
  assert.equal(resolveThemeId("light"), "sakura");
  assert.equal(resolveThemeId("neon"), "starlight");
  const storage = makeMemoryStorage();
  for (const malformed of ["{", "null", "[]", '"string"', '{"sites":{}}']) {
    storage.setItem(STORAGE_KEY, malformed);
    assert.deepEqual(loadState(storage), createDefaultState());
  }
  for (const motionPaused of [true, false, "false", undefined, 0, 1]) {
    storage.setItem(STORAGE_KEY, JSON.stringify({ theme: "miku", sites: [], motionPaused }));
    assert.equal(loadState(storage).motionPaused, motionPaused === true);
    assert.equal(loadState(storage).theme, "miku");
  }
  const blocked = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("quota"); },
  };
  const state = createDefaultState();
  assert.deepEqual(loadState(blocked), state);
  assert.equal(saveState(state, blocked), state);
  assert.deepEqual(importStateJson(state, exportStateJson({ ...state, theme: "akiba", motionPaused: true })),
    { ...state, theme: "akiba", motionPaused: true });
});

test("draft tags are split, trimmed, case-insensitively deduplicated and bounded", () => {
  const draft = { name: "One", url: "example.com", accent: "#AbC" };
  assert.deepEqual(validateSiteDraft({ ...draft, tags: "AI，ai 视觉, 科技 多余" }).tags, ["AI", "视觉", "科技"]);
  assert.deepEqual(validateSiteDraft({ ...draft, tags: [null, 3, " tag ", "", "长".repeat(50)] }).tags,
    ["tag", "长".repeat(16)]);
  assert.deepEqual(validateSiteDraft(draft).tags, []);
  assert.equal(validateSiteDraft(draft).accent, "#AbC");
  assert.notEqual(validateSiteDraft({ ...draft, accent: "#123; color:red" }).accent, "#123; color:red");
  assert.throws(() => validateSiteDraft({ url: "example.com" }), /网站名称/);
  assert.throws(() => validateSiteDraft({ ...draft, url: "vbscript:bad" }), /http/);
});

test("site filtering searches full URLs, tags and all existing text fields", () => {
  const first = { name: "Name", category: "Tools", description: "Useful",
    url: "https://example.com/SearchPath?q=value", tags: ["MyTag"] };
  const sites = [first, { name: "Other", category: "More", url: "https://other.example" }];
  for (const query of ["name", "tools", "useful", "searchpath?q=value", "MYTAG"]) {
    assert.deepEqual(filterSites(sites, { query }), [first]);
  }
  assert.deepEqual(filterSites(sites, { query: "missing" }), []);
  assert.deepEqual(filterSites(sites, { query: "MyTag", category: "More" }), []);
  assert.deepEqual(filterSites(sites, { query: " " }), sites);
});

test("import drops malformed rows and duplicate IDs and generates deterministic safe IDs", () => {
  const rows = JSON.parse('[null,[],{"name":"bad","url":"javascript:bad"},' +
    '{"id":"ok","name":"One","url":"one.example","tags":"AI"},' +
    '{"id":"ok","name":"Duplicate","url":"other.example"},' +
    '{"id":"__proto__","name":"Two","url":"two.example","__proto__":{"pinned":true}},' +
    '{"id":"constructor","name":"Three","url":"three.example","constructor":{"pinned":true}},' +
    '{"name":"Four","url":"four.example"}]');
  const clean = sanitizeImportedSites(rows);
  assert.deepEqual(clean.map(({ name }) => name), ["One", "Two", "Three", "Four"]);
  assert.deepEqual(clean[0].tags, ["AI"]);
  assert.ok(clean.every(({ id, pinned }) => id && id !== "__proto__" && id !== "constructor" && !pinned));
  assert.equal(new Set(clean.map(({ id }) => id)).size, 4);
  assert.deepEqual(clean, sanitizeImportedSites(rows));
});

test("all eight engines encode Chinese, whitespace and reserved URL characters", () => {
  const q = "%E6%98%9F%20%26%23%3F";
  const expected = {
    bing: "https://cn.bing.com/search?q=" + q,
    google: "https://www.google.com/search?q=" + q,
    bilibili: "https://search.bilibili.com/all?keyword=" + q,
    bangumi: "https://bgm.tv/subject_search/" + q + "?cat=all",
    vndb: "https://vndb.org/v?sq=" + q,
    moegirl: "https://zh.moegirl.org.cn/index.php?search=" + q,
    pixiv: "https://www.pixiv.net/tags/" + q,
    github: "https://github.com/search?q=" + q,
  };
  assert.deepEqual(DEFAULT_SEARCH_ENGINES.map(({ id }) => id), Object.keys(expected));
  for (const [id, url] of Object.entries(expected)) assert.equal(buildSearchUrl(id, " 星 &#? "), url);
  assert.equal(buildSearchUrl("unknown", "星 &#?"), expected.bing);
  assert.equal(buildSearchUrl("pixiv", "  "), null);
});
