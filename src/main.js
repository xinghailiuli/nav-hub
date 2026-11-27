import { DEFAULT_SEARCH_ENGINES } from './data/defaultSites.js';
import {
  THEMES, loadState, saveState, createDefaultState, addSite, updateSite,
  deleteSite, togglePin, listCategories, filterSites, buildSearchUrl,
  exportStateJson, importStateJson, isSafeHttpUrl, sanitizeCustomWallpaperInput,
  extractDomainLabel, resolveSiteEmblem, resolveSiteBrandId,
  isBundledWallpaperToken, parseBundledWallpaperId,
  buildSearchSuggestions, pickRandomSite,
} from './store.js';
import { loadAiRadarCache, fetchLiveAiRadar, formatContextWindow } from './aiRadar.js';
import snapshot from './data/aiModelsSnapshot.json';
import {
  THEME_VISUALS, HITOKOTO_LIST, CG_ARTWORKS, SITE_ARTWORKS, GALLERY_PET_NOTES,
  RANDOM_PICK_LINES, HAGEMI_PET, CROSSPET_ROSTER, resolveCrossPet, pickSiteArt,
} from './data/acgDialogues.js';

const root = document.querySelector('#app');
const shell = el('main', { className: 'shell' });
root.append(shell);
const backdropStage = document.querySelector('#backdrop-stage');
const backdropSource = document.querySelector('#backdrop-webp');
const backdropImage = document.querySelector('#backdrop-img');
const crossPets = Object.values(CROSSPET_ROSTER);
const supportsPopover = 'popover' in HTMLElement.prototype;
const PRIMARY_RADAR_IDS = new Set(['openai', 'anthropic', 'google', 'deepseek']);
let state = loadState();
let category = '全部';
let query = '';
let provider = '全部';
let radarExpanded = false;
let radar = loadAiRadarCache() ?? snapshot;
let syncing = false;
let petSyncing = false;
let petMood = 'idle';
let petSpeech = '';
let petTimer;
let quoteIndex = 0;
let lastPickedSiteId = null;
let spotlightSiteId = null;
let spotlightTimer;
let searchSuggestionsOpen = false;
let searchActiveIndex = -1;
let searchDismissed = false;
let searchComposing = false;
let lastSuggestedQuery = '';
let searchAnnounceTimer;
const activeGalleryCg = () => {
  const id = parseBundledWallpaperId(state.customWallpaper);
  return id ? CG_ARTWORKS.find((art) => art.id === id) || null : null;
};
const activePet = () => resolveCrossPet(state.mascotId) ?? CROSSPET_ROSTER.gemini;
const isCurrentMascot = (id) => !state.mascotHidden && activePet().id === id;
const mascotPickLabel = (current) => current ? '当前陪伴中' : '召唤陪伴';
const pickLine = (lines) => lines[Math.floor(Math.random() * lines.length)];
function setPetMood(mood, line = '', duration = 0) {
  clearTimeout(petTimer);
  petMood = mood;
  petSpeech = line;
  const pet = activePet();
  const art = shell.querySelector('.is-pet .mascot-art');
  const portrait = art?.firstElementChild;
  if (pet && portrait) {
    const webp = pet.poses[mood];
    const src = pet.id === 'gemini' ? HAGEMI_PET.poses[mood].png : webp;
    const source = portrait.querySelector('source');
    const image = portrait.matches('img') ? portrait : portrait.querySelector('img');
    if (source && source.getAttribute('srcset') !== webp) source.srcset = webp;
    if (image.getAttribute('src') !== src) image.src = src;
    art.classList.toggle('is-idle', mood === 'idle');
    const bubble = shell.querySelector('#mascot-speech');
    const text = line || pet.greeting;
    if (bubble.textContent !== text) bubble.textContent = text;
  }
  if (duration) petTimer = setTimeout(restPet, duration);
}
function restPet(searchFocused = document.activeElement?.id === 'global-search-input') {
  const pet = activePet();
  if (searchFocused) setPetMood('searching', pet.search);
  else if (petSyncing) setPetMood('thinking', pet.syncing);
  else setPetMood('idle', pickLine(pet.idle));
}
function resetPetMood() {
  clearTimeout(petTimer);
  petMood = 'idle';
  petSpeech = '';
}
function chooseTheme(id) {
  state = saveState({ ...state, theme: id, customWallpaper: '' });
  const pet = activePet();
  setPetMood('idle', pet.id === 'gemini' ? HAGEMI_PET.theme[id] : pickLine(pet.idle));
  render();
}
function picture(webp, fallback, width, height, alt = '', pictureAttrs = {}, imageAttrs = {}) {
  const image = el('img', { width, height, alt, decoding: 'async', ...imageAttrs });
  const node = el('picture', pictureAttrs, [el('source', { type: 'image/webp', srcset: webp }), image]);
  image.src = fallback;
  return node;
}
function petPortrait(pet, pose) {
  if (pet.id === 'gemini') {
    return picture(pet.poses[pose], HAGEMI_PET.poses[pose].png, 555, 640);
  }
  return el('img', { src: pet.poses[pose], alt: '', decoding: 'async' });
}
function petThumbnail(pet, size) {
  return el('img', { src: pet.poses.idle, width: size, height: size, alt: '', loading: 'lazy', decoding: 'async' });
}
function heroWallpaperCopy() {
  const visual = THEME_VISUALS[state.theme];
  const cg = activeGalleryCg();
  if (cg) {
    return {
      eyebrow: `星海观测帖 / ${cg.subtitle}`,
      subtitle: `${cg.title} · 自选原画壁纸`,
    };
  }
  if (isSafeHttpUrl(state.customWallpaper)) {
    return {
      eyebrow: '星海观测帖 / 自定义网络壁纸',
      subtitle: '已启用外部自定义背景',
    };
  }
  return {
    eyebrow: `星海观测帖 / ${visual.sceneTitle}`,
    subtitle: visual.tagline,
  };
}
function syncBackdrop() {
  const visual = THEME_VISUALS[state.theme];
  const cg = activeGalleryCg();
  const external = isSafeHttpUrl(state.customWallpaper) ? state.customWallpaper : '';
  const srcset = cg ? cg.bgWebp : external ? '' : visual.bgWebp;
  const src = cg ? cg.bgJpg : external || visual.bgJpg;
  if (backdropSource.getAttribute('srcset') !== srcset) backdropSource.srcset = srcset;
  if (backdropImage.getAttribute('src') !== src) backdropImage.src = src;
  if (backdropStage.dataset.backdropMode !== state.backdropMode) {
    backdropStage.dataset.backdropMode = state.backdropMode;
  }
}
function syncWallpaperUi() {
  syncBackdrop();
  const copy = heroWallpaperCopy();
  const eyebrow = shell.querySelector('.hero-panel .eyebrow');
  const subtitle = shell.querySelector('.hero-panel .hero-subtitle');
  if (eyebrow) eyebrow.textContent = copy.eyebrow;
  if (subtitle) subtitle.textContent = copy.subtitle;
  const activeId = activeGalleryCg()?.id || '';
  for (const cardBtn of shell.querySelectorAll('.cg-gallery-card')) {
    const cgId = cardBtn.dataset.cgId;
    const isWall = cgId === activeId;
    const pic = cardBtn.querySelector('picture');
    let badge = cardBtn.querySelector('.gallery-wall-badge');
    if (isWall && !badge && pic) {
      badge = el('span', { id: `cg-wall-badge-${cgId}`, className: 'gallery-wall-badge', textContent: '壁纸使用中' });
      pic.append(badge);
    } else if (!isWall && badge) {
      badge.remove();
    }
    if (isWall) cardBtn.setAttribute('aria-describedby', `cg-wall-badge-${cgId}`);
    else cardBtn.removeAttribute('aria-describedby');
  }
}
function wallpaperDialog(returnFocus) {
 const d = el('dialog', { id: 'wallpaper-dialog', closedby: 'any', 'aria-labelledby': 'wallpaper-title' });
 const cg = activeGalleryCg();
 let clearBundled = false;
 const cgNote = cg ? el('p', { className: 'wallpaper-cg-note', textContent: `当前首屏壁纸：原画廊 · ${cg.title}` }) : null;
 const externalValue = isSafeHttpUrl(state.customWallpaper) ? state.customWallpaper : '';
 const input = el('input', { type: 'url', value: externalValue, placeholder: 'https://example.com/wallpaper.jpg', 'aria-label': '自定义壁纸地址' });
 const error = el('p', { className: 'error', role: 'alert' });
 const modes = el('div', { className: 'chips' }, ['balanced', 'vivid'].map(mode => button(mode === 'balanced' ? '舒适磨砂' : '通透赏图', () => { state = saveState({ ...state, backdropMode: mode }); syncBackdrop(); modes.querySelectorAll('button').forEach(b => { const active = b.dataset.mode === mode; b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); }); }, { 'data-mode': mode, className: state.backdropMode === mode ? 'active' : '', 'aria-pressed': String(state.backdropMode === mode) })));
 d.append(el('form', { onSubmit: e => {
   e.preventDefault();
   try {
     const rawInput = input.value;
     const nextWallpaper = rawInput.trim()
       ? sanitizeCustomWallpaperInput(rawInput)
       : (cg && !clearBundled ? state.customWallpaper : '');
     state = saveState({ ...state, customWallpaper: nextWallpaper });
     syncWallpaperUi();
     d.close();
     toast('壁纸设置已保存');
   } catch (err) { error.textContent = err.message; }
 } }, [
   el('h2', { id: 'wallpaper-title', textContent: '壁纸与画质' }),
   el('p', { textContent: '选择背景通透度，或输入自定义壁纸地址。' }),
   modes,
   cgNote,
   el('label', {}, ['自定义壁纸地址', input]),
   error,
   el('div', { className: 'actions' }, [
     button('清空并恢复主题壁纸', () => {
       input.value = '';
       clearBundled = true;
       if (cgNote) cgNote.textContent = '保存后将恢复当前主题默认壁纸';
     }),
     button('取消', () => d.close()),
     el('button', { type: 'submit', textContent: '保存' }),
   ]),
 ]));
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
const BRAND_SVGS = {
  vndb: [
    ['path', { d: 'M12 2.5 20.5 9.5 12 21.5 3.5 9.5Z' }],
    ['path', { d: 'M3.5 9.5h17M8.5 9.5 12 21.5l3.5-12' }],
    ['path', { d: 'M8.5 9.5 12 2.5l3.5 7' }],
  ],
  ymgal: [
    ['path', { d: 'M13.2 2a3.4 3.4 0 1 0 2 4.4 2.7 2.7 0 0 1-2-4.4Z' }],
    ['path', { d: 'M3.5 19.5c2.8-1.3 5.7-1.3 8.5 0 2.8-1.3 5.7-1.3 8.5 0v-9c-2.8-1.2-5.7-1.2-8.5 0-2.8-1.2-5.7-1.2-8.5 0Z' }],
    ['path', { d: 'M12 10.5v9' }],
  ],
  '2dfan': [
    ['path', { d: 'M4 6a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 20 6v7.5a2.5 2.5 0 0 1-2.5 2.5H10.5l-4 3.5V16A2.5 2.5 0 0 1 4 13.5Z' }],
    ['path', { d: 'M12 6.2 13.1 8.7 15.6 9.8 13.1 10.9 12 13.4 10.9 10.9 8.4 9.8 10.9 8.7Z' }],
  ],
  steam: [
    ['circle', { cx: '14.5', cy: '8.5', r: '5' }],
    ['circle', { cx: '14.5', cy: '8.5', r: '1.8' }],
    ['circle', { cx: '8.5', cy: '17.5', r: '2.8' }],
    ['path', { d: 'M10 6.5 6 16M14.8 13.5l-4 2.5M3 13.5l3 2' }],
  ],
  bangumi: [
    ['rect', { x: '3.5', y: '4.5', width: '17', height: '16', rx: '2.5' }],
    ['path', { d: 'M8 2.8v3.2M16 2.8v3.2M3.5 9.5h17' }],
    ['path', { d: 'M7.5 15c1.3-2 2.8-2.8 4.5-2.8s3.2.8 4.5 2.8c-1.3 2-2.8 2.8-4.5 2.8S8.8 17 7.5 15Z' }],
    ['circle', { cx: '12', cy: '15', r: '1.1' }],
  ],
  bilibili: [
    ['path', { d: 'm8 3.2 3.2 3.3M16 3.2l-3.2 3.3' }],
    ['rect', { x: '3.5', y: '6.5', width: '17', height: '13', rx: '3' }],
    ['path', { d: 'm8 11.8 2-.8M16 11.8l-2-.8' }],
    ['circle', { cx: '12', cy: '14.8', r: '1.1' }],
  ],
  gamer: [
    ['path', { d: 'M6.5 3.5 9 6.5h6l2.5-3 1.8 4.5-1.3 8.5L12 21l-6-4.5L4.7 8Z' }],
    ['path', { d: 'm10.2 10 4.8 2.8-4.8 2.8Z' }],
    ['path', { d: 'm4.7 8 2.3 1.8M19.3 8l-2.3 1.8' }],
  ],
  mal: [
    ['path', { d: 'M5 4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5V12c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V4.5Z' }],
    ['path', { d: 'M8.5 14V8.5l3.5 3.2 3.5-3.2V14' }],
    ['path', { d: 'M9.5 16.5h5' }],
  ],
  anilist: [
    ['path', { d: 'M3.5 19.5 8.2 4.5l4.7 15' }],
    ['path', { d: 'M5.4 14.5h5.6' }],
    ['path', { d: 'M15.8 4.5v15h4.7' }],
  ],
  pixiv: [
    ['path', { d: 'M8 20.5V5.5c0-.8.7-1.5 1.5-1.5h3.8a5.2 5.2 0 0 1 0 10.4H8' }],
    ['path', { d: 'M6 5.5h2M6 20.5h4' }],
    ['circle', { cx: '13.2', cy: '9.2', r: '1.4' }],
  ],
  moegirl: [
    ['path', { d: 'M12 11.5C9.5 4.5 4 4.5 4 8.5c0 2.8 4 3.5 8 3Zm0 0c2.5-7 8-7 8-3 0 2.8-4 3.5-8 3Z' }],
    ['path', { d: 'M12 12.5c-4 1-6.5 4-6.5 6.5 0 1.8 3.5 1.5 6.5-6.5Zm0 0c4 1 6.5 4 6.5 6.5 0 1.8-3.5 1.5-6.5-6.5Z' }],
    ['circle', { cx: '12', cy: '12', r: '1.8' }],
  ],
  zhihu: [
    ['path', { d: 'M12 3.2 20.8 12 12 20.8l-3.2-3.2-3.8 1.4 1.4-3.8L3.2 12Z' }],
    ['path', { d: 'M9.8 10.2a2.4 2.4 0 1 1 3.6 2.1c-.8.5-1.4 1-1.4 1.9' }],
    ['circle', { cx: '12', cy: '16.4', r: '0.8' }],
  ],
  canva: [
    ['circle', { cx: '11', cy: '13', r: '7.5' }],
    ['path', { d: 'M13.8 10.2a3.8 3.8 0 1 0 0 5.6' }],
    ['path', { d: 'm13.5 10.5 5.2-5.2a1.4 1.4 0 0 1 2 2l-5.2 5.2-2.6.6Z' }],
  ],
  github: [
    ['path', { d: 'M7.5 19.5 4 16V9l1.8-4.5L9 6.5h6l3.2-2L20 9v7l-3.5 3.5Z' }],
    ['circle', { cx: '9.5', cy: '11.5', r: '1.4' }],
    ['circle', { cx: '14.5', cy: '11.5', r: '1.4' }],
    ['path', { d: 'M9.5 12.9v3.1M14.5 12.9c0 1.8-2.5 1.8-5 1.8' }],
  ],
  cloudflare: [
    ['path', { d: 'M6.5 15H18a3 3 0 0 0 .3-6 4.5 4.5 0 0 0-8.6-1.1 3.7 3.7 0 0 0-3.2 7.1Z' }],
    ['path', { d: 'M13.5 3.2 11.2 7h2.8l-2 3.5' }],
    ['path', { d: 'M4 18.5h16' }],
  ],
  edgeone: [
    ['path', { d: 'M5 5.5 12 3l7 2.5v6.5c0 4.6-2.9 7.8-7 9.2-4.1-1.4-7-4.6-7-9.2V5.5Z' }],
    ['path', { d: 'm8.8 9.2 3.4 3-3.4 3M12.8 9.2l3.4 3-3.4 3' }],
  ],
  deepl: [
    ['path', { d: 'M12 2.8 20 7.4v9.2L12 21.2 4 16.6V7.4Z' }],
    ['path', { d: 'm8 9.2 2.8 2M16 9.2l-2.8 2M12 13.5v3.3' }],
    ['circle', { cx: '12', cy: '12', r: '1.5' }],
  ],
  notion: [
    ['path', { d: 'M4.5 6.8 13.5 3.5l6 2.8v11.2l-9 3.2-6-2.8Z' }],
    ['path', { d: 'M4.5 6.8 10.5 9.6l9-3.3M10.5 9.6v11.1' }],
    ['path', { d: 'M13 16.8V10.5l4 5V9.2' }],
  ],
  txdocs: [
    ['path', { d: 'M7 3.5h7l4.5 4.5v11.5a1.5 1.5 0 0 1-1.5 1.5H7a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 7 3.5Z' }],
    ['path', { d: 'M14 3.5V8h4.5' }],
    ['rect', { x: '8.5', y: '11', width: '7', height: '6.5', rx: '0.8' }],
    ['path', { d: 'M8.5 14.2h7M12 11v6.5' }],
  ],
};

