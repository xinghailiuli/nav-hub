import { DEFAULT_SEARCH_ENGINES } from './data/defaultSites.js';
import {
  THEMES, loadState, saveState, createDefaultState, addSite, updateSite,
  deleteSite, togglePin, listCategories, filterSites, buildSearchUrl,
  exportStateJson, importStateJson, isSafeHttpUrl, sanitizeCustomWallpaperInput,
} from './store.js';
import { loadAiRadarCache, fetchLiveAiRadar, formatContextWindow } from './aiRadar.js';
import snapshot from './data/aiModelsSnapshot.json';
import { THEME_VISUALS, MASCOTS, THEME_SWITCH_LINES, CATEGORY_LINES, AI_RADAR_SYNC_LINES, HITOKOTO_LIST, resolveMascotId, pickGreeting } from './data/acgDialogues.js';

const root = document.querySelector('#app');
const shell = el('main', { className: 'shell' });
root.append(shell);
const backdropStage = document.querySelector('#backdrop-stage');
const backdropSource = document.querySelector('#backdrop-webp');
const backdropImage = document.querySelector('#backdrop-img');
let state = loadState();
let category = '全部';
let query = '';
let provider = '全部';
let radar = loadAiRadarCache() ?? snapshot;
let syncing = false;
let speech = '';
let quoteIndex = 0;
const mascotId = () => resolveMascotId(state.mascotId, state.theme);
const isCurrentMascot = (id) => !state.mascotHidden && mascotId() === id;
const mascotPickLabel = (current) => current ? '当前陪伴中' : '设为看板娘';
function speak(line) { speech = line || ''; const bubble = document.querySelector('#mascot-speech'); if (bubble) bubble.textContent = speech; }
function sayFrom(lines, key) { speak(lines[key]?.[mascotId()]); }
function chooseTheme(id) { state = saveState({ ...state, theme: id, customWallpaper: '' }); speech = THEME_SWITCH_LINES[id]?.[mascotId()] || ''; render(); }
function picture(webp, jpg, width, height, alt = '') {
  const image = el('img', { width, height, alt, decoding: 'async' });
  const node = el('picture', {}, [el('source', { type: 'image/webp', srcset: webp }), image]);
  image.src = jpg;
  return node;
}
function syncBackdrop() {
  const visual = THEME_VISUALS[state.theme];
  const wallpaper = isSafeHttpUrl(state.customWallpaper) ? state.customWallpaper : '';
  const srcset = wallpaper ? '' : visual.bgWebp;
  const src = wallpaper || visual.bgJpg;
  if (backdropSource.getAttribute('srcset') !== srcset) backdropSource.srcset = srcset;
  if (backdropImage.getAttribute('src') !== src) backdropImage.src = src;
  if (backdropStage.dataset.backdropMode !== state.backdropMode) {
    backdropStage.dataset.backdropMode = state.backdropMode;
  }
}
function wallpaperDialog(returnFocus) {
 const d = el('dialog', { id: 'wallpaper-dialog', closedby: 'any', 'aria-labelledby': 'wallpaper-title' });
 const input = el('input', { type: 'url', value: state.customWallpaper, placeholder: 'https://example.com/wallpaper.jpg', 'aria-label': '自定义壁纸地址' });
 const error = el('p', { className: 'error', role: 'alert' });
 const modes = el('div', { className: 'chips' }, ['balanced', 'vivid'].map(mode => button(mode === 'balanced' ? '舒适磨砂' : '通透赏图', () => { state = saveState({ ...state, backdropMode: mode }); syncBackdrop(); modes.querySelectorAll('button').forEach(b => { const active = b.dataset.mode === mode; b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); }); }, { 'data-mode': mode, className: state.backdropMode === mode ? 'active' : '', 'aria-pressed': String(state.backdropMode === mode) })));
 d.append(el('form', { onSubmit: e => { e.preventDefault(); try { state = saveState({ ...state, customWallpaper: sanitizeCustomWallpaperInput(input.value) }); syncBackdrop(); d.close(); toast('壁纸设置已保存'); } catch (err) { error.textContent = err.message; } } }, [el('h2', { id: 'wallpaper-title', textContent: '壁纸与画质' }), el('p', { textContent: '选择背景通透度，或输入自定义壁纸地址。' }), modes, el('label', {}, ['自定义壁纸地址', input]), error, el('div', { className: 'actions' }, [button('清空并恢复主题壁纸', () => { input.value = ''; }), button('取消', () => d.close()), el('button', { type: 'submit', textContent: '保存' })])]));
 showDialog(d);
 d.addEventListener('close', returnFocus);
}
let fallbackKind = radar === snapshot ? '快照' : '缓存';
radar = { ...radar, syncMode: radar === snapshot ? 'snapshot' : 'cache' };

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'textContent') node.textContent = value;
    else if (key === 'className') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, String(value));
  }
  for (const child of [].concat(children)) {
    if (child != null) node.append(child instanceof Node ? child : document.createTextNode(child));
  }
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const safeAccent = (color) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color ?? '') ? color : 'var(--accent)';

function searchIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const lens = document.createElementNS(SVG_NS, 'circle');
  const handle = document.createElementNS(SVG_NS, 'path');
  const attrs = {
    class: 'search-icon', viewBox: '0 0 24 24', width: '18', height: '18',
    fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round',
    'aria-hidden': 'true', focusable: 'false',
  };
  for (const [name, value] of Object.entries(attrs)) svg.setAttribute(name, value);
  lens.setAttribute('cx', '11');
  lens.setAttribute('cy', '11');
  lens.setAttribute('r', '7');
  handle.setAttribute('d', 'M20 20l-4.2-4.2');
  svg.append(lens, handle);
  return svg;
}

const button = (label, fn, attrs = {}) => el('button', { type: 'button', textContent: label, onClick: fn, ...attrs });
function link(label, url) {
  return isSafeHttpUrl(url)
    ? el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', textContent: label })
    : el('span', { textContent: label });
}
function toast(message) {
  const notice = document.querySelector('#toast');
  notice.textContent = message;
  notice.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { notice.hidden = true; }, 3500);
}
function confirmButton(label, action, attrs = {}) {
  let armed = false;
  let timer;
  const control = button(label, () => {
    if (armed) {
      clearTimeout(timer);
      action();
      return;
    }
    armed = true;
    control.textContent = '再次点击确认';
    control.setAttribute('aria-label', `再次点击确认${label}`);
    timer = setTimeout(() => {
      armed = false;
      control.textContent = label;
      control.removeAttribute('aria-label');
    }, 4000);
  }, attrs);
  return control;
}
function apply() {
  const theme = THEMES.find((item) => item.id === state.theme) || THEMES[0];
  document.documentElement.dataset.theme = theme.id;
  document.documentElement.dataset.motionPaused = String(state.motionPaused);
  document.querySelector('meta[name="color-scheme"]').content = theme.colorScheme;
  document.querySelector('#meta-theme-color').content = theme.themeColor;
}
function card(site) {
  return el('article', { className: 'site-card', style: `--site-accent:${safeAccent(site.accent)}` }, [
    el('div', { className: 'card-top' }, [
      el('span', { className: 'avatar', 'aria-hidden': 'true', textContent: site.name.slice(0, 1) }),
      el('div', {}, [link(site.name, site.url), el('small', { textContent: site.category })]),
    ]),
    el('p', { textContent: site.description }),
    el('div', { className: 'tags' }, (site.tags || []).slice(0, 2).map((tag) => el('span', { className: 'tag-pill', textContent: tag }))),
    el('div', { className: 'actions' }, [
      button(site.pinned ? '★' : '☆', () => { state = saveState(togglePin(state, site.id)); render(); }, { 'aria-label': site.pinned ? '取消置顶' : '置顶' }),
      button('编辑', () => dialog(site)),
      confirmButton('删除', () => { state = saveState(deleteSite(state, site.id)); render(); toast('网址已删除'); }, { 'aria-label': `删除 ${site.name}` }),
    ]),
  ]);
}
function dialog(site) {
  const d = el('dialog', { id: 'site-dialog', closedby: 'any', 'aria-labelledby': 'dialog-title' });
  const name = el('input', { id: 'site-name-input', value: site?.name || '', required: true });
  const url = el('input', { id: 'site-url-input', value: site?.url || '', required: true });
  const cat = el('select', { id: 'site-cat-select' }, listCategories(state.sites).map((c) => el('option', { value: c, textContent: c })));
  const tags = el('input', { id: 'site-tags-input', value: (site?.tags || []).join(', ') });
  const desc = el('input', { id: 'site-desc-input', value: site?.description || '' });
  const pin = el('input', { id: 'site-pin-input', type: 'checkbox' });
  const error = el('p', { className: 'error', role: 'alert' });
  cat.value = site?.category || cat.value;
  pin.checked = !!site?.pinned;
  const field = (label, input) => el('label', {}, [label, input]);
  d.append(el('form', { onSubmit: (event) => {
    event.preventDefault();
    try {
      const draft = { name: name.value, url: url.value, category: cat.value, tags: tags.value, description: desc.value, pinned: pin.checked, accent: site?.accent };
      state = saveState(site ? updateSite(state, site.id, draft) : addSite(state, draft));
      d.close();
      render();
      toast('网址已保存');
    } catch (err) { error.textContent = err.message; }
  } }, [
    el('h2', { id: 'dialog-title', textContent: site ? '编辑网址' : '添加网址' }),
    field('网站名称', name), field('网址', url), field('分类', cat),
    field('标签（逗号分隔，最多三个）', tags), field('简短说明', desc), field('置顶', pin), error,
    el('div', { className: 'actions' }, [button('取消', () => d.close()), el('button', { type: 'submit', textContent: '保存' })]),
  ]));
  showDialog(d);
}
function showDialog(d) {
  document.body.append(d);
  d.addEventListener('close', () => { d.returnValue = ''; d.remove(); });
  if (!('closedBy' in d)) {
    let outside = false;
    const out = (event) => {
      const rect = d.getBoundingClientRect();
      return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    };
    d.addEventListener('pointerdown', (event) => { outside = out(event); });
    d.addEventListener('pointerup', (event) => { if (outside && out(event)) d.close(); outside = false; });
  }
  d.showModal();
}
async function sync() {
  if (syncing) return;
  clearTimeout(initialSync);
  syncing = true;
  sayFrom(AI_RADAR_SYNC_LINES, 'syncing');
  renderAiRadarSection();
  try {
    fallbackKind = loadAiRadarCache() ? '缓存' : '快照';
    radar = await fetchLiveAiRadar({ fallbackSnapshot: snapshot });
  } catch (error) {
    toast(`同步失败：${error.message}`);
  } finally {
    syncing = false;
    sayFrom(AI_RADAR_SYNC_LINES, radar.syncMode);
    renderAiRadarSection();
  }
}
function freshness(key) {
  return (radar.syncMode === 'live' || radar.syncMode === 'partial-live') && radar.sourceResults?.[key] === true
    ? '实时' : `沿用${fallbackKind}`;
}
function chips(items, selected, onSelect) {
  return el('div', { className: 'chips' }, items.map((item) => button(item.name || item, () => onSelect(item), {
    className: (item.id || item) === selected ? 'active' : '',
    'aria-pressed': String((item.id || item) === selected),
    'data-value': item.id || item,
  })));
}
function radarCard(item) {
  const statusSource = item.id === 'openai' ? 'openaiStatus' : item.id === 'anthropic' ? 'claudeStatus' : null;
  return el('article', { className: 'radar-card' }, [
    el('div', { className: 'section-head' }, [el('h3', { textContent: item.name }), el('span', { className: 'status', textContent: item.status?.description || '状态未知' })]),
    el('small', { textContent: item.family }),
    el('div', { className: 'source-tags' }, [
      el('span', { className: 'source-badge', textContent: `目录 · ${item.catalogFresh && freshness('openrouter') === '实时' ? '实时' : `沿用${fallbackKind}`}` }),
      statusSource && item.status ? el('span', { className: 'source-badge', textContent: `状态 · ${freshness(statusSource)}` }) : null,
    ]),
    el('p', { className: 'model', textContent: item.featuredModel?.name || '暂无型号' }),
    el('p', { textContent: `CTX ${formatContextWindow(item.featuredModel?.contextWindow)} · 收录 ${item.modelCount} 个模型` }),
    el('p', { textContent: `近期：${item.recentModels.map((model) => model.name).slice(0, 3).join('、') || '暂无'}` }),
    el('div', { className: 'actions' }, [link('官网 ↗', item.url), link('API ↗', item.apiUrl)]),
  ]);
}
function aiRadarContent() {
  const modes = { live: '🟢 实时同步', 'partial-live': '🟡 部分实时', cache: '💾 离线缓存', snapshot: '📦 构建快照' };
  const sources = [['openrouter', 'OpenRouter目录'], ['openaiStatus', 'OpenAI状态'], ['claudeStatus', 'Claude状态'], ['ollama', 'Ollama版本']];
  return [
    el('div', { className: 'section-head ai-radar-header' }, [
      el('div', {}, [el('p', { className: 'eyebrow', textContent: 'AI 模型情报' }), el('h2', { className: 'section-title', textContent: 'AI 模型雷达' }),
        el('div', { className: 'source-tags', 'aria-label': '数据来源新鲜度' }, sources.map(([key, label]) => el('span', { className: `source-badge ${freshness(key) === '实时' ? 'is-live' : ''}`, textContent: `${label} · ${freshness(key)}` }))),
      ]),
      el('div', { className: 'radar-toolbar' }, [el('span', { className: 'badge', role: 'status', textContent: modes[radar.syncMode] || modes.snapshot }), radar.ollama ? link(`🦙 Ollama ${radar.ollama.version}`, radar.ollama.url) : null, button(syncing ? '同步中…' : '立即同步', sync, { id: 'btn-sync-ai-models', 'aria-disabled': String(syncing) })]),
    ]),
    chips(['全部', ...radar.providers.map((item) => ({ id: item.id, name: item.name }))], provider, (item) => { provider = item.id || item; renderAiRadarSection(); }),
    el('div', { className: 'grid radar-grid' }, radar.providers.filter((item) => provider === '全部' || item.id === provider).map(radarCard)),
  ];
}
function renderAiRadarSection() {
  const body = document.querySelector('#ai-radar-body');
  if (!body) return;
  const active = document.activeElement;
  const focusedButton = body.contains(active) ? active.closest('button') : null;
  body.replaceChildren(...aiRadarContent());
  if (focusedButton?.id === 'btn-sync-ai-models') {
    body.querySelector('#btn-sync-ai-models').focus({ preventScroll: true });
  } else if (focusedButton?.dataset.value) {
    [...body.querySelectorAll('.chips button')].find((item) => item.dataset.value === focusedButton.dataset.value)
      ?.focus({ preventScroll: true });
  }
}
function setMascotHidden(hidden) {
  state = saveState({ ...state, mascotHidden: hidden });
  shell.querySelector('#mascot-panel').hidden = hidden;
  shell.querySelector('.recall').hidden = !hidden;
  const command = shell.querySelector('#toggle-mascot');
  command.textContent = hidden ? '呼出看板娘' : '隐藏看板娘';
  for (const pick of shell.querySelectorAll('.mascot-pick')) {
    const current = isCurrentMascot(pick.dataset.pick);
    pick.textContent = mascotPickLabel(current);
    pick.setAttribute('aria-disabled', String(current));
  }
}
function topbarTools(file) {
  topbarTools.cleanup?.();
  topbarTools.cleanup = null;
  const supportsPopover = Object.hasOwn(HTMLElement.prototype, 'popover');
  const trigger = el('button', {
    id: 'topbar-tools-trigger', type: 'button', className: 'tools-trigger',
    popovertarget: 'topbar-tools-menu', 'aria-haspopup': 'menu', 'aria-expanded': 'false',
    textContent: '更多 ▾',
  });
  let menu;
  const positionMenuFallback = () => {
    const anchor = trigger.getBoundingClientRect();
    const { clientWidth, clientHeight } = document.documentElement;
    const gap = 8;
    const spaceBelow = clientHeight - anchor.bottom - gap * 2;
    const spaceAbove = anchor.top - gap * 2;
    menu.style.maxHeight = Math.max(gap, spaceBelow, spaceAbove) + 'px';
    const openBelow = menu.offsetHeight <= spaceBelow || spaceBelow >= spaceAbove;
    menu.style.left = Math.max(gap, Math.min(anchor.right - menu.offsetWidth, clientWidth - menu.offsetWidth - gap)) + 'px';
    menu.style.top = (openBelow ? anchor.bottom + gap : anchor.top - menu.offsetHeight - gap) + 'px';
  };
  let outsideClickHandler = null;
  let escapeKeyHandler = null;
  const setFallbackMenuOpen = (open, restoreFocus = false) => {
    if (!menu) return;
    menu.classList.toggle(':popover-open', open);
    trigger.setAttribute('aria-expanded', String(open));
    if (outsideClickHandler) {
      document.removeEventListener('pointerdown', outsideClickHandler);
      outsideClickHandler = null;
    }
    if (escapeKeyHandler) {
      document.removeEventListener('keydown', escapeKeyHandler);
      escapeKeyHandler = null;
    }
    if (open) {
      positionMenuFallback();
      outsideClickHandler = (event) => {
        if (!menu.contains(event.target) && !trigger.contains(event.target)) {
          setFallbackMenuOpen(false);
        }
      };
      escapeKeyHandler = (event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          setFallbackMenuOpen(false, true);
        }
      };
      topbarTools.cleanup = () => {
        document.removeEventListener('pointerdown', outsideClickHandler);
        document.removeEventListener('keydown', escapeKeyHandler);
        outsideClickHandler = null;
        escapeKeyHandler = null;
      };
      document.addEventListener('pointerdown', outsideClickHandler);
      document.addEventListener('keydown', escapeKeyHandler);
    } else if (restoreFocus) {
      topbarTools.cleanup = null;
      trigger.focus({ preventScroll: true });
    } else {
      topbarTools.cleanup = null;
    }
  };
  const closeMenu = () => {
    if (supportsPopover && typeof menu?.hidePopover === 'function') {
      menu.hidePopover();
    } else {
      setFallbackMenuOpen(false);
    }
  };
  const command = (label, action, attrs) => button(label, (event) => {
    closeMenu();
    trigger.focus({ preventScroll: true });
    action(event.currentTarget);
  }, attrs);
  const motionLabel = () => state.motionPaused ? '开启动效' : '暂停动效';
  const group = el('div', { focusgroup: 'menu nomemory', 'aria-labelledby': trigger.id }, [
    el('div', { className: 'group-label', textContent: '外观' }),
    command('壁纸与画质', () => wallpaperDialog(() => {
      document.getElementById(trigger.id)?.focus({ preventScroll: true });
    })),
    command(state.mascotHidden ? '呼出看板娘' : '隐藏看板娘',
      () => setMascotHidden(!state.mascotHidden), { id: 'toggle-mascot' }),
    command(motionLabel(), (item) => {
      state = saveState({ ...state, motionPaused: !state.motionPaused });
      apply();
      item.textContent = motionLabel();
    }),
    el('hr'),
    el('div', { className: 'group-label', textContent: '数据' }),
    command('导出', () => {
      const url = URL.createObjectURL(new Blob([exportStateJson(state)], { type: 'application/json' }));
      el('a', { href: url, download: 'navhub-backup.json' }).click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }),
    command('导入', () => file.click()),
    command('重置', () => {
      const d = el('dialog', { closedby: 'any', 'aria-labelledby': 'reset-title' }, [
        el('h2', { id: 'reset-title', textContent: '恢复默认导航？' }),
        el('p', { textContent: '已修改的网址和偏好将恢复为默认设置。' }),
        el('div', { className: 'actions' }, [
          button('取消', () => d.close(), { autofocus: true }),
          button('恢复默认', () => {
            state = saveState(createDefaultState());
            category = '全部';
            query = '';
            d.close();
            render();
            document.querySelector('#topbar-tools-trigger')?.focus({ preventScroll: true });
            toast('已恢复默认导航');
          }),
        ]),
      ]);
      showDialog(d);
    }),
  ]);
  menu = el('div', { id: 'topbar-tools-menu', popover: 'auto', className: 'tools-popover' }, [group]);
  const items = [...group.querySelectorAll('button')];
  items[0].autofocus = true;
  if (!('focusGroup' in HTMLElement.prototype)) {
    group.setAttribute('role', 'menu');
    items.forEach((item) => item.setAttribute('role', 'menuitem'));
    group.addEventListener('keydown', (event) => {
      const current = items.indexOf(event.target);
      if (current < 0) return;
      const next = {
        ArrowUp: (current + items.length - 1) % items.length,
        ArrowDown: (current + 1) % items.length,
        Home: 0,
        End: items.length - 1,
      }[event.key];
      if (!Number.isInteger(next)) return;
      event.preventDefault();
      items[next].focus();
    });
  }
  if (supportsPopover) {
    menu.addEventListener('toggle', (event) => {
      const open = event.newState === 'open';
      trigger.setAttribute('aria-expanded', String(open));
      if (open && !CSS.supports('position-area: block-end')) {
        positionMenuFallback();
      }
    });
  } else {
    trigger.addEventListener('click', () => {
      const nextOpen = !menu.classList.contains(':popover-open');
      setFallbackMenuOpen(nextOpen);
      if (nextOpen) items[0]?.focus({ preventScroll: true });
    });
  }
  return [trigger, menu];
}

