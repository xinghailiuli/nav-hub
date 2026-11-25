import "./styles.css";
import { DEFAULT_CATEGORIES, DEFAULT_SEARCH_ENGINES } from "./data/defaultSites.js";
import {
  addSite,
  buildSearchUrl,
  createDefaultState,
  deleteSite,
  exportStateJson,
  extractDomainLabel,
  filterSites,
  importStateJson,
  listCategories,
  loadState,
  saveState,
  togglePin,
  updateSite,
} from "./store.js";

const rootEl = document.getElementById("app");

let state = loadState();
let selectedCategory = "全部";
let filterQuery = "";
let editingSiteId = null;
let modalOpen = false;
let modalError = "";
let toastTimer = null;
let toastMessage = "";

function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme === "light" ? "light" : "dark");
}

function showToast(msg) {
  toastMessage = msg;
  clearTimeout(toastTimer);
  renderToast();
  toastTimer = setTimeout(() => {
    toastMessage = "";
    renderToast();
  }, 2400);
}

function renderToast() {
  const existing = document.getElementById("nav-toast");
  if (!toastMessage) {
    existing?.remove();
    return;
  }
  const el = existing ?? document.createElement("div");
  el.id = "nav-toast";
  el.className = "toast";
  el.textContent = toastMessage;
  if (!existing) document.body.appendChild(el);
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "className") node.className = v;
    else if (k === "textContent") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, String(v));
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child === null || child === undefined || child === false) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

function formatClockParts(now = new Date()) {
  const timeStr = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  const dateStr = now.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  return { timeStr, dateStr };
}

function buildSiteCard(site, { compact = false } = {}) {
  const initial = site.name.slice(0, 1).toUpperCase();
  const domain = extractDomainLabel(site.url);

  return el("article", { className: `site-card${compact ? " compact" : ""}`, "data-site-id": site.id }, [
    el("a", {
      className: "site-link",
      href: site.url,
      target: "_blank",
      rel: "noopener noreferrer",
      title: `${site.name} (${site.url})`,
    }, [
      el("div", {
        className: "site-avatar",
        style: `background: ${site.accent}`,
        textContent: initial,
      }),
      el("div", { className: "site-info" }, [
        el("div", { className: "site-name-row" }, [
          el("span", { className: "site-name", textContent: site.name }),
        ]),
        el("div", { className: "site-domain", textContent: domain }),
        site.description ? el("p", { className: "site-desc", textContent: site.description }) : null,
      ]),
    ]),
    el("div", { className: "card-footer" }, [
      el("span", { textContent: site.category }),
      el("div", { className: "card-actions" }, [
        el("button", {
          type: "button",
          className: `icon-btn${site.pinned ? " pinned" : ""}`,
          title: site.pinned ? "取消置顶" : "置顶到常用",
          "aria-label": site.pinned ? "取消置顶" : "置顶到常用",
          textContent: site.pinned ? "★" : "☆",
          onClick: () => {
            state = saveState(togglePin(state, site.id));
            render();
            showToast(site.pinned ? "已更新常用置顶" : "已取消常用置顶");
          },
        }),
        !compact
          ? el("button", {
              type: "button",
              className: "icon-btn",
              title: "编辑站点",
              textContent: "编辑",
              onClick: () => openModal(site.id),
            })
          : null,
        !compact
          ? el("button", {
              type: "button",
              className: "icon-btn btn-danger",
              title: "删除站点",
              textContent: "删除",
              onClick: () => {
                state = saveState(deleteSite(state, site.id));
                render();
                showToast(`已移除「${site.name}」`);
              },
            })
          : null,
      ]),
    ]),
  ]);
}

function openModal(siteId = null) {
  editingSiteId = siteId;
  modalOpen = true;
  modalError = "";
  render();
  setTimeout(() => document.getElementById("site-name-input")?.focus(), 20);
}

function closeModal() {
  modalOpen = false;
  editingSiteId = null;
  modalError = "";
  render();
}