const EMBLEM_PATHS = {
  galgame: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H19v16.5H6.5A2.5 2.5 0 0 0 4 22V5.5Zm2.5 11.5H17M8 7.5h6',
  anime: 'M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11Zm6 2.7 5.2 2.8-5.2 2.8V9.2Z',
  art: 'M12 3a9 9 0 0 0 0 18h1.2a2.2 2.2 0 0 0 2.1-2.8 1.9 1.9 0 0 1 1.8-2.4H19a2 2 0 0 0 2-2A9 9 0 0 0 12 3Zm-3.5 6.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm4-2a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm3.5 2.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z',
  code: 'm8.5 8-4 4 4 4m7-8 4 4-4 4m-2-10-3 12',
  cloud: 'M7 18h9.5a4 4 0 0 0 .4-7.98A5.5 5.5 0 0 0 6.2 8.7 4 4 0 0 0 7 18Z',
  translate: 'M4 6h10M9 4v2c0 4.2-2.2 7.5-5 9.2M6.5 9.5c1.2 2.1 2.9 4 4.8 5.2M13.5 20l3.2-9 3.3 9m-5.5-3h4.5',
  docs: 'M7 3h7l4 4v13a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V4.5A1.5 1.5 0 0 1 7.5 3Zm3 7h5m-5 4h5m-5 4h3',
  ai: 'M12 3 14.3 9.2 20.5 11.5 14.3 13.8 12 20l-2.3-6.2L3.5 11.5l6.2-2.3Z',
};

