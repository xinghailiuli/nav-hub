import assert from "node:assert/strict";
import test from "node:test";
import {
  addSite,
  buildSearchUrl,
  createDefaultState,
  deleteSite,
  exportStateJson,
  filterSites,
  importStateJson,
  loadState,
  normalizeUrl,
  saveState,
  togglePin,
  updateSite,
} from "../src/store.js";

function makeMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

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
  const aiOnly = filterSites(base.sites, { category: "AI 助手" });
  assert.ok(aiOnly.length >= 3);
  assert.ok(aiOnly.every((s) => s.category === "AI 助手"));

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
  assert.equal(reimported.sites.length, modified.sites.length);
  assert.equal(reimported.sites[0].name, "Backup Test");

  assert.throws(() => importStateJson(base, "not-json"), /JSON/);
  assert.throws(() => importStateJson(base, JSON.stringify({ sites: [{ name: "Bad", url: "javascript:alert(1)" }] })), /仅支持 http/);
});