function renderModal() {
  if (!modalOpen) return null;
  const editing = editingSiteId ? state.sites.find((s) => s.id === editingSiteId) : null;
  const categories = listCategories(state.sites);
  const initialCat = editing?.category ?? (selectedCategory !== "全部" ? selectedCategory : DEFAULT_CATEGORIES[1]);

  const nameInput = el("input", {
    id: "site-name-input",
    type: "text",
    placeholder: "例如：淘宝 / 微信读书 / 豆包",
    value: editing?.name ?? "",
  });
  const urlInput = el("input", {
    id: "site-url-input",
    type: "text",
    placeholder: "例如：bilibili.com 或 https://example.com",
    value: editing?.url ?? "",
  });
  const catSelect = el(
    "select",
    { id: "site-cat-select" },
    categories.map((c) => {
      const opt = el("option", { value: c, textContent: c });
      if (c === initialCat) opt.selected = true;
      return opt;
    })
  );
  const descInput = el("input", {
    id: "site-desc-input",
    type: "text",
    placeholder: "可选，一句简短备注",
    value: editing?.description ?? "",
  });
  const pinCheck = el("input", { type: "checkbox", checked: editing ? editing.pinned : false });

  const form = el(
    "form",
    {
      className: "modal-panel",
      onSubmit: (e) => {
        e.preventDefault();
        try {
          const draft = {
            name: nameInput.value,
            url: urlInput.value,
            category: catSelect.value,
            description: descInput.value,
            pinned: pinCheck.checked,
          };
          state = saveState(
            editing ? updateSite(state, editing.id, draft) : addSite(state, draft)
          );
          closeModal();
          showToast(editing ? "已保存站点修改" : "已添加新网址");
        } catch (err) {
          modalError = err instanceof Error ? err.message : String(err);
          render();
        }
      },
    },
    [
      el("div", { className: "modal-header" }, [
        el("h2", { textContent: editing ? "编辑网站" : "添加新网站" }),
        el("button", { type: "button", className: "icon-btn", textContent: "✕", onClick: closeModal }),
      ]),
      el("div", { className: "form-field" }, [el("label", { for: "site-name-input", textContent: "网站名称" }), nameInput]),
      el("div", { className: "form-field" }, [el("label", { for: "site-url-input", textContent: "网站地址" }), urlInput]),
      el("div", { className: "form-field" }, [el("label", { for: "site-cat-select", textContent: "所属分类" }), catSelect]),
      el("div", { className: "form-field" }, [el("label", { for: "site-desc-input", textContent: "简短说明（可选）" }), descInput]),
      el("label", { className: "checkbox-row" }, [pinCheck, el("span", { textContent: "同时置顶到顶部「我的常用」" })]),
      modalError ? el("p", { className: "form-error", textContent: modalError }) : null,
      el("div", { className: "modal-actions" }, [
        el("button", { type: "button", className: "btn", textContent: "取消", onClick: closeModal }),
        el("button", { type: "submit", className: "btn btn-primary", textContent: editing ? "保存修改" : "确认添加" }),
      ]),
    ]
  );

  return el(
    "div",
    {
      className: "modal-backdrop",
      onClick: (e) => {
        if (e.target === e.currentTarget) closeModal();
      },
    },
    form
  );
}