function vectorIcon(primitives, size = 20) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const [tag, attrs] of primitives) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    svg.append(node);
  }
  return svg;
}

function emblemIcon(kind, size = 20) {
  const brandPrimitives = BRAND_SVGS[kind];
  if (brandPrimitives) return vectorIcon(brandPrimitives, size);
  return vectorIcon([['path', { d: EMBLEM_PATHS[kind] || EMBLEM_PATHS.ai }]], size);
}

function siteEmblem(site, size = 44) {
  const resolved = resolveSiteEmblem(site);
  const pet = resolved.type === 'pet' ? CROSSPET_ROSTER[resolved.petId] : null;
  if (pet) {
    return el('div', { className: 'card-emblem is-pet-emblem', 'aria-hidden': 'true' }, [
      petThumbnail(pet, size),
    ]);
  }
  const brandId = resolveSiteBrandId(site);
  return el('div', { className: 'card-emblem', 'aria-hidden': 'true' }, [
    emblemIcon(brandId || resolved.icon, size <= 32 ? 16 : 20),
  ]);
}

function focusByDataSiteId(selector, siteId) {
  const target = [...shell.querySelectorAll(selector)].find((node) => node.dataset.siteId === siteId);
  target?.focus({ preventScroll: true });
}

function pinnedTile(site) {
  const host = extractDomainLabel(site.url);
  const titleNode = isSafeHttpUrl(site.url)
    ? el('a', {
      className: 'card-link',
      href: site.url,
      target: '_blank',
      rel: 'noopener noreferrer',
      textContent: site.name,
      title: site.name,
    })
    : el('span', { className: 'card-link is-disabled', textContent: site.name, title: site.name });
  return el('article', {
    className: 'pinned-tile',
    style: `--site-accent:${safeAccent(site.accent)}`,
  }, [
    siteEmblem(site, 38),
    el('div', { className: 'pinned-meta' }, [
      el('h3', { className: 'card-title' }, [titleNode]),
      el('small', { textContent: host || site.category }),
    ]),
    button('★', () => {
      const pinnedIds = state.sites.filter((item) => item.pinned).map((item) => item.id);
      const pos = pinnedIds.indexOf(site.id);
      const nextPinId = pinnedIds[pos + 1] ?? pinnedIds[pos - 1] ?? null;
      state = saveState(togglePin(state, site.id));
      render();
      if (nextPinId) focusByDataSiteId('.pinned-unpin', nextPinId);
      else focusByDataSiteId('#results .fav-btn', site.id);
    }, {
      className: 'fav-btn pinned-unpin',
      'data-site-id': site.id,
      'aria-pressed': 'true',
      'aria-label': `置顶 ${site.name}`,
      title: '取消置顶',
    }),
  ]);
}