function render() {
  const active = document.activeElement;
  const activeId = active?.id;
  const selection = activeId === 'global-search-input'
    ? [active.selectionStart, active.selectionEnd, active.selectionDirection] : null;
  const themeFocus = active?.closest('.theme-group, .gallery-grid');
  apply();
  syncBackdrop();
  const visual = THEME_VISUALS[state.theme];
  const mascot = MASCOTS[mascotId()];
  const engine = DEFAULT_SEARCH_ENGINES.find((item) => item.id === state.searchEngineId) || DEFAULT_SEARCH_ENGINES[0];
  const input = el('input', { id: 'global-search-input', 'aria-label': '搜索网站或输入关键词', placeholder: '搜索网站或输入关键词', value: query, onInput: (event) => { query = event.target.value; results(); } });
  const engineSearch = el('form', {
    className: 'search', role: 'search',
    onSubmit: (event) => {
      event.preventDefault();
      const url = buildSearchUrl(engine.id, input.value);
      if (isSafeHttpUrl(url)) window.open(url, '_blank', 'noopener,noreferrer');
    },
  }, [
    searchIcon(),
    input,
    el('kbd', { className: 'search-kbd', 'aria-hidden': 'true', textContent: 'Enter' }),
    button('清空', () => { query = ''; input.value = ''; results(); input.focus(); }, { className: 'clear-search', 'aria-label': '清空搜索' }),
    el('button', { type: 'submit', textContent: `${engine.name} 搜索` }),
  ]);
  const quickPins = state.sites.filter((site) => site.pinned && isSafeHttpUrl(site.url)).slice(0, 6);
  const quickPinNav = quickPins.length ? el('nav', { className: 'quick-pins', 'aria-label': '置顶高频直达' },
    quickPins.map((site) => el('a', {
      className: 'quick-pin', href: site.url, target: '_blank', rel: 'noopener noreferrer',
      style: `--site-accent:${safeAccent(site.accent)}`,
    }, [
      el('span', { className: 'quick-dot', 'aria-hidden': 'true' }),
      el('span', { className: 'quick-pin-name', textContent: site.name }),
      el('span', { className: 'quick-arrow', 'aria-hidden': 'true', textContent: '↗' }),
      el('span', { className: 'sr-only', textContent: '（新标签页打开）' }),
    ])),
  ) : null;
  const file = el('input', { type: 'file', accept: '.json,application/json', hidden: true, onChange: async (event) => {
    try {
      const selected = event.target.files[0];
      event.target.value = '';
      if (!selected) return;
      state = saveState(importStateJson(state, await selected.text()));
      render();
      document.querySelector('#topbar-tools-trigger')?.focus({ preventScroll: true });
      toast('导入成功');
    } catch (error) { toast(error.message); }
  } });
  shell.replaceChildren(
    file,
    el('header', { className: 'topbar' }, [
      el('div', { className: 'brand' }, [
        el('span', { className: 'brand-icon', 'aria-hidden': 'true', textContent: '✦' }),
        el('strong', { textContent: '极光导航' }),
        el('span', { className: 'brand-issue', textContent: 'ACG 索引帖' }),
      ]),
      el('div', { className: 'theme-group', role: 'radiogroup', 'aria-label': '主题' }, THEMES.map((theme) => button(theme.name, () => chooseTheme(theme.id), { role: 'radio', 'aria-checked': String(state.theme === theme.id) }))),
      el('div', { className: 'toolbar' }, [
        button('+ 添加网址', () => dialog(), { className: 'add-site' }),
        ...topbarTools(file),
      ]),
    ]),
    el('section', { className: 'hero-stage' }, [el('div', { className: 'hero hero-main hero-panel' }, [
      el('p', { className: 'eyebrow', textContent: '星海 · 导航手册' }),
      el('h1', {}, [
        el('span', { className: 'hero-title-accent', textContent: '发现属于你的' }),
        '星空',
      ]),
      el('p', { className: 'hero-subtitle', textContent: visual.tagline }),
      el('div', { className: 'hitokoto' }, [el('span', { id: 'quote-text', textContent: HITOKOTO_LIST[quoteIndex].quote + ' — ' + HITOKOTO_LIST[quoteIndex].source }), button('换一句', () => { quoteIndex = (quoteIndex + 1) % HITOKOTO_LIST.length; document.querySelector('#quote-text').textContent = HITOKOTO_LIST[quoteIndex].quote + ' — ' + HITOKOTO_LIST[quoteIndex].source; })]), el('p', { id: 'clock', className: 'clock' }),
      engineSearch,
      chips(DEFAULT_SEARCH_ENGINES, state.searchEngineId, (item) => { state = saveState({ ...state, searchEngineId: item.id }); render(); }),
      quickPinNav,
      el('small', { className: 'search-hint', textContent: '按 / 快速搜索' }),
      button('✦ 呼出看板娘', () => {
        setMascotHidden(false);
        shell.querySelector('.mascot-art').focus({ preventScroll: true });
      }, { className: 'recall', hidden: !state.mascotHidden }),
    ]), el('div', { className: 'hero-scenic-window' }, [
      el('div', { className: 'scene-plaque' }, [
        el('span', { textContent: '✦ 当前世界线 · ' + visual.sceneTitle }),
      ]),
      el('aside', { id: 'mascot-panel', className: 'mascot-stage', hidden: state.mascotHidden }, [
        el('button', { type: 'button', className: 'mascot-art', 'aria-label': '点击看板娘互动', onClick: () => {
          const lines = mascot.greetings.poke;
          speak(lines[Math.floor(Math.random() * lines.length)]);
        } }, [picture(mascot.avatarWebp, mascot.avatarJpg, 104, 138, mascot.name + '立绘')]),
        el('div', { className: 'mascot-dialogue' }, [
          el('span', { className: 'mascot-name', textContent: mascot.name + ' · ' + (mascot.id === 'sena' ? '星穹姬' : '昼樱姬') }),
          el('p', { id: 'mascot-speech', className: 'speech', 'aria-live': 'polite', textContent: speech || pickGreeting(mascot.id, new Date().getHours()) }),
          el('div', { className: 'mascot-controls' }, [
            ...[['auto', '跟随'], ['sena', '星奈'], ['sakura', '樱雪']].map(([id, label]) => button(label, () => {
              state = saveState({ ...state, mascotId: id });
              speech = '';
              render();
            }, { className: state.mascotId === id ? 'active' : '', 'aria-pressed': String(state.mascotId === id) })),
            button('暂别', () => {
              setMascotHidden(true);
              shell.querySelector('.recall').focus({ preventScroll: true });
            }),
          ]),
        ]),
      ]),
    ])]),
    el('div', { className: 'editorial-content' }, [
        el('section', { className: 'visual-gallery' }, [
          el('div', { className: 'gallery-heading' }, [
            el('h2', { className: 'section-title', textContent: '世界线 · 画廊' }),
            el('span', { textContent: '选择世界线以切换主题与壁纸' }),
          ]),
          el('div', { className: 'gallery-grid' }, THEMES.map((theme) => {
            const scene = THEME_VISUALS[theme.id];
            const active = theme.id === state.theme;
            return el('button', {
              type: 'button', className: active ? 'gallery-card active' : 'gallery-card',
              'aria-pressed': String(active), onClick: () => chooseTheme(theme.id),
            }, [
              picture(scene.bgWebp, scene.bgJpg, 1376, 768),
              el('span', { className: 'gallery-caption' }, [
                el('strong', { textContent: theme.name }),
                el('small', { textContent: scene.sceneTitle }),
                active ? el('span', { className: 'gallery-current', textContent: '当前世界线' }) : null,
              ]),
            ]);
          })),
        ]),
        el('section', {}, [
          el('h2', { textContent: '看板双姬档案' }),
          el('div', { className: 'mascot-gallery' }, [MASCOTS.sena, MASCOTS.sakura].map((character, index) => {
            const current = isCurrentMascot(character.id);
            return el('figure', { className: 'mascot-card' }, [
              el('div', { className: 'mascot-frame' }, [
                picture(character.avatarWebp, character.avatarJpg, 240, 320, character.name + '立绘'),
              ]),
              el('figcaption', { className: 'mascot-info' }, [
                el('div', { className: 'mascot-title-row' }, [
                  el('strong', { textContent: character.name }),
                  el('span', { className: 'mascot-badge', textContent: `No.0${index + 1}` }),
                  el('small', { textContent: character.title }),
                ]),
                el('p', { className: 'mascot-world', textContent: character.cvStyle }),
                el('p', { className: 'mascot-line', textContent: character.catchphrase }),
                button(mascotPickLabel(current), () => {
                  if (isCurrentMascot(character.id)) return;
                  state = saveState({ ...state, mascotId: character.id, mascotHidden: false });
                  speech = character.catchphrase;
                  render();
                  shell.querySelector(`[data-pick="${character.id}"]`)?.focus({ preventScroll: true });
                }, { className: 'mascot-pick', 'data-pick': character.id, 'aria-disabled': String(current) }),
              ]),
            ]);
          })),
        ]),
        el('section', {}, [el('h2', { textContent: '常用置顶' }), el('div', { className: 'grid' }, state.sites.filter((site) => site.pinned).map(card))]),
        el('section', { id: 'ai-radar-section', className: 'ai-radar-section' }, [el('div', { id: 'ai-radar-body' }, aiRadarContent())]),
        el('section', {}, [el('div', { className: 'section-head' }, [el('h2', { className: 'section-title', textContent: '探索网址库' }), el('span', { id: 'count' })]), chips(['全部', ...listCategories(state.sites)], category, (item) => { category = item; sayFrom(CATEGORY_LINES, item); render(); }), el('div', { id: 'results', className: 'grid' })]),
        el('footer', { textContent: '✦ 在热爱中，发现更多可能 · NavHub' }),
    ]),
  );
  results(); clock();
  const themeGroup = shell.querySelector('.theme-group');
  const selectedTheme = themeGroup.querySelector('[aria-checked=true]');
  const themeBounds = themeGroup.getBoundingClientRect();
  themeGroup.scrollLeft += Math.max(0, selectedTheme.getBoundingClientRect().right - themeBounds.right + 4);
  if (activeId === 'topbar-tools-trigger') shell.querySelector('#topbar-tools-trigger').focus({ preventScroll: true });
  if (selection) {
    input.focus({ preventScroll: true });
    input.setSelectionRange(...selection);
  }
  if (themeFocus) {
    const selected = themeFocus.matches('.theme-group') ? selectedTheme : shell.querySelector('.gallery-card.active');
    selected.focus({ preventScroll: true });
  }
}
function results() {
  const sites = filterSites(state.sites, { category, query });
  document.querySelector('#results')?.replaceChildren(...sites.map(card));
  const count = document.querySelector('#count');
  if (count) count.textContent = `${sites.length} 个网址`;
}
function clock() {
  const node = document.querySelector('#clock');
  if (node) node.textContent = new Date().toLocaleString('zh-CN', { dateStyle: 'full', timeStyle: 'short' });
}
document.addEventListener('keydown', (event) => {
  const menuOpen = document.querySelector('#topbar-tools-trigger')?.getAttribute('aria-expanded') === 'true';
  if (event.key !== '/' || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || document.querySelector('dialog[open]') || menuOpen) return;
  if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
  event.preventDefault(); document.querySelector('#global-search-input')?.focus();
});
render();
setInterval(clock, 15000);
const initialSync = setTimeout(sync, 800);