function triggerExport() {
  const blob = new Blob([exportStateJson(state)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "navhub-backup.json";
  a.click();
  URL.revokeObjectURL(url);
  showToast("已导出导航备份文件");
}

function render() {
  applyTheme();
  const activeEngine =
    DEFAULT_SEARCH_ENGINES.find((e) => e.id === state.searchEngineId) ?? DEFAULT_SEARCH_ENGINES[0];
  const { timeStr, dateStr } = formatClockParts();
  const pinnedSites = state.sites.filter((s) => s.pinned);
  const filteredSites = filterSites(state.sites, { category: selectedCategory, query: filterQuery });
  const categories = ["全部", ...listCategories(state.sites)];

  const importInput = el("input", {
    type: "file",
    accept: ".json,application/json",
    className: "sr-only",
    onChange: async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        state = saveState(importStateJson(state, text));
        selectedCategory = "全部";
        render();
        showToast(`导入成功，共 ${state.sites.length} 个站点`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "导入失败");
      }
    },
  });

  const searchInput = el("input", {
    id: "global-search-input",
    className: "search-input",
    type: "text",
    value: filterQuery,
    placeholder: activeEngine.placeholder,
    onInput: (e) => {
      filterQuery = e.target.value;
      updateResultsRegion();
    },
  });

  const shell = el("main", { className: "page-shell" }, [
    importInput,
    el("header", { className: "topbar" }, [
      el("div", { className: "brand" }, [
        el("div", { className: "brand-mark", textContent: "N" }),
        el("div", { className: "brand-text" }, [
          el("h1", { textContent: "极光导航 · NavHub" }),
          el("p", { textContent: `已收录 ${state.sites.length} 个常用站点 · 本地自动保存` }),
        ]),
      ]),
      el("div", { className: "topbar-actions" }, [
        el("button", {
          type: "button",
          className: "btn btn-primary",
          id: "btn-add-site",
          textContent: "+ 添加网址",
          onClick: () => openModal(null),
        }),
        el("button", {
          type: "button",
          className: "btn",
          id: "btn-theme",
          textContent: state.theme === "dark" ? "☀️ 浅色" : "🌙 深色",
          onClick: () => {
            state = saveState({ ...state, theme: state.theme === "dark" ? "light" : "dark" });
            render();
          },
        }),
        el("button", { type: "button", className: "btn", textContent: "导出", onClick: triggerExport }),
        el("button", { type: "button", className: "btn", textContent: "导入", onClick: () => importInput.click() }),
        el("button", {
          type: "button",
          className: "btn",
          textContent: "重置",
          onClick: () => {
            state = saveState(createDefaultState());
            selectedCategory = "全部";
            filterQuery = "";
            render();
            showToast("已恢复默认导航站点");
          },
        }),
      ]),
    ]),

    el("section", { className: "hero-section" }, [
      el("p", { className: "clock-readout", id: "live-clock", textContent: timeStr }),
      el("p", { className: "date-readout", id: "live-date", textContent: dateStr }),
      el(
        "div",
        { className: "engine-tabs", role: "tablist", "aria-label": "搜索引擎切换" },
        DEFAULT_SEARCH_ENGINES.map((eng) =>
          el("button", {
            type: "button",
            className: `engine-tab${eng.id === activeEngine.id ? " active" : ""}`,
            textContent: eng.name,
            onClick: () => {
              state = saveState({ ...state, searchEngineId: eng.id });
              render();
              document.getElementById("global-search-input")?.focus();
            },
          })
        )
      ),
      el(
        "form",
        {
          className: "search-form",
          onSubmit: (e) => {
            e.preventDefault();
            const targetUrl = buildSearchUrl(activeEngine.id, searchInput.value);
            if (!targetUrl) {
              showToast("输入关键词回车可直达全网搜索，或实时筛选下方网址");
              return;
            }
            window.open(targetUrl, "_blank", "noopener,noreferrer");
          },
        },
        [
          searchInput,
          filterQuery
            ? el("button", {
                type: "button",
                className: "search-clear",
                textContent: "清空",
                onClick: () => {
                  filterQuery = "";
                  searchInput.value = "";
                  updateResultsRegion();
                },
              })
            : null,
          el("button", { type: "submit", className: "search-submit", textContent: `${activeEngine.name}搜索` }),
        ]
      ),
      el("p", {
        className: "search-hint",
        textContent: "提示：输入关键词会同步筛选下方网址，按回车直接跳转所选搜索引擎 · 按 / 键快速聚焦",
      }),
    ]),

    pinnedSites.length > 0
      ? el("section", { "aria-label": "我的常用置顶" }, [
          el("div", { className: "section-header" }, [
            el("h2", { className: "section-title", textContent: `★ 我的常用（${pinnedSites.length}）` }),
          ]),
          el(
            "div",
            { className: "pinned-grid" },
            pinnedSites.map((s) => buildSiteCard(s, { compact: true }))
          ),
        ])
      : null,

    el("section", { "aria-label": "分类网址库" }, [
      el("div", { className: "section-header" }, [
        el("h2", { className: "section-title", textContent: "全部导航" }),
        el("span", { id: "visible-count", className: "section-title", textContent: `显示 ${filteredSites.length} 项` }),
      ]),
      el(
        "div",
        { className: "category-strip" },
        categories.map((cat) =>
          el("button", {
            type: "button",
            className: `chip${selectedCategory === cat ? " active" : ""}`,
            textContent: cat,
            onClick: () => {
              selectedCategory = cat;
              render();
            },
          })
        )
      ),
      el("div", { id: "sites-grid-region", style: "margin-top: 14px;" }, [renderSitesGrid(filteredSites)]),
    ]),
  ]);

  rootEl.replaceChildren(shell);
  const modalNode = renderModal();
  if (modalNode) rootEl.appendChild(modalNode);
  renderToast();
}

function renderSitesGrid(filteredSites) {
  if (filteredSites.length === 0) {
    return el("div", { className: "empty-state" }, [
      el("p", { textContent: "没有匹配的站内网址，按回车可直接去全网搜索，或者点上方「+ 添加网址」自己收录一个。" }),
    ]);
  }
  return el(
    "div",
    { className: "cards-grid" },
    filteredSites.map((s) => buildSiteCard(s, { compact: false }))
  );
}

function updateResultsRegion() {
  const region = document.getElementById("sites-grid-region");
  const countEl = document.getElementById("visible-count");
  if (!region) {
    render();
    return;
  }
  const filteredSites = filterSites(state.sites, { category: selectedCategory, query: filterQuery });
  region.replaceChildren(renderSitesGrid(filteredSites));
  if (countEl) countEl.textContent = `显示 ${filteredSites.length} 项`;
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalOpen) {
    closeModal();
    return;
  }
  if (e.key === "/" && !modalOpen && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "SELECT") {
    e.preventDefault();
    document.getElementById("global-search-input")?.focus();
  }
});

setInterval(() => {
  const clockEl = document.getElementById("live-clock");
  const dateEl = document.getElementById("live-date");
  if (!clockEl || !dateEl) return;
  const { timeStr, dateStr } = formatClockParts();
  clockEl.textContent = timeStr;
  dateEl.textContent = dateStr;
}, 15_000);

render();
