import './styles.css';
import { DEFAULT_SEARCH_ENGINES } from './data/defaultSites.js';
import {
  THEMES, loadState, saveState, createDefaultState, addSite, updateSite,
  deleteSite, togglePin, listCategories, filterSites, buildSearchUrl,
  exportStateJson, importStateJson, isSafeHttpUrl,
} from './store.js';
import { loadAiRadarCache, fetchLiveAiRadar, formatContextWindow } from './aiRadar.js';
import snapshot from './data/aiModelsSnapshot.json';
import { THEME_VISUALS, MASCOTS, THEME_SWITCH_LINES, CATEGORY_LINES, AI_RADAR_SYNC_LINES, HITOKOTO_LIST, resolveMascotId, pickGreeting } from './data/acgDialogues.js';
import { sanitizeCustomWallpaperInput } from './store.js';

const root = document.querySelector('#app');
let state = loadState();
let category = '全部';
let query = '';
let provider = '全部';
let radar = loadAiRadarCache() ?? snapshot;
let syncing = false;
let speech = '';
let quoteIndex = 0;
const mascotId = () => resolveMascotId(state.mascotId, state.theme);
function speak(line) { speech = line || ''; const bubble = document.querySelector('#mascot-speech'); if (bubble) bubble.textContent = speech; }
function sayFrom(lines, key) { speak(lines[key]?.[mascotId()]); }
function chooseTheme(id) { state = saveState({ ...state, theme: id, customWallpaper: '' }); speech = THEME_SWITCH_LINES[id]?.[mascotId()] || ''; render(); }
function picture(webp, jpg, width, height, attrs = {}) { return el('picture', {}, [el('source', { type: 'image/webp', srcset: webp }), el('img', { src: jpg, width, height, decoding: 'async', ...attrs })]); }
function wallpaperDialog() {
 const d = el('dialog', { id: 'wallpaper-dialog', closedby: 'any', 'aria-labelledby': 'wallpaper-title' });
 const input = el('input', { type: 'url', value: state.customWallpaper, placeholder: 'https://example.com/wallpaper.jpg', 'aria-label': '自定义壁纸地址' });
 const error = el('p', { className: 'error', role: 'alert' });
 const modes = el('div', { className: 'chips' }, ['balanced', 'vivid'].map(mode => button(mode === 'balanced' ? '舒适磨砂' : '通透赏图', () => { state = saveState({ ...state, backdropMode: mode }); document.querySelector('.shell').dataset.backdropMode = mode; modes.querySelectorAll('button').forEach(b => { const active = b.dataset.mode === mode; b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); }); }, { 'data-mode': mode, className: state.backdropMode === mode ? 'active' : '', 'aria-pressed': String(state.backdropMode === mode) })));
 d.append(el('form', { onSubmit: e => { e.preventDefault(); try { state = saveState({ ...state, customWallpaper: sanitizeCustomWallpaperInput(input.value) }); d.close(); render(); toast('壁纸设置已保存'); } catch (err) { error.textContent = err.message; } } }, [el('h2', { id: 'wallpaper-title', textContent: '壁纸与画质' }), el('p', { textContent: '选择背景通透度，或输入自定义壁纸地址。' }), modes, el('label', {}, ['自定义壁纸地址', input]), error, el('div', { className: 'actions' }, [button('清空并恢复主题壁纸', () => { input.value = ''; }), button('取消', () => d.close()), el('button', { type: 'submit', textContent: '保存' })])]));
 showDialog(d);
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
  return el('article', { className: 'site-card', style: `--site-accent:${site.accent}` }, [
    el('div', { className: 'card-top' }, [
      el('span', { className: 'avatar', textContent: site.name.slice(0, 1) }),
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
  syncing = true;
  sayFrom(AI_RADAR_SYNC_LINES, 'syncing');
  render();
  try {
    fallbackKind = loadAiRadarCache() ? '缓存' : '快照';
    radar = await fetchLiveAiRadar({ fallbackSnapshot: snapshot });
  } catch (error) {
    toast(`同步失败：${error.message}`);
  } finally { syncing = false; sayFrom(AI_RADAR_SYNC_LINES, radar.syncMode); render(); }
}
function freshness(key) {
  return (radar.syncMode === 'live' || radar.syncMode === 'partial-live') && radar.sourceResults?.[key] === true
    ? '实时' : `沿用${fallbackKind}`;
}
function chips(items, selected, onSelect) {
  return el('div', { className: 'chips' }, items.map((item) => button(item.name || item, () => onSelect(item), {
    className: (item.id || item) === selected ? 'active' : '',
    'aria-pressed': String((item.id || item) === selected),
  })));
}
function crest() {
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" aria-hidden="true">
    <circle cx="60" cy="60" r="47" fill="none" stroke="var(--accent)" stroke-width="1" opacity=".45"/>
    <ellipse cx="60" cy="60" rx="55" ry="28" fill="none" stroke="var(--primary)" stroke-width="1.4" transform="rotate(-28 60 60)"/>
    <path d="M60 25c-13 0-20 10-20 22 0 7-3 13-7 18 7-1 12-4 15-8-1 7 1 13 5 17-9 3-15 9-18 18 16 7 34 7 50 0-3-9-9-15-18-18 4-4 6-10 5-17 3 4 8 7 15 8-4-5-7-11-7-18 0-12-7-22-20-22Z" fill="var(--accent)" opacity=".22" stroke="var(--accent)" stroke-width="1.5"/>
    <path d="M47 46c4-1 9-5 12-10 4 6 9 9 15 10M49 54c1 9 5 15 11 15s10-6 11-15M53 74l7 7 7-7" fill="none" stroke="var(--primary)" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M60 11l2 6 6 2-6 2-2 6-2-6-6-2 6-2zM96 34l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5zM25 78l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="var(--primary)"/>
  </svg>`;
  return document.importNode(new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement, true);
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
function render() {
  const focused = document.activeElement?.id === 'global-search-input';
  const selection = focused ? document.activeElement.selectionStart : null;
  apply();
  const visual = THEME_VISUALS[state.theme];
  const mascot = MASCOTS[mascotId()];
  const engine = DEFAULT_SEARCH_ENGINES.find((item) => item.id === state.searchEngineId) || DEFAULT_SEARCH_ENGINES[0];
  const input = el('input', { id: 'global-search-input', 'aria-label': '搜索网站或输入关键词', placeholder: '搜索网站或输入关键词', value: query, onInput: (event) => { query = event.target.value; results(); } });
  const file = el('input', { type: 'file', accept: '.json,application/json', hidden: true, onChange: async (event) => {
    try {
      if (!event.target.files[0]) return;
      state = saveState(importStateJson(state, await event.target.files[0].text()));
      render(); toast('导入成功');
    } catch (error) { toast(error.message); }
  } });
  const modes = { live: '🟢 实时同步', 'partial-live': '🟡 部分实时', cache: '💾 离线缓存', snapshot: '📦 构建快照' };
  const sources = [['openrouter', 'OpenRouter目录'], ['openaiStatus', 'OpenAI状态'], ['claudeStatus', 'Claude状态'], ['ollama', 'Ollama版本']];
  const shell = el('main', { className: 'shell', 'data-backdrop-mode': state.backdropMode }, [
    el('div', { id: 'backdrop-stage', className: 'backdrop-stage', 'aria-hidden': 'true' }, [state.customWallpaper && isSafeHttpUrl(state.customWallpaper) ? el('img', { className: 'backdrop-img', src: state.customWallpaper, width: 1376, height: 768, fetchpriority: 'high', decoding: 'async', alt: '' }) : picture(visual.bgWebp, visual.bgJpg, 1376, 768, { className: 'backdrop-img', fetchpriority: 'high', alt: '' }), el('div', { className: 'backdrop-scrim' })]),
    file,
    el('header', { className: 'topbar' }, [
      el('div', { className: 'brand' }, [el('span', { className: 'brand-icon', textContent: '✦' }), el('div', {}, [el('strong', { textContent: '极光导航 · NavHub' }), el('small', { textContent: '二次元 × Galgame × AI' })])]),
      el('div', { className: 'toolbar' }, [
        el('div', { className: 'theme-group', role: 'radiogroup', 'aria-label': '主题' }, THEMES.map((theme) => button(theme.name, () => chooseTheme(theme.id), { role: 'radio', 'aria-checked': String(state.theme === theme.id), className: state.theme === theme.id ? 'active' : '' }))),
        button(state.motionPaused ? '开启动效' : '暂停动效', () => { state = saveState({ ...state, motionPaused: !state.motionPaused }); render(); }),
        button('壁纸与画质', wallpaperDialog),
        button(state.mascotHidden ? '呼出看板娘' : '隐藏看板娘', () => { state = saveState({ ...state, mascotHidden: !state.mascotHidden }); render(); }, { 'aria-pressed': String(!state.mascotHidden) }),
        button('+ 添加网址', () => dialog()),
        button('导出', () => {
          const url = URL.createObjectURL(new Blob([exportStateJson(state)], { type: 'application/json' }));
          el('a', { href: url, download: 'navhub-backup.json' }).click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }),
        button('导入', () => file.click()),
        confirmButton('重置', () => { state = saveState(createDefaultState()); category = '全部'; query = ''; render(); toast('已恢复默认导航'); }),
      ]),
    ]),
    el('section', { className: 'hero-stage' }, [el('div', { className: 'hero hero-main hero-panel' }, [
      el('div', { className: 'emblem', 'aria-hidden': 'true' }, [crest()]),
      el('p', { className: 'eyebrow', textContent: 'YOUR LITTLE UNIVERSE' }),
      el('h1', { textContent: '发现属于你的星空' }), el('p', { className: 'hero-subtitle', textContent: visual.sceneTitle + ' · ' + visual.tagline }),
      el('div', { className: 'hitokoto' }, [el('span', { id: 'quote-text', textContent: HITOKOTO_LIST[quoteIndex].quote + ' — ' + HITOKOTO_LIST[quoteIndex].source }), button('换一句', () => { quoteIndex = (quoteIndex + 1) % HITOKOTO_LIST.length; document.querySelector('#quote-text').textContent = HITOKOTO_LIST[quoteIndex].quote + ' — ' + HITOKOTO_LIST[quoteIndex].source; })]), el('p', { id: 'clock', className: 'clock' }),
      chips(DEFAULT_SEARCH_ENGINES, state.searchEngineId, (item) => { state = saveState({ ...state, searchEngineId: item.id }); render(); }),
      el('form', { className: 'search', onSubmit: (event) => { event.preventDefault(); const url = buildSearchUrl(engine.id, input.value); if (isSafeHttpUrl(url)) window.open(url, '_blank', 'noopener,noreferrer'); } }, [
        input, button('清空', () => { query = ''; input.value = ''; results(); input.focus(); }, { className: 'clear-search', 'aria-label': '清空搜索' }),
        el('button', { type: 'submit', textContent: `${engine.name} 搜索` }),
      ]),
      el('small', { className: 'search-hint', textContent: '按 / 快速搜索 · 探索你的世界线' }),
      state.mascotHidden ? button('✦ 呼出看板娘', () => { state = saveState({ ...state, mascotHidden: false }); render(); }, { className: 'recall' }) : null,
    ]), !state.mascotHidden ? el('aside', { id: 'mascot-panel', className: 'mascot-stage' }, [
      el('button', { type: 'button', className: 'mascot-art', 'aria-label': '点击看板娘互动', onClick: () => { const lines = mascot.greetings.poke; speak(lines[Math.floor(Math.random() * lines.length)]); } }, [picture(mascot.avatarWebp, mascot.avatarJpg, 896, 1200, { alt: mascot.name + '立绘' })]),
      el('div', { className: 'mascot-overlay' }, [el('span', { className: 'mascot-name', textContent: mascot.name + ' · ' + (mascot.id === 'sena' ? '星穹姬' : '昼樱姬') }), el('p', { id: 'mascot-speech', className: 'speech', 'aria-live': 'polite', textContent: speech || pickGreeting(mascot.id, new Date().getHours()) }), el('div', { className: 'mascot-controls' }, [['auto', '跟随主题'], ['sena', '星奈'], ['sakura', '樱雪']].map(([id, label]) => button(label, () => { state = saveState({ ...state, mascotId: id }); speech = ''; render(); }, { className: state.mascotId === id ? 'active' : '', 'aria-pressed': String(state.mascotId === id) })).concat(button('暂别', () => { state = saveState({ ...state, mascotHidden: true }); render(); })))])
    ]) : null]),
    el('section', { className: 'visual-gallery' }, [el('div', { className: 'gallery-heading' }, [el('div', {}, [el('p', { className: 'eyebrow', textContent: 'CHOOSE YOUR WORLDLINE' }), el('h2', { textContent: '✨ 精选世界线画廊' })]), el('span', { textContent: '点击即刻切换壁纸与主题' })]), el('div', { className: 'gallery-grid' }, THEMES.map(theme => el('button', { type: 'button', className: 'gallery-card' + (theme.id === state.theme ? ' active' : ''), 'aria-pressed': String(theme.id === state.theme), onClick: () => chooseTheme(theme.id) }, [picture(THEME_VISUALS[theme.id].bgWebp, THEME_VISUALS[theme.id].bgJpg, 1376, 768, { loading: 'lazy', alt: '' }), el('span', { className: 'gallery-caption' }, [el('strong', { textContent: theme.name }), el('small', { textContent: THEME_VISUALS[theme.id].sceneTitle }), theme.id === state.theme ? el('span', { className: 'gallery-current', textContent: '当前世界线' }) : null])])))]),
    el('section', {}, [el('h2', { textContent: '✦ 常用置顶' }), el('div', { className: 'grid' }, state.sites.filter((site) => site.pinned).map(card))]),
    el('section', { className: 'ai-radar-section' }, [
      el('div', { className: 'section-head ai-radar-header' }, [
        el('div', {}, [el('p', { className: 'eyebrow', textContent: 'MODEL INTELLIGENCE' }), el('h2', { textContent: '📡 AI 模型雷达 · 实时信息同步' }),
          el('div', { className: 'source-tags', 'aria-label': '数据来源新鲜度' }, sources.map(([key, label]) => el('span', { className: `source-badge ${freshness(key) === '实时' ? 'is-live' : ''}`, textContent: `${label} · ${freshness(key)}` }))),
        ]),
        el('div', { className: 'toolbar' }, [el('span', { className: 'badge', textContent: modes[radar.syncMode] || modes.snapshot }), radar.ollama ? link(`🦙 Ollama ${radar.ollama.version}`, radar.ollama.url) : null, button(syncing ? '同步中…' : '立即同步', sync, { id: 'btn-sync-ai-models', disabled: syncing })]),
      ]),
      chips(['全部', ...radar.providers.map((item) => ({ id: item.id, name: item.name }))], provider, (item) => { provider = item.id || item; render(); }),
      el('div', { className: 'grid radar-grid' }, radar.providers.filter((item) => provider === '全部' || item.id === provider).map(radarCard)),
    ]),
    el('section', {}, [el('div', { className: 'section-head' }, [el('h2', { textContent: '探索网址库' }), el('span', { id: 'count' })]), chips(['全部', ...listCategories(state.sites)], category, (item) => { category = item; sayFrom(CATEGORY_LINES, item); render(); }), el('div', { id: 'results', className: 'grid' })]),
    el('footer', { textContent: '✦ 在热爱中，发现更多可能 · NavHub' }),
  ]);
  root.replaceChildren(shell);
  results(); clock();
  if (focused) { const field = shell.querySelector('#global-search-input'); field.focus(); field.setSelectionRange(selection, selection); }
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
  if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || document.querySelector('dialog[open]')) return;
  if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
  event.preventDefault(); document.querySelector('#global-search-input')?.focus();
});
render();
setInterval(clock, 15000);
sync();