function card(site) {
  const host = extractDomainLabel(site.url);
  const titleNode = isSafeHttpUrl(site.url)
    ? el('a', {
      className: 'card-link',
      href: site.url,
      target: '_blank',
      rel: 'noopener noreferrer',
      textContent: site.name,
      title: site.name,
    })
    : el('span', { className: 'card-link is-disabled', textContent: site.name, title: site.name });
  return el('article', {
    className: site.id === spotlightSiteId ? 'site-card is-spotlight' : 'site-card',
    'data-site-id': site.id,
    style: `--site-accent:${safeAccent(site.accent)}`,
  }, [
    el('header', { className: 'card-top' }, [
      siteEmblem(site, 44),
      el('div', { className: 'card-head-text' }, [
        el('div', { className: 'card-title-row' }, [
          el('h3', { className: 'card-title' }, [titleNode]),
          el('small', { className: 'card-cat', textContent: site.category, title: site.category }),
        ]),
        el('small', { className: 'card-host', textContent: host || site.url }),
      ]),
    ]),
    el('p', { className: 'card-desc', textContent: site.description || '点击卡片前往该站点', title: site.description || site.name }),
    el('footer', { className: 'card-foot' }, [
      el('div', { className: 'tags' }, (site.tags || []).slice(0, 2).map((tag) => el('span', { className: 'tag-pill', textContent: tag }))),
      el('div', { className: 'actions' }, [
        button(site.pinned ? '★' : '☆', () => {
          state = saveState(togglePin(state, site.id));
          render();
          focusByDataSiteId('#results .fav-btn', site.id);
        }, {
          className: 'fav-btn',
          'data-site-id': site.id,
          'aria-pressed': String(Boolean(site.pinned)),
          'aria-label': `置顶 ${site.name}`,
          title: site.pinned ? '取消置顶' : '置顶',
        }),
        button('编辑', () => dialog(site), { className: 'edit-btn', 'aria-label': `编辑 ${site.name}` }),
        confirmButton('删除', () => { state = saveState(deleteSite(state, site.id)); render(); toast('网址已删除'); }, {
          className: 'del-btn',
          'aria-label': `删除 ${site.name}`,
        }),
      ]),
    ]),
  ]);
}
function siteCards(sites) {
  return sites.map((site) => card(site));
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
async function sync(event) {
  if (syncing) return;
  clearTimeout(initialSync);
  syncing = true;
  petSyncing = Boolean(event);
  if (petSyncing) setPetMood('thinking', activePet().syncing);
  renderAiRadarSection();
  try {
    fallbackKind = loadAiRadarCache() ? '缓存' : '快照';
    radar = await fetchLiveAiRadar({ fallbackSnapshot: snapshot });
  } catch (error) {
    toast(`同步失败：${error.message}`);
  } finally {
    syncing = false;
    const showPetResult = petSyncing;
    petSyncing = false;
    const currentPet = activePet();
    const mode = radar.syncMode === 'partial-live' ? 'partialLive' : radar.syncMode;
    if (showPetResult) setPetMood('happy', currentPet[mode] || currentPet.snapshot, 2000);
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
  const pet = crossPets.find((character) => character.radarVendorId && character.radarVendorId === item.id);
  return el('article', { className: 'radar-card', 'data-vendor-id': item.id }, [
    el('div', { className: 'section-head radar-card-heading' }, [
      el('h3', { textContent: item.name }),
      pet ? el('button', {
        type: 'button', className: 'radar-pet-btn', 'data-pick': pet.id,
        'aria-label': summonLabel(pet), title: summonLabel(pet),
        onClick: () => {
          summonPet(pet.id);
          toast(`${pet.name} 已来陪伴`);
        },
      }, [petThumbnail(pet, 32)]) : null,
    ]),
    el('div', { className: 'radar-status-row' }, [
      el('span', { className: 'status', textContent: item.status?.description || '状态未知' }),
    ]),
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
  const visible = radar.providers.filter((item) => provider === '全部' || item.id === provider);
  const splitExtra = provider === '全部';
  const primaryList = splitExtra ? visible.filter((item) => PRIMARY_RADAR_IDS.has(item.id)) : visible;
  const secondaryList = splitExtra ? visible.filter((item) => !PRIMARY_RADAR_IDS.has(item.id)) : [];
  return [
    el('div', { className: 'section-head ai-radar-header' }, [
      el('div', {}, [
        el('p', { className: 'eyebrow', textContent: 'AI 模型情报' }),
        el('h2', { id: 'ai-radar-title', className: 'section-title', textContent: 'AI 模型雷达' }),
        el('div', { className: 'source-tags', 'aria-label': '数据来源新鲜度' }, sources.map(([key, label]) => el('span', { className: `source-badge ${freshness(key) === '实时' ? 'is-live' : ''}`, textContent: `${label} · ${freshness(key)}` }))),
      ]),
      el('div', { className: 'radar-toolbar' }, [
        el('span', { className: 'badge', role: 'status', textContent: modes[radar.syncMode] || modes.snapshot }),
        radar.ollama ? Object.assign(link(`🦙 Ollama ${radar.ollama.version}`, radar.ollama.url), { id: 'radar-ollama-link' }) : null,
        button(syncing ? '同步中…' : '立即同步', sync, { id: 'btn-sync-ai-models', 'aria-disabled': String(syncing) }),
      ]),
    ]),
    chips(['全部', ...radar.providers.map((item) => ({ id: item.id, name: item.name }))], provider, (item) => {
      provider = item.id || item;
      renderAiRadarSection();
    }),
    el('div', { className: 'grid radar-grid' }, primaryList.map(radarCard)),
    secondaryList.length ? el('div', {
      id: 'radar-extra',
      className: 'radar-extra-panel',
      hidden: !radarExpanded,
    }, [el('div', { className: 'grid radar-grid' }, secondaryList.map(radarCard))]) : null,
    secondaryList.length ? el('div', { className: 'radar-extra-toggle' }, [
      button(radarExpanded ? '收起次级厂商' : `展开其余 ${secondaryList.length} 家（Qwen · xAI · Moonshot · Zhipu）`, () => {
        radarExpanded = !radarExpanded;
        renderAiRadarSection();
      }, {
        id: 'btn-toggle-radar-extra',
        'aria-controls': 'radar-extra',
        'aria-expanded': String(radarExpanded),
      }),
    ]) : null,
  ];
}
function renderAiRadarSection() {
  const body = document.querySelector('#ai-radar-body');
  if (!body) return;
  const active = document.activeElement;
  const focusedButton = body.contains(active) ? active.closest('button, a') : null;
  const focusedPick = focusedButton?.dataset.pick;
  const focusedVendor = focusedButton?.closest('.radar-card')?.dataset.vendorId;
  const focusedHref = focusedButton?.tagName === 'A' ? focusedButton.getAttribute('href') : '';
  body.replaceChildren(...aiRadarContent());
  const toggleBtn = body.querySelector('#btn-toggle-radar-extra');
  if (focusedButton?.id === 'btn-sync-ai-models') {
    body.querySelector('#btn-sync-ai-models')?.focus({ preventScroll: true });
  } else if (focusedButton?.id === 'radar-ollama-link') {
    (body.querySelector('#radar-ollama-link') ?? body.querySelector('#btn-sync-ai-models'))?.focus({ preventScroll: true });
  } else if (focusedButton?.id === 'btn-toggle-radar-extra') {
    toggleBtn?.focus({ preventScroll: true });
  } else if (focusedButton?.dataset.value) {
    [...body.querySelectorAll('.chips button')].find((item) => item.dataset.value === focusedButton.dataset.value)
      ?.focus({ preventScroll: true });
  } else if (focusedPick) {
    const pickTarget = [...body.querySelectorAll('.radar-pet-btn')].find((item) => item.dataset.pick === focusedPick);
    (pickTarget?.offsetParent ? pickTarget : toggleBtn)?.focus({ preventScroll: true });
  } else if (focusedHref) {
    const linkTarget = [...body.querySelectorAll('.radar-card a')].find((item) => item.getAttribute('href') === focusedHref && (!focusedVendor || item.closest('.radar-card')?.dataset.vendorId === focusedVendor));
    (linkTarget?.offsetParent ? linkTarget : toggleBtn)?.focus({ preventScroll: true });
  }
}
function setMascotHidden(hidden) {
  state = saveState({ ...state, mascotHidden: hidden });
  if (hidden) closePetSwitcher();
  syncMascotVisibility();
}
function syncMascotVisibility() {
  const { mascotHidden: hidden } = state;
  shell.querySelector('#mascot-panel').hidden = hidden;
  shell.querySelector('.recall').hidden = !hidden;
  const command = shell.querySelector('#toggle-mascot');
  command.textContent = hidden ? '呼出看板娘' : '隐藏看板娘';
  for (const pick of shell.querySelectorAll('.mascot-pick')) {
    const current = isCurrentMascot(pick.dataset.pick);
    pick.textContent = mascotPickLabel(current, pick.dataset.pick);
    pick.disabled = current;
    pick.setAttribute('aria-pressed', String(current));
  }
}
function topbarTools(file) {
  topbarTools.cleanup?.();
  topbarTools.cleanup = null;
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
            resetPetMood();
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

function summonLabel(character) {
  return `召唤 ${character.name.replace(' · ', ' ')}`;
}

function summonPet(id) {
  const pet = resolveCrossPet(id) ?? CROSSPET_ROSTER.gemini;
  state = saveState({ ...state, mascotId: pet.id, mascotHidden: false });
  resetPetMood();
  petMood = 'happy';
  petSpeech = pet.greeting;
  closePetSwitcher();
  const previous = shell.querySelector('#mascot-panel');
  const outgoing = previous.hidden ? null : previous.querySelector('.mascot-art').firstElementChild;
  const next = mascotPanel();
  previous.replaceWith(next);
  syncMascotVisibility();
  const portrait = next.querySelector('.mascot-art');
  const incoming = portrait.firstElementChild;
  if (incoming.animate && !state.motionPaused && matchMedia('(prefers-reduced-motion: no-preference)').matches) {
    incoming.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease' });
    if (outgoing) {
      outgoing.classList.add('pet-outgoing');
      outgoing.style.setProperty('--pet-glow', previous.style.getPropertyValue('--pet-glow'));
      portrait.append(outgoing);
      const fade = outgoing.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease' });
      fade.finished.finally(() => outgoing.remove()).catch(() => {});
    }
  }
  petTimer = setTimeout(restPet, 1600);
}

function setPetSwitcherOpen(menu, open) {
  if (!supportsPopover) {
    menu.classList.toggle('is-open', open);
    menu.inert = !open;
  }
  menu.previousElementSibling.setAttribute('aria-expanded', String(open));
}

function closePetSwitcher(restoreFocus = false) {
  const menu = shell.querySelector('#pet-switcher-menu');
  if (!menu) return;
  const trigger = menu.previousElementSibling;
  if (supportsPopover) {
    if (menu.matches(':popover-open')) menu.hidePopover();
  } else setPetSwitcherOpen(menu, false);
  if (restoreFocus) trigger.focus({ preventScroll: true });
}

function mascotControl(id, label, icon, action) {
  return el('button', { id, type: 'button', 'aria-label': label, title: label, onClick: action }, [
    el('span', { 'aria-hidden': 'true', textContent: icon }),
    el('span', { className: 'pet-control-label', textContent: label }),
  ]);
}

function petSwitcher(pet) {
  const trigger = el('button', {
    id: 'pet-switcher-trigger', type: 'button', popovertarget: 'pet-switcher-menu',
    'aria-haspopup': 'menu', 'aria-controls': 'pet-switcher-menu', 'aria-expanded': 'false',
    'aria-label': `选桌宠，当前为 ${pet.name}`, title: '选桌宠',
  }, [
    petThumbnail(pet, 24),
    el('span', { className: 'pet-control-label pet-trigger-name', textContent: pet.shortName }),
    el('span', { className: 'pet-control-label', 'aria-hidden': 'true', textContent: '▾' }),
  ]);
  const option = (character) => el('button', {
    type: 'button', role: 'menuitemradio', tabindex: -1, 'data-pick': character.id,
    'aria-checked': String(character.id === pet.id), 'aria-label': summonLabel(character),
    title: character.name, autofocus: character.id === pet.id,
    onClick: () => {
      summonPet(character.id);
      shell.querySelector('#pet-switcher-trigger').focus({ preventScroll: true });
    },
  }, [petThumbnail(character, 36), el('span', { className: 'pet-opt-label', textContent: character.shortName })]);
  const group = el('div', { role: 'menu', 'aria-label': '选桌宠', focusgroup: 'menu nomemory' }, [
    el('div', { className: 'pet-switcher-grid', role: 'presentation' }, crossPets.map(option)),
  ]);
  const items = [...group.querySelectorAll('button')];
  const selected = group.querySelector('[aria-checked=true]');
  const menu = el('div', {
    id: 'pet-switcher-menu', popover: 'auto', 'data-fallback': !supportsPopover, inert: !supportsPopover,
    onFocusOut: (event) => {
      if (event.relatedTarget && event.relatedTarget !== trigger && !menu.contains(event.relatedTarget)) closePetSwitcher();
    },
    onKeyDown: (event) => {
      const i = items.indexOf(event.target);
      if (i < 0) return;
      const next = {
        ArrowLeft: (i - 1 + items.length) % items.length,
        ArrowRight: (i + 1) % items.length,
        ArrowUp: (i - 3 + items.length) % items.length,
        ArrowDown: (i + 3) % items.length,
        Home: 0,
        End: items.length - 1,
      }[event.key];
      if (!Number.isInteger(next)) return;
      event.preventDefault();
      items[next].focus();
    },
  }, [group]);
  if (supportsPopover) {
    menu.addEventListener('beforetoggle', (event) => setPetSwitcherOpen(menu, event.newState === 'open'));
  } else {
    trigger.addEventListener('click', () => {
      const open = !menu.classList.contains('is-open');
      setPetSwitcherOpen(menu, open);
      if (open) selected.focus();
    });
  }
  trigger.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (supportsPopover) menu.showPopover();
    else setPetSwitcherOpen(menu, true);
    const item = event.key === 'ArrowUp' ? items.at(-1) : selected;
    item.focus();
  });
  return [trigger, menu];
}

function mascotPanel() {
  const pet = activePet();
  const name = pet.name + ' · ' + pet.title;
  const portrait = el('button', {
    type: 'button', className: petMood === 'idle' ? 'mascot-art is-idle' : 'mascot-art',
    'aria-label': `戳一戳${pet.name}`,
    onClick: () => setPetMood('surprised', pickLine(pet.poke), 1200),
  }, [petPortrait(pet, petMood)]);
  const bubble = el('p', {
    id: 'mascot-speech', className: 'speech', 'aria-live': 'polite',
    textContent: petSpeech || pet.greeting,
  });
  return el('aside', {
    id: 'mascot-panel', className: 'mascot-stage is-pet', hidden: state.mascotHidden,
    style: `--pet-glow:${pet.accent}`,
  }, [
    portrait,
    el('div', { className: 'mascot-dialogue' }, [
      el('span', { className: 'mascot-name', textContent: name }),
      el('div', { className: 'pet-bubble' }, [bubble]),
      el('div', { className: 'mascot-controls' }, [
        mascotControl('pet-pat', '摸摸头', '✋', () => setPetMood('pat', pickLine(pet.pat), 2000)),
        mascotControl('pet-next', '换一只', '🎲', () => {
          const index = crossPets.indexOf(pet);
          summonPet(crossPets[(index + 1) % crossPets.length].id);
          shell.querySelector('#pet-next').focus({ preventScroll: true });
        }),
        ...petSwitcher(pet),
        mascotControl('pet-hide', '暂别', '✕', () => {
          setMascotHidden(true);
          shell.querySelector('.recall').focus({ preventScroll: true });
        }),
      ]),
    ]),
  ]);
}

function mascotProfileButton(id) {
  const current = isCurrentMascot(id);
  return button(mascotPickLabel(current), (event) => {
    const card = event.currentTarget.closest('figure');
    summonPet(id);
    card.focus({ preventScroll: true });
  }, { className: 'mascot-pick', 'data-pick': id, disabled: current, 'aria-pressed': String(current) });
}

function mascotGallery() {
  return el('section', { className: 'mascot-gallery-section', 'aria-labelledby': 'mascot-gallery-title' }, [
    el('div', { className: 'section-head' }, [
      el('h2', { id: 'mascot-gallery-title', className: 'section-title', textContent: '桌宠伙伴 · CrossPet 图鉴' }),
      el('span', { textContent: '轻点召唤到首页右下角陪伴' }),
    ]),
    el('div', { className: 'mascot-gallery' }, crossPets.map((pet) => el('figure', {
      className: 'pet-profile', tabindex: -1, 'aria-labelledby': `pet-name-${pet.id}`,
      style: `--pet-accent:${pet.accent}`,
    }, [
      petThumbnail(pet, 72),
      el('figcaption', { className: 'mascot-info' }, [
        el('div', { className: 'mascot-title-row' }, [
          el('strong', { id: `pet-name-${pet.id}`, textContent: pet.name }),
          el('small', { textContent: pet.title }),
        ]),
        el('p', { className: 'mascot-line', textContent: pet.greeting }),
        mascotProfileButton(pet.id),
      ]),
    ]))),
  ]);
}

function openCgLightbox(index, trigger) {
  const d = el('dialog', { id: 'cg-lightbox', closedby: 'any', 'aria-labelledby': 'cg-lightbox-title' });
  const view = el('div', { className: 'lightbox-view' });
  const title = el('h2', { id: 'cg-lightbox-title' });
  const subtitle = el('p');
  const pet = activePet();
  const noteText = el('span', { id: 'lightbox-pet-note' });
  const lightboxStatus = el('p', {
    id: 'lightbox-status', className: 'sr-only',
    role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true',
  });
  const petThumb = petThumbnail(pet, 32);
  const petStrip = el('div', { className: 'lightbox-pet' }, [petThumb, noteText]);
  const wallBtn = button('设为首屏壁纸', () => {
    const art = CG_ARTWORKS[index];
    const alreadyActive = activeGalleryCg()?.id === art.id;
    state = saveState({ ...state, customWallpaper: alreadyActive ? '' : `cg:${art.id}` });
    syncWallpaperUi();
    updateWallBtn(art);
    if (alreadyActive) {
      lightboxStatus.textContent = '已恢复当前主题默认壁纸';
      toast('已恢复当前主题默认壁纸');
      const resetLine = '已切回主题默认背景喵～';
      noteText.textContent = resetLine;
      setPetMood('happy', resetLine, 2200);
    } else {
      lightboxStatus.textContent = `已将《${art.title}》设为首屏壁纸`;
      toast(`已将《${art.title}》设为首屏壁纸`);
      const setLine = GALLERY_PET_NOTES[art.id] || '新壁纸换好啦喵！';
      noteText.textContent = setLine;
      setPetMood('happy', setLine, 2600);
    }
    wallBtn.focus({ preventScroll: true });
  }, { id: 'btn-cg-set-wallpaper', 'aria-pressed': 'false' });
  const updateWallBtn = (art) => {
    const isWall = activeGalleryCg()?.id === art.id;
    wallBtn.textContent = isWall ? '还原主题壁纸' : '设为首屏壁纸';
    wallBtn.classList.toggle('active-wall', isWall);
    wallBtn.setAttribute('aria-pressed', String(isWall));
  };
  const show = (offset) => {
    index = (index + offset + CG_ARTWORKS.length) % CG_ARTWORKS.length;
    const art = CG_ARTWORKS[index];
    view.replaceChildren(picture(art.bgWebp, art.bgJpg, 1376, 768, art.title));
    title.textContent = art.title;
    subtitle.textContent = art.subtitle;
    updateWallBtn(art);
    const line = GALLERY_PET_NOTES[art.id] || pet.greeting;
    noteText.textContent = line;
    setPetMood('happy', line, 2600);
  };
  d.append(view, lightboxStatus, el('div', { className: 'lightbox-bar' }, [
    el('div', { 'aria-live': 'polite' }, [title, subtitle]),
    petStrip,
    el('div', { className: 'actions' }, [
      wallBtn,
      button('上一张', () => show(-1)),
      button('下一张', () => show(1)),
      button('关闭', () => d.close(), { autofocus: true }),
    ]),
  ]));
  d.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    show(event.key === 'ArrowLeft' ? -1 : 1);
  });
  d.addEventListener('close', () => trigger.focus({ preventScroll: true }));
  show(0);
  showDialog(d);
}

function buildSearchWidget(engine) {
  clearTimeout(searchAnnounceTimer);
  const searchPet = () => {
    const pet = activePet();
    if (pet) setPetMood('searching', pet.search);
  };
  const listbox = el('div', {
    id: 'search-suggestions', className: 'search-suggestions',
    role: 'listbox', 'aria-label': '站内匹配结果', hidden: true,
  });
  const liveStatus = el('p', {
    id: 'search-suggestion-status', className: 'sr-only',
    'aria-live': 'polite', 'aria-atomic': 'true',
  });
  let currentOptions = [];
  let input;

  const setActiveOption = (nextIndex) => {
    searchActiveIndex = nextIndex;
    const nodes = [...listbox.querySelectorAll('[role=option]')];
    nodes.forEach((node, idx) => {
      const selected = idx === nextIndex;
      node.classList.toggle('is-active', selected);
      node.setAttribute('aria-selected', String(selected));
      if (selected) node.scrollIntoView({ block: 'nearest' });
    });
    if (nextIndex >= 0 && nodes[nextIndex]) {
      input.setAttribute('aria-activedescendant', nodes[nextIndex].id);
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  };

  const closeSuggestions = ({ dismiss = true } = {}) => {
    clearTimeout(searchAnnounceTimer);
    searchSuggestionsOpen = false;
    searchActiveIndex = -1;
    lastSuggestedQuery = '';
    if (dismiss) searchDismissed = true;
    listbox.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  };

  const activateOption = (opt) => {
    if (!opt) return;
    closeSuggestions({ dismiss: true });
    if (opt.kind === 'site' && isSafeHttpUrl(opt.site.url)) {
      window.open(opt.site.url, '_blank', 'noopener,noreferrer');
    } else if (opt.kind === 'engine') {
      const url = buildSearchUrl(engine.id, input.value);
      if (isSafeHttpUrl(url)) window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const updateSuggestions = (shouldAnnounce = false) => {
    clearTimeout(searchAnnounceTimer);
    const trimmed = input.value.trim();
    if (!trimmed || searchDismissed) {
      closeSuggestions({ dismiss: false });
      return;
    }
    lastSuggestedQuery = trimmed;
    const { totalMatches, items } = buildSearchSuggestions(state.sites, trimmed, 6);
    currentOptions = [
      ...items.map((site) => ({ kind: 'site', site })),
      { kind: 'engine', queryText: trimmed },
    ];
    listbox.replaceChildren(
      ...items.map((site, idx) => el('button', {
        id: `search-opt-${idx}`, type: 'button', role: 'option', className: 'suggestion-item',
        'aria-selected': 'false', tabindex: -1,
        onPointerDown: (e) => e.preventDefault(),
        onClick: () => activateOption(currentOptions[idx]),
      }, [
        el('span', { className: 'suggestion-main' }, [
          siteEmblem(site, 28),
          el('span', { className: 'suggestion-text' }, [
            el('span', { className: 'suggestion-title', textContent: site.name }),
            el('small', { className: 'suggestion-host', textContent: extractDomainLabel(site.url) || site.url }),
          ]),
        ]),
        el('span', { className: 'suggestion-cat', textContent: site.category }),
      ])),
      el('button', {
        id: `search-opt-${items.length}`, type: 'button', role: 'option',
        className: 'suggestion-item suggestion-engine', 'aria-selected': 'false', tabindex: -1,
        onPointerDown: (e) => e.preventDefault(),
        onClick: () => activateOption(currentOptions[items.length]),
      }, [
        el('span', { textContent: `使用 ${engine.name} 搜索「${trimmed}」` }),
        el('span', { 'aria-hidden': 'true', textContent: 'Enter ↗' }),
      ]),
    );
    searchSuggestionsOpen = true;
    listbox.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    setActiveOption(Math.min(searchActiveIndex, currentOptions.length - 1));

    if (shouldAnnounce) {
      searchAnnounceTimer = setTimeout(() => {
        if (!searchSuggestionsOpen) return;
        liveStatus.textContent = totalMatches === 0
          ? '没有匹配的网址'
          : totalMatches > items.length
            ? `匹配 ${totalMatches} 个网址，显示前 ${items.length} 个`
            : `匹配 ${totalMatches} 个网址`;
      }, 200);
    }
  };

  input = el('input', {
    id: 'global-search-input', 'aria-label': '搜索网站或输入关键词',
    placeholder: '搜索网站或输入关键词', value: query,
    role: 'combobox', 'aria-autocomplete': 'list',
    'aria-controls': 'search-suggestions', 'aria-expanded': 'false',
    onFocus: () => {
      searchPet();
      if (input.value.trim() && !searchDismissed) updateSuggestions(false);
    },
    onBlur: () => {
      closeSuggestions({ dismiss: false });
      if (petMood === 'searching') restPet(false);
    },
    onCompositionStart: () => { searchComposing = true; },
    onCompositionEnd: (event) => {
      searchComposing = false;
      searchDismissed = false;
      searchActiveIndex = -1;
      query = event.target.value;
      results();
      updateSuggestions(true);
    },
    onInput: (event) => {
      query = event.target.value;
      results();
      if (searchComposing) return;
      const nextTrimmed = event.target.value.trim();
      if (nextTrimmed === lastSuggestedQuery && searchSuggestionsOpen) return;
      searchDismissed = false;
      searchActiveIndex = -1;
      searchPet();
      updateSuggestions(true);
    },
    onKeyDown: (event) => {
      if (searchComposing || event.isComposing) return;
      if (event.key === 'Escape' && searchSuggestionsOpen) {
        event.preventDefault();
        event.stopPropagation();
        closeSuggestions({ dismiss: true });
        return;
      }
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && input.value.trim()) {
        event.preventDefault();
        if (!searchSuggestionsOpen) {
          searchDismissed = false;
          updateSuggestions(false);
        }
        const total = currentOptions.length;
        if (total === 0) return;
        const next = searchActiveIndex < 0
          ? (event.key === 'ArrowDown' ? 0 : total - 1)
          : (event.key === 'ArrowDown' ? (searchActiveIndex + 1) % total : (searchActiveIndex - 1 + total) % total);
        setActiveOption(next);
        return;
      }
      if (event.key === 'Enter' && searchSuggestionsOpen && searchActiveIndex >= 0) {
        event.preventDefault();
        activateOption(currentOptions[searchActiveIndex]);
      }
    },
  });

  const engineSearch = el('form', {
    className: 'search', role: 'search',
    onSubmit: (event) => {
      event.preventDefault();
      closeSuggestions({ dismiss: true });
      const url = buildSearchUrl(engine.id, input.value);
      if (isSafeHttpUrl(url)) window.open(url, '_blank', 'noopener,noreferrer');
    },
  }, [
    searchIcon(),
    input,
    el('kbd', { className: 'search-kbd', 'aria-hidden': 'true', textContent: 'Enter' }),
    button('清空', () => {
      query = '';
      input.value = '';
      searchDismissed = false;
      closeSuggestions({ dismiss: false });
      results();
      input.focus();
    }, { className: 'clear-search', 'aria-label': '清空搜索' }),
    el('button', { type: 'submit', textContent: `${engine.name} 搜索` }),
  ]);

  return {
    wrap: el('div', { className: 'search-wrap' }, [engineSearch, listbox, liveStatus]),
    input,
    closeSuggestions,
  };
}

function recommendRandomSite() {
  clearTimeout(spotlightTimer);
  const visible = filterSites(state.sites, { category, query });
  const picked = pickRandomSite(visible, lastPickedSiteId);
  const statusEl = shell.querySelector('#directory-spotlight-status');
  for (const prev of shell.querySelectorAll('#results .site-card.is-spotlight')) {
    prev.classList.remove('is-spotlight');
  }
  if (!picked) {
    spotlightSiteId = null;
    if (statusEl) statusEl.textContent = '当前筛选下没有可推荐的网址';
    toast('当前筛选下没有可推荐的网址');
    return;
  }
  lastPickedSiteId = picked.id;
  spotlightSiteId = picked.id;
  const targetCard = [...shell.querySelectorAll('#results .site-card')].find((c) => c.dataset.siteId === picked.id);
  if (targetCard) {
    targetCard.classList.add('is-spotlight');
    const instant = state.motionPaused || matchMedia('(prefers-reduced-motion: reduce)').matches;
    targetCard.scrollIntoView({ behavior: instant ? 'auto' : 'smooth', block: 'center' });
    targetCard.querySelector('.card-link')?.focus({ preventScroll: true });
  }
  if (statusEl) statusEl.textContent = `今日推荐 · ${picked.name}`;
  toast(`🎲 今日推荐：${picked.name}`);
  setPetMood('happy', pickLine(RANDOM_PICK_LINES), 2600);
  spotlightTimer = setTimeout(() => {
    targetCard?.classList.remove('is-spotlight');
    if (spotlightSiteId === picked.id) spotlightSiteId = null;
  }, 4500);
}

let activeSearchControl = null;

function render() {
  clearTimeout(searchAnnounceTimer);
  const active = document.activeElement;
  const activeId = active?.id;
  const selection = activeId === 'global-search-input'
    ? [active.selectionStart, active.selectionEnd, active.selectionDirection] : null;
  const themeFocus = active?.closest('.theme-group, .gallery-themes, .gallery-grid');
  apply();
  syncBackdrop();
  const wallCopy = heroWallpaperCopy();
  const activeCgId = activeGalleryCg()?.id || '';
  const engine = DEFAULT_SEARCH_ENGINES.find((item) => item.id === state.searchEngineId) || DEFAULT_SEARCH_ENGINES[0];
  const searchWidget = buildSearchWidget(engine);
  activeSearchControl = searchWidget;
  const input = searchWidget.input;
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
      resetPetMood();
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
      el('p', { className: 'eyebrow', textContent: wallCopy.eyebrow }),
      el('h1', {}, [
        el('span', { className: 'hero-title-accent', textContent: '发现属于你的' }),
        '星空',
      ]),
      el('p', { className: 'hero-subtitle', textContent: wallCopy.subtitle }),
      el('div', { className: 'hitokoto' }, [el('span', { id: 'quote-text', textContent: HITOKOTO_LIST[quoteIndex].quote + ' — ' + HITOKOTO_LIST[quoteIndex].source }), button('换一句', () => { quoteIndex = (quoteIndex + 1) % HITOKOTO_LIST.length; document.querySelector('#quote-text').textContent = HITOKOTO_LIST[quoteIndex].quote + ' — ' + HITOKOTO_LIST[quoteIndex].source; })]), el('p', { id: 'clock', className: 'clock' }),
      searchWidget.wrap,
      chips(DEFAULT_SEARCH_ENGINES, state.searchEngineId, (item) => { state = saveState({ ...state, searchEngineId: item.id }); render(); }),
      quickPinNav,
      el('small', { className: 'search-hint', textContent: '按 / 快速搜索' }),
      button('✦ 呼出看板娘', () => {
        setMascotHidden(false);
        shell.querySelector('.mascot-art').focus({ preventScroll: true });
      }, { className: 'recall', hidden: !state.mascotHidden }),
    ]), el('div', { className: 'hero-scenic-window' }, [
      mascotPanel(),
    ])]),
    el('div', { className: 'editorial-content' }, [
        el('section', {}, [
          el('div', { className: 'section-head' }, [
            el('h2', { className: 'section-title', textContent: '常用置顶' }),
            el('span', { textContent: '高频直达捷径，点击星标可取消置顶' }),
          ]),
          el('div', { className: 'pinned-grid' }, state.sites.filter((site) => site.pinned).map(pinnedTile)),
        ]),
        el('section', {}, [
          el('div', { className: 'section-head' }, [
            el('h2', { className: 'section-title', textContent: '探索网址库' }),
            el('div', { className: 'section-meta-actions' }, [
              el('span', { id: 'count' }),
              el('button', {
                id: 'btn-random-site', type: 'button', className: 'random-site-btn',
                onClick: recommendRandomSite,
              }, [
                el('span', { 'aria-hidden': 'true', textContent: '🎲' }),
                '随机推站',
              ]),
            ]),
          ]),
          el('p', { id: 'directory-spotlight-status', className: 'sr-only', role: 'status', 'aria-live': 'polite' }),
          chips(['全部', ...listCategories(state.sites)], category, (item) => {
            category = item;
            const pet = activePet();
            setPetMood('idle', pet.id === 'gemini' ? HAGEMI_PET.category[item] ?? HAGEMI_PET.category['全部'] : pickLine(pet.idle));
            render();
          }),
          el('div', { id: 'results', className: 'grid' }),
        ]),
        el('section', { className: 'visual-gallery' }, [
          el('div', { className: 'gallery-heading' }, [
            el('h2', { className: 'section-title', textContent: 'Galgame 名作 · 原画廊' }),
            el('div', { className: 'chips gallery-themes', role: 'group', 'aria-label': '切换首页世界线壁纸' }, THEMES.map((theme) => {
              const active = theme.id === state.theme;
              return button(theme.name, () => chooseTheme(theme.id), {
                className: active ? 'active' : '',
                'aria-pressed': String(active),
              });
            })),
          ]),
          el('div', { className: 'gallery-grid' }, CG_ARTWORKS.map((art, index) => {
            const isWall = activeCgId === art.id;
            const pic = picture(art.thumbWebp, art.bgJpg, 640, 360, '', {}, { loading: 'lazy' });
            if (isWall) pic.append(el('span', { id: `cg-wall-badge-${art.id}`, className: 'gallery-wall-badge', textContent: '壁纸使用中' }));
            return el('button', {
              type: 'button', className: 'gallery-card cg-gallery-card',
              'data-cg-id': art.id,
              'aria-haspopup': 'dialog',
              'aria-describedby': isWall ? `cg-wall-badge-${art.id}` : null,
              onClick: (event) => openCgLightbox(index, event.currentTarget),
            }, [
              pic,
              el('span', { className: 'gallery-caption' }, [
                el('strong', { textContent: art.title }),
                el('small', { textContent: art.subtitle }),
              ]),
            ]);
          })),
        ]),
        el('section', { id: 'ai-radar-section', className: 'ai-radar-section' }, [
          el('div', { id: 'ai-radar-body' }, aiRadarContent()),
        ]),
        mascotGallery(),
        el('footer', {}, [
          el('p', { textContent: '✦ 在热爱中，发现更多可能 · NavHub' }),
          el('p', { className: 'pet-credit', textContent: '桌宠立绘 CC BY-NC-SA 4.0（CrossPet / lokicorvus / ZipZipPipe / 上善无形）· 官方游戏 CG 版权归各原作社团所有（详见 NOTICE.md）' }),
        ]),
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
    const selected = themeFocus.matches('.theme-group') ? selectedTheme : shell.querySelector('.gallery-themes button.active, .gallery-card.active');
    selected?.focus({ preventScroll: true });
  }
}
function results() {
  const sites = filterSites(state.sites, { category, query });
  if (spotlightSiteId && !sites.some((s) => s.id === spotlightSiteId)) {
    spotlightSiteId = null;
  }
  document.querySelector('#results')?.replaceChildren(...siteCards(sites));
  const count = document.querySelector('#count');
  if (count) count.textContent = `${sites.length} 个网址`;
}
function clock() {
  const node = document.querySelector('#clock');
  if (node) node.textContent = new Date().toLocaleString('zh-CN', { dateStyle: 'full', timeStyle: 'short' });
}
document.addEventListener('pointerdown', (event) => {
  if (!supportsPopover && event.target instanceof Element && !event.target.closest('#pet-switcher-trigger, #pet-switcher-menu')) {
    closePetSwitcher();
  }
  if (event.target instanceof Element && !event.target.closest('.search-wrap')) {
    activeSearchControl?.closeSuggestions({ dismiss: true });
  }
});
document.addEventListener('keydown', (event) => {
  const petMenuOpen = shell.querySelector('#pet-switcher-trigger[aria-expanded=true]');
  if (event.key === 'Escape' && petMenuOpen && !supportsPopover) {
    event.preventDefault();
    closePetSwitcher(true);
    return;
  }
  const menuOpen = petMenuOpen || shell.querySelector('#topbar-tools-trigger[aria-expanded=true]');
  if (event.key !== '/' || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || document.querySelector('dialog[open]') || menuOpen) return;
  if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
  event.preventDefault(); document.querySelector('#global-search-input')?.focus();
});
render();
setInterval(clock, 15000);
const initialSync = setTimeout(sync, 800);
