/* htmldiary — front end. Vanilla JS, no build step. */
'use strict';

// ============================================================================ utils
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const attr = s => esc(s);
const pad2 = n => String(n).padStart(2, '0');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOWS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function toast(msg, ms = 2200) { const d = document.createElement('div'); d.textContent = msg; $('#toast').appendChild(d); setTimeout(() => d.remove(), ms); }
function uid() { return Array.from(crypto.getRandomValues(new Uint8Array(6))).map(b => b.toString(16).padStart(2, '0')).join(''); }

async function api(method, url, body, raw) {
  const opt = { method, headers: {} };
  if (body !== undefined) {
    if (raw) { opt.body = body; } else { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  }
  const r = await fetch(url, opt);
  const ver = r.headers.get('X-htmldiary-Version'); if (ver && state.data) state.data.version = +ver;
  const ct = r.headers.get('content-type') || '';
  const data = ct.includes('json') ? await r.json() : await r.text();
  if (!r.ok) throw new Error((data && data.error) || r.statusText);
  return data;
}

// ---- wall-clock date helpers: entries carry an ISO string with offset; we read the wall clock, not UTC.
const dayOf = e => e.created.slice(0, 10);
const timeOf = e => e.created.slice(11, 16);
function localDate(iso) { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); const hh = +iso.slice(11, 13) || 0, mm = +iso.slice(14, 16) || 0; return new Date(y, m - 1, d, hh, mm); }
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function toIso(d) { // Date -> ISO with the browser's current UTC offset
  const off = -d.getTimezoneOffset(), sign = off >= 0 ? '+' : '-', a = Math.abs(off);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}${sign}${pad2(Math.floor(a / 60))}:${pad2(a % 60)}`;
}
function nowIso() { return toIso(new Date()); }
// ---- i18n: LANG is resolved in applyTheme() from settings.uiLanguage or the browser; t() falls back to English per key.
let LANG = 'en';
function resolveLang() {
  const codes = LANGS.map(l => l[0]);
  const set = state.data && S().uiLanguage;
  if (set && codes.includes(set)) return set;
  for (const nl of (navigator.languages || [navigator.language || 'en'])) {
    const n = String(nl); if (codes.includes(n)) return n;
    const base = n.split('-')[0].toLowerCase();
    if (base === 'zh') return /tw|hk|mo|hant/i.test(n) ? 'zh-TW' : 'zh-CN';
    if (base === 'pt') return 'pt-BR';
    const hit = codes.find(c => c.split('-')[0] === base); if (hit) return hit;
  }
  return 'en';
}
function t(key, vars) { let str = (I18N[LANG] && I18N[LANG][key]) ?? I18N.en[key] ?? key; if (vars) for (const k in vars) str = str.split('{' + k + '}').join(vars[k]); return str; }
const langName = () => (LANGS.find(l => l[0] === LANG) || ['', LANG])[1];
const cjkDates = () => S().dateNumerals === 'cjk' && /^(zh|ja)/.test(LANG);
const ZH_D = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
function zhNum(n) { if (n < 10) return ZH_D[n]; if (n < 20) return '十' + (n % 10 ? ZH_D[n % 10] : ''); return ZH_D[Math.floor(n / 10)] + '十' + (n % 10 ? ZH_D[n % 10] : ''); }
const zhYear = y => String(y).split('').map(c => ZH_D[+c]).join('');
const dtf = (opts, d) => { try { return new Intl.DateTimeFormat(LANG, opts).format(d); } catch (_) { return new Intl.DateTimeFormat('en', opts).format(d); } };
const wd = d => dtf({ weekday: 'long' }, d);
const wdShort = d => dtf({ weekday: 'short' }, d);
const monthShort = m => dtf({ month: 'short' }, new Date(2000, m, 1));
function fmtMonthYear(ym) { const [y, m] = ym.split('-').map(Number); if (cjkDates()) return `${zhYear(y)}年${zhNum(m)}月`; return dtf({ year: 'numeric', month: 'long' }, new Date(y, m - 1, 1)); }
function fmtLong(iso) { const d = localDate(iso); if (cjkDates()) return `${zhYear(d.getFullYear())}年${zhNum(d.getMonth() + 1)}月${zhNum(d.getDate())}日 · ${wd(d)}`; return dtf({ weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }, d); }
function fmtDayLine(iso) { const d = localDate(iso); if (cjkDates()) return `<b>${zhNum(d.getMonth() + 1)}月${zhNum(d.getDate())}日</b> ${wd(d)}`; return `<b>${dtf({ month: 'long', day: 'numeric' }, d)}</b> ${wd(d)}`; }
function fmtMonthDay(iso) { const d = localDate(iso); if (cjkDates()) return `${zhNum(d.getMonth() + 1)}月${zhNum(d.getDate())}日`; return dtf({ month: 'long', day: 'numeric' }, d); }
function fmtShort(iso) { return dtf({ year: 'numeric', month: 'short', day: 'numeric' }, localDate(iso)); }
function fmtTime(iso) { const d = localDate(iso); if (Number.isNaN(+d) || !iso.slice(11, 13)) return ''; return dtf({ hour: 'numeric', minute: '2-digit' }, d); }
function relDay(iso) { const td = todayStr(), d = iso.slice(0, 10); if (d === td) return t('today'); const y = new Date(); y.setDate(y.getDate() - 1); if (d === toIso(y).slice(0, 10)) return t('yesterday'); return ''; }
function daysBetween(a, b) { return Math.round((localDate(b + 'T00:00') - localDate(a + 'T00:00')) / 86400000); }
function fmtTemp(t) { if (t == null) return ''; return S().temperatureUnit === 'F' ? `${Math.round(t * 9 / 5 + 32)}°F` : `${Math.round(t)}°C`; }

// ---- text helpers
function stripMd(s) {
  return s.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/^#{1,6}\s+/gm, '').replace(/^\s*[-*+]\s+\[[ xX]\]\s*/gm, '').replace(/^\s*[-*+]\s+/gm, '').replace(/^\s*\d+\.\s+/gm, '').replace(/^>\s?/gm, '').replace(/[*_~`]+/g, '').replace(/\\([\\`*_{}\[\]()#+\-.!])/g, '$1').replace(/\s+/g, ' ').trim();
}
function titleOf(e) {
  const lines = (e.text || '').split('\n').map(l => l.trim()).filter(l => l && !/^!\[[^\]]*\]\([^)]*\)$/.test(l) && !/^---+$/.test(l));
  return lines.length ? stripMd(lines[0]).slice(0, 120) : '';
}
function excerptOf(e) {
  const lines = (e.text || '').split('\n').map(l => l.trim()).filter(l => l && !/^!\[[^\]]*\]\([^)]*\)$/.test(l) && !/^---+$/.test(l));
  return lines.slice(1).map(stripMd).filter(Boolean).join(' ').slice(0, 220);
}
function wordCount(t) { const s = (t || '').replace(/!\[[^\]]*\]\([^)]*\)/g, ''); const latin = (s.match(/[A-Za-z0-9'’-]+/g) || []).length; const cjk = (s.match(/[㐀-鿿豈-﫿]/g) || []).length; return latin + cjk; }
const isVideo = u => /\.(mp4|mov|m4v|webm|ogv)(\?|$)/i.test(u);
const isAudio = u => /\.(mp3|m4a|aac|wav|ogg|opus)(\?|$)/i.test(u);
const isImage = u => !isVideo(u) && !isAudio(u) && !/\.pdf(\?|$)/i.test(u);

// ---- tiny sha256 (works without crypto.subtle when served over plain http on a LAN)
function sha256(str) {
  const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  const bytes = new TextEncoder().encode(str); const l = bytes.length; const bl = ((l + 9 + 63) >> 6) << 6; const m = new Uint8Array(bl); m.set(bytes); m[l] = 0x80;
  const dv = new DataView(m.buffer); dv.setUint32(bl - 4, l * 8 >>> 0); dv.setUint32(bl - 8, Math.floor(l * 8 / 4294967296));
  let H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]; const w = new Uint32Array(64); const rr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let i = 0; i < bl; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4);
    for (let t = 16; t < 64; t++) { const s0 = rr(w[t - 15], 7) ^ rr(w[t - 15], 18) ^ (w[t - 15] >>> 3); const s1 = rr(w[t - 2], 17) ^ rr(w[t - 2], 19) ^ (w[t - 2] >>> 10); w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0; }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) { const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25); const ch = (e & f) ^ (~e & g); const t1 = (h + S1 + ch + K[t] + w[t]) >>> 0; const S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22); const mj = (a & b) ^ (a & c) ^ (b & c); const t2 = (S0 + mj) >>> 0; h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0; }
    H = H.map((x, k) => (x + [a, b, c, d, e, f, g, h][k]) >>> 0);
  }
  return H.map(x => x.toString(16).padStart(8, '0')).join('');
}

// ============================================================================ state
const state = {
  data: null,               // bootstrap payload
  route: { view: 'timeline', j: null, e: null, d: null, t: null },
  editing: false,
  query: '',
  filters: { starred: false, photos: false, year: null },
  calMonth: todayStr().slice(0, 7),
  freshIds: new Set(),      // entries created this session (empty ones get discarded)
  pending: new Map(),       // id -> timer for autosave
  saving: 0,
  map: null,
  sbOpen: false,
  lastActivity: Date.now(),
  locked: false,
};
const S = () => state.data.settings;
const J = id => state.data.journals.find(j => j.id === id);
const E = id => state.data.entries.find(e => e.id === id);
const journalColor = id => (J(id) || {}).color || '#8b8d98';

// ---- routing: #/view?j=&e=&d=&t=
function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const view = path || 'timeline';
  const p = new URLSearchParams(qs || '');
  return { view, j: p.get('j'), e: p.get('e'), d: p.get('d'), t: p.get('t') };
}
function go(patch) {
  const r = { ...state.route, ...patch };
  const p = new URLSearchParams();
  for (const k of ['j', 'e', 'd', 't']) if (r[k]) p.set(k, r[k]);
  const qs = p.toString();
  const h = `/${r.view}${qs ? '?' + qs : ''}`;
  if (location.hash === '#' + h) onRoute(); else location.hash = h;
}
window.addEventListener('hashchange', onRoute);
function onRoute() {
  const prev = state.route;
  state.route = parseHash();
  if (prev.e && prev.e !== state.route.e) leaveEntry(prev.e);
  if (state.route.view !== prev.view && state.editing && !state.route.e) state.editing = false;
  if (state.route.e && !E(state.route.e) && state.route.view !== 'trash') state.route.e = null;
  render();
}

// ============================================================================ derived data
function scopeEntries() {
  const r = state.route;
  let list = state.data.entries.slice();
  if (r.j) list = list.filter(e => e.journal === r.j);
  if (r.view === 'starred') list = list.filter(e => e.starred);
  if (r.t) list = list.filter(e => e.tags.includes(r.t));
  if (state.filters.starred) list = list.filter(e => e.starred);
  if (state.filters.photos) list = list.filter(e => e.photos.length);
  if (state.filters.year) list = list.filter(e => e.created.startsWith(state.filters.year));
  if (state.query.trim()) {
    const q = state.query.trim().toLowerCase();
    const terms = q.split(/\s+/);
    list = list.filter(e => {
      const hay = [e.text, e.tags.join(' '), e.location ? (e.location.name + ' ' + (e.location.address || '')) : '', e.weather ? e.weather.desc : '', J(e.journal)?.name || ''].join('\n').toLowerCase();
      return terms.every(t => t.startsWith('#') ? e.tags.some(x => x.toLowerCase() === t.slice(1)) : hay.includes(t));
    });
  }
  const asc = S().sortOrder === 'oldest';
  list.sort((a, b) => (b.pinned - a.pinned) || (asc ? a.created.localeCompare(b.created) : b.created.localeCompare(a.created)));
  return list;
}
function tagCounts(entries = state.data.entries) { const m = new Map(); for (const e of entries) for (const t of e.tags) m.set(t, (m.get(t) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); }
function streaks(entries) {
  const days = [...new Set(entries.map(dayOf))].sort();
  let longest = 0, run = 0, prev = null;
  for (const d of days) { run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1; longest = Math.max(longest, run); prev = d; }
  const set = new Set(days); let cur = 0; let d = todayStr();
  if (!set.has(d)) { const y = new Date(); y.setDate(y.getDate() - 1); d = toIso(y).slice(0, 10); }
  while (set.has(d)) { cur++; const x = localDate(d + 'T00:00'); x.setDate(x.getDate() - 1); d = toIso(x).slice(0, 10); }
  return { current: cur, longest, days: days.length };
}

// ============================================================================ rendering
function render() {
  if (!state.data) return;
  const ed0 = $('#editor'); if (ed0 && document.activeElement === ed0) { editorSel = [ed0.selectionStart, ed0.selectionEnd]; state.focusEditor = true; }
  const app = $('#app');
  app.className = 'app' + (state.route.e ? ' has-selection' : '') + (state.sbOpen ? ' sb-open' : '');
  app.innerHTML = `${renderSidebar()}${renderMain()}${state.sbOpen ? '<div class="sb-backdrop" data-action="sb-close"></div>' : ''}`;
  afterRender();
}

function renderSidebar() {
  const d = state.data, r = state.route;
  const counts = {}; for (const e of d.entries) counts[e.journal] = (counts[e.journal] || 0) + 1;
  const isActive = (view, j) => r.view === view && (r.j || null) === (j || null) && !r.t;
  const item = (view, label, ico, extra = '', j = null, count = '') =>
    `<div class="sb-item ${isActive(view, j) ? 'active' : ''}" data-action="nav" data-view="${view}" ${j ? `data-j="${attr(j)}"` : ''}>${extra || `<span class="sb-ico">${li(ico)}</span>`}<span class="sb-label">${esc(label)}</span><span class="sb-count">${count}</span></div>`;
  const tags = tagCounts().slice(0, 40);
  return `<aside class="sidebar">
    <div class="sb-brand">htmldiary <small>${esc(t('brandSub'))}</small></div>
    <div class="sb-search"><input type="search" id="search" placeholder="${attr(t('searchEntries'))}" value="${attr(state.query)}" autocomplete="off"></div>
    <div class="sb-scroll">
      <div class="sb-section"><span class="caps">${t('journals')}</span><button data-action="journal-new" title="${attr(t('newJournal'))}">+</button></div>
      ${item('timeline', t('allEntries'), 'all', '', null, d.entries.length)}
      ${d.journals.map(j => item('timeline', j.name, '', sealHtml(j.id, 'sm'), j.id, counts[j.id] || 0)).join('')}
      <div class="sb-section"><span class="caps">${t('views')}</span></div>
      ${item('starred', t('favorites'), 'star', '', null, d.entries.filter(e => e.starred).length)}
      ${item('otd', t('onThisDay'), 'otd')}
      ${item('calendar', t('calendar'), 'calendar')}
      ${item('media', t('media'), 'media', '', null, d.entries.reduce((n, e) => n + e.photos.length, 0))}
      ${item('map', t('map'), 'map')}
      ${item('prompts', t('dailyPrompts'), 'prompts')}
      ${item('stats', t('streaksStats'), 'stats')}
      ${item('trash', t('trash'), 'trash', '', null, d.trash.length || '')}
      ${tags.length ? `<div class="sb-section"><span class="caps">${t('tags')}</span></div><div class="sb-tags">${tags.map(([t, n]) => `<span class="tag-chip ${r.t === t ? 'active' : ''}" data-action="tag" data-tag="${attr(t)}">${esc(t)}<small>${n}</small></span>`).join('')}</div>` : ''}
    </div>
    <div class="sb-foot">
      <div class="sb-item ${r.view === 'settings' ? 'active' : ''}" data-action="nav" data-view="settings"><span class="sb-ico">${li('settings')}</span><span class="sb-label">${t('settings')}</span></div>
      <div class="sb-item" data-action="help" title="${attr(t('shortcuts'))}"><span class="sb-ico">${li('help')}</span></div>
    </div>
  </aside>`;
}

function renderMain() {
  const v = state.route.view;
  const wide = ['map', 'stats', 'settings', 'prompts', 'otd'].includes(v);
  if (wide) {
    const body = { map: renderMapView, stats: renderStats, settings: renderSettings, prompts: renderPrompts, otd: renderOnThisDay }[v]();
    return `<div class="main wide"><div class="wide-col">${body}</div></div>`;
  }
  return `<div class="main">${renderListCol()}${renderDetailCol()}</div>`;
}

const SVG = {
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/></svg>',
  filter: '<svg viewBox="0 0 24 24"><path d="M3 5h18l-7 8v6l-4 2v-8z"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="m14 6-6 6 6 6"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="m10 6 6 6-6 6"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="m12 3 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.8 6.1 21l1.2-6.5L2.5 9.9l6.6-.9z"/></svg>',
  starOn: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="m12 3 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.8 6.1 21l1.2-6.5L2.5 9.9l6.6-.9z"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3zM12 14v7"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4l10-10-4-4L4 16zM13 7l4 4"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>',
  photo: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-9 8"/></svg>',
  bold: '<svg viewBox="0 0 24 24"><path d="M7 4h6a4 4 0 0 1 0 8H7zM7 12h7a4 4 0 0 1 0 8H7z"/></svg>',
  italic: '<svg viewBox="0 0 24 24"><path d="M10 4h8M6 20h8M14 4l-4 16"/></svg>',
  h: '<svg viewBox="0 0 24 24"><path d="M5 4v16M19 4v16M5 12h14"/></svg>',
  ul: '<svg viewBox="0 0 24 24"><path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/></svg>',
  ol: '<svg viewBox="0 0 24 24"><path d="M10 6h11M10 12h11M10 18h11M4 5l1.5-1v5M3.5 11.5a1.5 1.5 0 0 1 3 0c0 1-3 2-3 3h3M3.5 16.5h2a1.2 1.2 0 0 1 0 2.5h-1 1a1.2 1.2 0 0 1 0 2.5h-2"/></svg>',
  task: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="7" height="7" rx="1.5"/><path d="m4.5 7.5 1.5 1.5 3-3M13 7h8M13 17h8"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>',
  quote: '<svg viewBox="0 0 24 24"><path d="M6 15a3 3 0 0 0 3-3V7H5v5h3M15 15a3 3 0 0 0 3-3V7h-4v5h3"/></svg>',
  code: '<svg viewBox="0 0 24 24"><path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/></svg>',
  hr: '<svg viewBox="0 0 24 24"><path d="M4 12h16"/></svg>',
  template: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
  loc: '<svg viewBox="0 0 24 24"><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/></svg>',
};
// thin line icons for the sidebar (brush-weight strokes)
const LI = {
  all: '<path d="M6 4h11a1 1 0 0 1 1 1v15H7a1 1 0 0 1-1-1zM6 4v15M10 8h5M10 12h5"/>',
  star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 17l-5.3 2.7 1.1-5.9-4.3-4.1 5.9-.8z"/>',
  otd: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="1.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  media: '<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><circle cx="9" cy="10" r="1.5"/><path d="m20.5 16-5-5-8 8"/>',
  map: '<path d="m3.5 6 5.5-2 6 2 5.5-2v14l-5.5 2-6-2-5.5 2zM9 4v14M15 6v14"/>',
  prompts: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.7.6 1 1.3 1 2.1h5c0-.8.3-1.5 1-2.1A6 6 0 0 0 12 3z"/>',
  stats: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  trash: '<path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 11v6M14 11v6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>',
  timeline: '<path d="M5 6h14M5 12h14M5 18h9"/>',
  loc: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
  tag: '<path d="M3.5 12.5v-8a1 1 0 0 1 1-1h8l8 8-9 9zM8 8h.01"/>',
  weather: '<path d="M7 17.5a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6 1.5A3.3 3.3 0 0 1 17 17.5z"/>',
  time: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  download: '<path d="M12 4v11m-5-5 5 5 5-5M4 20h16"/>',
  folder: '<path d="M3.5 6.5a1 1 0 0 1 1-1H10l2 2h7.5a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z"/>',
  dup: '<rect x="4" y="4" width="11" height="11" rx="1.5"/><path d="M9 20h10a1 1 0 0 0 1-1V9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
};
const li = (n, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24">${LI[n]}</svg>`;
function sealOf(j) { if (!j) return '?'; const t = (j.seal || '').trim(); if (t) return t.slice(0, 2); const c = (j.name || '?').trim()[0] || '?'; return /[a-z]/i.test(c) ? c.toUpperCase() : c; }
const sealHtml = (jid, cls = '') => { const j = J(jid); return `<span class="seal ${cls}" style="--seal:${attr(journalColor(jid))}" title="${attr(j ? j.name : jid)}">${esc(sealOf(j))}</span>`; };
const INK_PALETTE = ['#b8402f', '#2f4f6f', '#4f6b3a', '#9a6b2f', '#6b3a5b', '#3a6b6b', '#6b4a3a', '#2b2b2b', '#7a6f2e', '#4a4a7a'];
const MOUNTAIN = '<svg class="mountain" viewBox="0 0 180 60" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 52c14-10 22-30 34-30s16 14 28 12 20-26 34-26 20 22 32 20 22-14 44-6" opacity=".9"/><path d="M14 56c18-6 26-16 40-14s22 8 36 4 24-12 44-8 28 8 42 10" opacity=".45"/><path d="M60 40c8-3 14-2 22 2" opacity=".35"/></svg>';


// ---------------------------------------------------------------- list column
function scopeTitle() {
  const r = state.route;
  if (r.t) return `#${r.t}`;
  if (r.view === 'starred') return t('favorites');
  if (r.view === 'trash') return t('trash');
  if (r.j) { const j = J(r.j); return j ? `${sealHtml(j.id, 'lg')}${esc(j.name)}` : t('journal'); }
  return t('allEntries');
}
function renderListCol() {
  const r = state.route;
  const f = state.filters;
  const anyFilter = f.starred || f.photos || f.year;
  const views = [['timeline', t('timeline')], ['calendar', t('calendar')], ['media', t('media')]];
  const isTrash = r.view === 'trash';
  const head = `<div class="list-head">
      <button class="icon-btn mob-only" data-action="sb-open" title="${attr(t('menu'))}">${SVG.menu}</button>
      <h2>${scopeTitle()}</h2>
      ${isTrash ? `<button class="btn small danger" data-action="trash-empty">${t('empty')}</button>` : `
      <button class="icon-btn ${anyFilter ? 'active' : ''}" data-action="filter-menu" title="${attr(t('filterSort'))}">${SVG.filter}</button>
      <button class="icon-btn" data-action="list-menu" title="${attr(t('more'))}">${SVG.more}</button>
      <button class="icon-btn primary" data-action="new-entry" title="${attr(t('newEntryHint', { mod: MOD }))}">${SVG.plus}</button>`}
    </div>
    ${isTrash || r.view === 'starred' ? '' : `<div class="view-switch">${views.map(([v, label]) => `<button class="vs ${r.view === v ? 'active' : ''}" data-action="nav" data-view="${v}" data-j="${attr(r.j || '')}" data-keep="1">${label}</button>`).join('')}</div>`}
    ${anyFilter || state.query ? `<div class="filter-bar">${state.query ? `<span class="tag-chip pill active">“${esc(state.query)}” <span data-action="clear-search">×</span></span>` : ''}${f.starred ? `<span class="tag-chip pill active" data-action="filter-toggle" data-k="starred">${t('favorites')} ×</span>` : ''}${f.photos ? `<span class="tag-chip pill active" data-action="filter-toggle" data-k="photos">${t('withMedia')} ×</span>` : ''}${f.year ? `<span class="tag-chip pill active" data-action="filter-year" data-y="">${f.year} ×</span>` : ''}</div>` : ''}`;
  let body;
  if (isTrash) body = renderTrashList();
  else if (r.view === 'calendar') body = renderCalendar();
  else if (r.view === 'media') body = renderMediaGrid();
  else body = renderTimeline(scopeEntries());
  return `<div class="list-col">${head}<div class="list-scroll" id="list-scroll">${body}</div></div>`;
}

function entryCard(e, { showDate = true, cls = '', showSeal = true } = {}) {
  const ttl = titleOf(e), x = excerptOf(e);
  const photo = e.photos.find(isImage);
  const meta = [];
  if (e.location && e.location.name) meta.push(li('loc') + esc(e.location.name));
  if (e.weather && e.weather.temp != null) meta.push(`${e.weather.icon || ''} ${fmtTemp(e.weather.temp)}`);
  if (e.pinned) meta.push(esc(t('pinned').toLowerCase()));
  if (e.starred) meta.push('<span class="ec-star">★</span>');
  const tagHtml = e.tags.slice(0, 4).map(tg => `<span class="ec-tag">${esc(tg)}</span>`).join('');
  const showJ = showSeal && !state.route.j;
  return `<div class="entry-card ${cls} ${state.route.e === e.id ? 'selected' : ''}" data-action="open" data-id="${e.id}">
    <div class="ec-body">
      <div class="ec-top">${showJ ? sealHtml(e.journal, 'sm') : ''}<span class="ec-title ${ttl ? '' : 'untitled'}">${ttl ? esc(ttl) : (photo ? t('photo') : t('emptyEntry'))}</span><span class="ec-time">${fmtTime(e.created)}</span></div>
      ${x ? `<div class="ec-excerpt">${esc(x)}</div>` : ''}
      ${meta.length || tagHtml ? `<div class="ec-meta">${meta.map(m => `<span>${m}</span>`).join('')}${tagHtml}</div>` : ''}
    </div>
    ${photo ? `<div class="ec-thumb-wrap"><img class="ec-thumb" src="${attr(photo)}" loading="lazy" alt="">${e.photos.length > 1 ? `<span class="ec-thumb-count">${e.photos.length}</span>` : ''}</div>` : ''}
  </div>`;
}

function renderTimeline(list) {
  if (!list.length) return `<div class="empty">${MOUNTAIN}<strong>${state.query || state.filters.starred || state.filters.photos ? t('noMatches') : t('noEntriesYet')}</strong>${state.query ? t('tryDifferentSearch') : t('pressToWrite', { mod: `<span class="kbd">${MOD}</span>` })}<br><button class="btn primary" data-action="new-entry">${t('newEntry')}</button></div>`;
  let out = '', month = '', day = '';
  for (const e of list) {
    const ym = e.created.slice(0, 7);
    if (e.pinned && month !== 'pinned') { month = 'pinned'; out += `<div class="tl-month">${t('pinned')}</div>`; }
    else if (!e.pinned && ym !== month) { month = ym; day = ''; out += `<div class="tl-month">${fmtMonthYear(ym)}</div>`; }
    const dd = dayOf(e);
    if (!e.pinned && dd !== day) { day = dd; out += `<div class="tl-day">${fmtDayLine(e.created)}${relDay(e.created) ? ` · ${relDay(e.created)}` : ''}</div>`; }
    out += entryCard(e);
  }
  return out;
}

function renderTrashList() {
  const list = state.data.trash;
  if (!list.length) return `<div class="empty">${MOUNTAIN}<strong>${t('trashIsEmpty')}</strong>${t('trashEmptyHint')}</div>`;
  return list.map(e => entryCard(e, { cls: 'trash-card' })).join('');
}

function renderCalendar() {
  const [y, m] = state.calMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const fdow = S().firstDayOfWeek ?? 1;
  const startOffset = (first.getDay() - fdow + 7) % 7;
  const daysInMonth = new Date(y, m, 0).getDate();
  const entries = scopeEntries();
  const byDay = {}; for (const e of entries) (byDay[dayOf(e)] = byDay[dayOf(e)] || []).push(e);
  const cells = [];
  const start = new Date(y, m - 1, 1 - startOffset);
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    if (i >= 35 && d.getMonth() !== m - 1) break;
    const ds = toIso(d).slice(0, 10);
    const list = byDay[ds] || [];
    const photo = list.flatMap(e => e.photos).find(isImage);
    const cls = ['cal-day', d.getMonth() !== m - 1 ? 'other' : '', ds === todayStr() ? 'today' : '', ds === state.route.d ? 'selected' : '', photo ? 'has-photo' : ''].join(' ');
    const dots = [...new Set(list.map(e => e.journal))].slice(0, 4).map(j => `<i style="background:${attr(journalColor(j))}"></i>`).join('');
    cells.push(`<div class="${cls}" data-action="cal-day" data-d="${ds}" ${photo ? `style="background-image:url('${attr(photo)}')"` : ''}><span class="cal-num">${d.getDate()}</span>${dots && !photo ? `<div class="cal-dots">${dots}</div>` : ''}</div>`);
  }
  const dows = []; for (let i = 0; i < 7; i++) { const dd = new Date(2023, 0, 1 + ((fdow + i) % 7)); dows.push(`<div class="cal-dow">${esc(wdShort(dd))}</div>`); }
  const sel = state.route.d;
  const dayList = sel ? (byDay[sel] || []) : [];
  const below = sel ? (dayList.length ? `<div class="tl-day" style="padding-top:14px">${fmtDayLine(sel + 'T00:00')}</div>` + dayList.map(e => entryCard(e)).join('') : `<div class="empty"><strong>${fmtLong(sel + 'T00:00')}</strong>${t('noEntriesOnDay')}<br><button class="btn primary" data-action="new-entry" data-d="${sel}">${t('writeAboutDay')}</button></div>`) : `<div class="empty">${t('selectDay')}</div>`;
  return `<div class="cal">
    <div class="cal-head"><button class="icon-btn" data-action="cal-nav" data-n="-1">${SVG.prev}</button><b data-action="cal-today" style="cursor:pointer">${fmtMonthYear(`${y}-${pad2(m)}`)}</b><button class="icon-btn" data-action="cal-nav" data-n="1">${SVG.next}</button></div>
    <div class="cal-grid">${dows.join('')}${cells.join('')}</div>
  </div>${below}`;
}

function renderMediaGrid() {
  const list = scopeEntries().filter(e => e.photos.length);
  if (!list.length) return `<div class="empty">${MOUNTAIN}<strong>${t('noMediaYet')}</strong>${t('noMediaHint')}</div>`;
  let out = '<div class="media-grid">', month = '';
  for (const e of list) {
    const ym = e.created.slice(0, 7);
    if (ym !== month) { month = ym; out += `<div class="media-month">${fmtMonthYear(ym)}</div>`; }
    for (const p of e.photos) {
      if (isVideo(p)) out += `<video src="${attr(p)}" muted data-action="open" data-id="${e.id}" title="${attr(titleOf(e))}"></video>`;
      else if (isImage(p)) out += `<img src="${attr(p)}" loading="lazy" data-action="open" data-id="${e.id}" title="${attr(titleOf(e))}" alt="">`;
    }
  }
  return out + '</div>';
}

// ---------------------------------------------------------------- detail column
function renderDetailCol() {
  const r = state.route;
  const isTrash = r.view === 'trash';
  const e = isTrash ? state.data.trash.find(x => x.id === r.e) : (r.e && E(r.e));
  if (!e) {
    const list = scopeEntries();
    const st = streaks(state.data.entries);
    return `<div class="detail-col"><div class="empty" style="margin:auto">${MOUNTAIN}<strong>${list.length ? t('selectEntry') : t('welcome')}</strong>
      ${st.current ? t('dayStreak', { n: st.current }) + ' · ' : ''}${t('nEntries', { n: state.data.entries.length })} · ${t('nJournals', { n: state.data.journals.length })}<br>
      <button class="btn primary" data-action="new-entry">${t('newEntry')}</button> <button class="btn" data-action="nav" data-view="otd">${t('onThisDay')}</button></div></div>`;
  }
  const j = J(e.journal) || { name: e.journal, color: '#888' };
  const list = isTrash ? state.data.trash : scopeEntries();
  const idx = list.findIndex(x => x.id === e.id);
  const prev = list[idx - 1], next = list[idx + 1];
  const rel = relDay(e.created);
  const head = `<div class="d-head">
    <button class="icon-btn mob-only" data-action="close-entry" title="${attr(t('back'))}">${SVG.back}</button>
    <button class="icon-btn" data-action="open" data-id="${prev ? prev.id : ''}" ${prev ? '' : 'disabled style="opacity:.3"'} title="${attr(t('newer'))}">${SVG.prev}</button>
    <button class="icon-btn" data-action="open" data-id="${next ? next.id : ''}" ${next ? '' : 'disabled style="opacity:.3"'} title="${attr(t('older'))}">${SVG.next}</button>
    <span class="d-date" data-action="date-menu" title="${attr(t('changeDate'))}">${rel ? rel + ' · ' : ''}${fmtLong(e.created)}<small>${fmtTime(e.created)}</small></span>
    <span class="spacer"></span>
    ${isTrash ? `<button class="btn small" data-action="trash-restore" data-id="${e.id}">${t('restore')}</button><button class="btn small danger" data-action="trash-purge" data-id="${e.id}">${t('deleteForever')}</button>` : `
    <span class="chip" data-action="journal-menu">${sealHtml(e.journal, 'sm')}${esc(j.name)} ▾</span>
    <button class="icon-btn star-btn ${e.starred ? 'on' : ''}" data-action="star" title="${attr(t('favorite'))}">${e.starred ? SVG.starOn : SVG.star}</button>
    <button class="icon-btn pin-btn ${e.pinned ? 'on' : ''}" data-action="pin" title="${attr(t('pin'))}">${SVG.pin}</button>
    <button class="btn small ${state.editing ? 'primary' : ''}" data-action="toggle-edit" title="${MOD}+E">${state.editing ? t('done') : t('edit')}</button>
    <button class="icon-btn" data-action="entry-menu" title="${attr(t('more'))}">${SVG.more}</button>`}
  </div>`;
  const loc = e.location;
  const wx = e.weather;
  const meta = `<div class="d-meta">
    ${loc && (loc.name || loc.address) ? `<span class="chip" data-action="loc-menu" title="${attr(loc.address || '')}">${li('loc')}${esc(loc.name || loc.address)}</span>` : (isTrash ? '' : `<span class="chip ghost" data-action="loc-menu">${li('loc')}${t('location')}</span>`)}
    ${wx && wx.temp != null ? `<span class="chip" data-action="wx-menu" title="${attr(wx.desc || '')}">${wx.icon || ''} ${fmtTemp(wx.temp)} ${esc(wx.desc || '')}</span>` : (isTrash ? '' : `<span class="chip ghost" data-action="wx-fetch">${li('weather')}${t('weather')}</span>`)}
    ${e.tags.map(tg => `<span class="chip" data-action="tag-nav" data-tag="${attr(tg)}">#${esc(tg)}${isTrash ? '' : ` <span class="x" data-action="tag-remove" data-tag="${attr(tg)}">×</span>`}</span>`).join('')}
    ${isTrash ? '' : `<span class="chip ghost" data-action="tag-add">${li('tag')}${t('tag')}</span>`}
    ${e.template ? `<span class="chip" title="${attr(t('template'))}">${li('copy')}${esc(e.template)}</span>` : ''}
  </div>`;
  let body, foot = '';
  if (state.editing && !isTrash) {
    const fmt = (a, label, title) => `<button class="fmt" data-action="fmt" data-f="${a}" title="${title}">${label}</button>`;
    body = `<div class="fmt-bar">
      ${fmt('bold', '<b>B</b>', `${t('bold')} (${MOD}+B)`)}${fmt('italic', '<i>I</i>', `${t('italic')} (${MOD}+I)`)}${fmt('h1', 'H', t('heading'))}<span class="sep"></span>
      ${fmt('ul', '•', t('bulletedList'))}${fmt('ol', '1.', t('numberedList'))}${fmt('task', '☐', t('checklist'))}${fmt('quote', '❝', t('quote'))}${fmt('code', '‹›', t('code'))}${fmt('hr', '〰', t('divider'))}<span class="sep"></span>
      <button class="fmt" data-action="photo" title="${attr(t('insertMedia'))}">${li('media')}</button>
      <button class="fmt" data-action="template-menu" title="${attr(t('insertTemplate'))}">${li('copy')}</button>
      <button class="fmt" data-action="fmt" data-f="date" title="${attr(t('insertTime'))}">${li('time')}</button>
      <span class="status" id="status">${t('nWords', { n: wordCount(e.text) })}</span>
    </div><textarea class="editor" id="editor" placeholder="${attr(t('startWriting'))}" spellcheck="true">${esc(e.text)}</textarea>`;
  } else {
    body = `<article class="prose" id="prose">${renderMarkdown(e.text)}</article>`;
    if (!isTrash) foot = `<div class="d-foot"><span class="status">${t('nWords', { n: wordCount(e.text) })} · ${e.photos.length ? t('nMedia', { n: e.photos.length }) + ' · ' : ''}${t('edited', { date: fmtShort(e.modified) })}</span></div>`;
  }
  return `<div class="detail-col" id="detail" style="position:relative">${head}<div class="d-scroll">${meta}<div class="d-body">${body}</div></div>${foot}</div>`;
}

function renderMarkdown(text) {
  if (!text || !text.trim()) return `<p class="empty-hint">${t('nothingWritten')}</p>`;
  let html = marked.parse(text, { gfm: true, breaks: true, mangle: false, headerIds: false });
  // task lists: make checkboxes live and add classes
  let i = 0;
  html = html.replace(/<li>\s*<input[^>]*type="checkbox"[^>]*>([\s\S]*?)<\/li>/g, (m, rest) => {
    const done = /checked/.test(m.slice(0, m.indexOf('>')));
    return `<li class="task ${done ? 'done' : ''}"><input type="checkbox" ${done ? 'checked' : ''} data-task="${i++}"><span>${rest.replace(/^\s*<p>|<\/p>\s*$/g, '')}</span></li>`;
  });
  // media: swap <img> for <video>/<audio> when the extension says so
  html = html.replace(/<img src="([^"]+)"([^>]*)>/g, (m, src) => {
    if (isVideo(src)) return `<video src="${src}" controls playsinline></video>`;
    if (isAudio(src)) return `<audio src="${src}" controls></audio>`;
    if (/\.pdf(\?|$)/i.test(src)) return `<a href="${src}" target="_blank">📄 ${src.split('/').pop()}</a>`;
    return `<img src="${src}" data-action="lightbox" data-src="${src}" loading="lazy" alt="">`;
  });
  return html;
}

// ---------------------------------------------------------------- wide views
function renderOnThisDay() {
  const td = todayStr(); const md = td.slice(5);
  const yearNow = +td.slice(0, 4);
  const list = state.data.entries.filter(e => e.created.slice(5, 10) === md).sort((a, b) => b.created.localeCompare(a.created));
  const groups = new Map(); for (const e of list) { const y = +e.created.slice(0, 4); (groups.get(y) || groups.set(y, []).get(y)).push(e); }
  let out = `<div class="page"><h1>${t('onThisDay')}</h1><p class="lead">${t('otdLead', { date: fmtMonthDay(td + 'T00:00') })}</p>`;
  if (!list.length) out += `<div class="empty">${MOUNTAIN}<strong>${t('nothingThisDay')}</strong>${t('nothingThisDayHint')}<br><button class="btn primary" data-action="new-entry">${t('writeToday')}</button></div>`;
  for (const [y, es] of groups) {
    const diff = yearNow - y;
    out += `<div class="otd-year">${diff === 0 ? t('today') : diff === 1 ? t('oneYearAgo') : t('nYearsAgo', { n: diff })} · ${y}</div>`;
    out += es.map(e => `<div class="otd-card" data-action="open-tl" data-id="${e.id}"><div class="t">${sealHtml(e.journal, 'sm')}${esc(titleOf(e) || t('untitled'))}</div><div class="x">${esc(stripMd(e.text).slice(0, 400))}</div><div class="m">${esc(J(e.journal)?.name || '')} · ${fmtTime(e.created)}${e.location?.name ? ' · ' + esc(e.location.name) : ''}${e.photos.length ? ` · ${t('nMedia', { n: e.photos.length })}` : ''}</div></div>`).join('');
  }
  return out + '</div>';
}

function renderPrompts() {
  const prompts = state.data.prompts;
  const doy = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const todayIdx = prompts.length ? doy % prompts.length : 0;
  const answered = new Set(state.data.entries.map(e => e.prompt).filter(Boolean));
  const card = (p, i, today) => `<div class="p-card ${today ? 'today' : ''}"><span class="q">${esc(p)}</span>${answered.has(p) ? `<span class="tag-chip pill">${t('answered')}</span>` : ''}<button class="btn ${today ? 'primary' : ''} small" data-action="prompt-answer" data-i="${i}">${t('answer')}</button></div>`;
  return `<div class="page"><h1>${t('dailyPrompts')}</h1><p class="lead">${t('promptsLead')}</p>
    <h2>${t('todaysPrompt')}</h2>${prompts.length ? card(prompts[todayIdx], todayIdx, true) : `<div class="empty">${t('noPrompts')}</div>`}
    <h2>${t('allPrompts')}</h2>${prompts.map((p, i) => i === todayIdx ? '' : card(p, i, false)).join('')}</div>`;
}

function renderStats() {
  const es = state.data.entries;
  const st = streaks(es);
  const words = es.reduce((n, e) => n + wordCount(e.text), 0);
  const photos = es.reduce((n, e) => n + e.photos.length, 0);
  const years = {}; for (const e of es) { const y = e.created.slice(0, 4); years[y] = (years[y] || 0) + 1; }
  const ys = Object.keys(years).sort(); const maxY = Math.max(1, ...Object.values(years));
  // heatmap: last 53 weeks ending today
  const perDay = {}; for (const e of es) perDay[dayOf(e)] = (perDay[dayOf(e)] || 0) + 1;
  const fdow = S().firstDayOfWeek ?? 1;
  const end = new Date(); const endDow = (end.getDay() - fdow + 7) % 7;
  const start = new Date(end); start.setDate(end.getDate() - endDow - 52 * 7);
  let heat = '';
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const ds = toIso(d).slice(0, 10); const n = perDay[ds] || 0;
    heat += `<i class="${n ? 'l' + Math.min(4, n) : ''}" title="${ds}: ${attr(t('nEntries', { n }))}"${n ? ` data-action="open-day" data-d="${ds}" style="cursor:pointer"` : ''}></i>`;
  }
  const first = es.length ? es.reduce((a, e) => e.created < a ? e.created : a, es[0].created) : null;
  const months = {}; for (const e of es) { const m = +e.created.slice(5, 7); months[m] = (months[m] || 0) + 1; }
  const maxM = Math.max(1, ...Object.values(months));
  const longestEntry = es.reduce((a, e) => wordCount(e.text) > (a ? wordCount(a.text) : -1) ? e : a, null);
  const jrows = state.data.journals.map(j => { const n = es.filter(e => e.journal === j.id).length; return `<div class="stat"><b>${n}</b><span>${sealHtml(j.id, 'sm')} ${esc(j.name)}</span></div>`; }).join('');
  return `<div class="page"><h1>${t('streaksStats')}</h1><p class="lead">${first ? t('journalingSince', { date: fmtShort(first) }) : t('noEntries')}</p>
    <div class="cards">
      <div class="stat"><b>${st.current}</b><span>${t('currentStreak')}</span></div>
      <div class="stat"><b>${st.longest}</b><span>${t('longestStreak')}</span></div>
      <div class="stat"><b>${es.length}</b><span>${t('entries')}</span></div>
      <div class="stat"><b>${st.days}</b><span>${t('daysJournaled')}</span></div>
      <div class="stat"><b>${words.toLocaleString(LANG)}</b><span>${t('words')}</span></div>
      <div class="stat"><b>${photos}</b><span>${t('media')}</span></div>
      <div class="stat"><b>${es.length ? Math.round(words / es.length) : 0}</b><span>${t('avgWords')}</span></div>
      <div class="stat"><b>${es.filter(e => e.starred).length}</b><span>${t('favorites')}</span></div>
    </div>
    <h2>${t('last12Months')}</h2><div class="heat">${heat}</div>
    <h2>${t('entriesPerYear')}</h2>
    <div class="bars">${ys.map(y => `<div class="bar" data-action="filter-year" data-y="${y}" style="cursor:pointer"><span>${years[y]}</span><i style="height:${Math.round(years[y] / maxY * 100)}%"></i></div>`).join('')}</div>
    <div class="bar-labels">${ys.map(y => `<span>${y}</span>`).join('')}</div>
    <h2>${t('entriesByMonth')}</h2>
    <div class="bars">${MONTHS.map((m, i) => `<div class="bar"><span>${months[i + 1] || ''}</span><i style="height:${Math.round((months[i + 1] || 0) / maxM * 100)}%"></i></div>`).join('')}</div>
    <div class="bar-labels">${MONTHS.map((m, i) => `<span>${esc(monthShort(i))}</span>`).join('')}</div>
    <h2>${t('journals')}</h2><div class="cards">${jrows}</div>
    ${longestEntry ? `<h2>${t('longestEntry')}</h2><div class="otd-card" data-action="open-tl" data-id="${longestEntry.id}"><div class="t">${esc(titleOf(longestEntry) || t('untitled'))}</div><div class="m">${t('nWords', { n: wordCount(longestEntry.text) })} · ${fmtShort(longestEntry.created)}</div></div>` : ''}
  </div>`;
}

function renderMapView() { return `<div class="map-wrap"><div id="map"></div></div>`; }
function initMap() {
  const el = $('#map'); if (!el || typeof L === 'undefined') return;
  if (state.map) { try { state.map.remove(); } catch (_) {} state.map = null; }
  const map = L.map(el, { zoomControl: true, attributionControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  const pts = state.data.entries.filter(e => e.location && typeof e.location.lat === 'number' && typeof e.location.lon === 'number');
  const group = [];
  for (const e of pts) {
    const mk = L.circleMarker([e.location.lat, e.location.lon], { radius: 7, color: journalColor(e.journal), fillColor: journalColor(e.journal), fillOpacity: .8, weight: 2 }).addTo(map);
    mk.bindPopup(`<b>${esc(titleOf(e) || t('untitled'))}</b>${esc(fmtShort(e.created))} · ${esc(e.location.name || '')}<br><a href="#/timeline?e=${e.id}">${esc(t('openEntry'))}</a>`);
    group.push(mk);
  }
  if (group.length) map.fitBounds(L.featureGroup(group).getBounds().pad(0.2)); else map.setView([20, 0], 2);
  state.map = map;
  setTimeout(() => map.invalidateSize(), 50);
}

function renderSettings() {
  const s = S(), d = state.data;
  const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button class="${s[key] === v ? 'on' : ''}" data-action="set" data-k="${key}" data-v="${attr(v)}">${l}</button>`).join('')}</div>`;
  const sw = (key) => `<button class="switch ${s[key] ? 'on' : ''}" data-action="set" data-k="${key}" data-v="${s[key] ? '' : '1'}" data-bool="1"></button>`;
  const row = (label, ctl, hint = '') => `<div class="form-row"><label>${label}${hint ? `<div class="hint">${hint}</div>` : ''}</label><div>${ctl}</div></div>`;
  const hasContent = !!LOCAL_CONTENT[LANG];
  return `<div class="page"><h1>${t('settings')}</h1><p class="lead">${t('settingsLead')} <code>${esc(d.dataDir)}</code></p>
  <h2>${t('appearance')}</h2>
  ${row(t('language'), `<select data-set="uiLanguage"><option value="" ${!s.uiLanguage ? 'selected' : ''}>${t('auto')}</option>${LANGS.map(([c, n]) => `<option value="${c}" ${s.uiLanguage === c ? 'selected' : ''}>${n}</option>`).join('')}</select>`, t('languageHint'))}
  ${row(t('theme'), seg('theme', [['system', t('system')], ['light', t('light')], ['dark', t('dark')]]))}
  ${row(t('entryFont'), seg('contentFont', [['serif', t('serif')], ['sans', t('sans')], ['mono', t('mono')]]))}
  ${row(t('fontSize'), `<input type="number" min="12" max="28" value="${s.fontSize}" data-set="fontSize" style="width:80px"> px`)}
  ${row(t('temperature'), seg('temperatureUnit', [['C', '°C'], ['F', '°F']]))}
  ${/^(zh|ja)/.test(LANG) ? row(t('dateNumerals'), seg('dateNumerals', [['arabic', t('arabicNumerals')], ['cjk', t('cjkNumerals')]]), t('dateNumeralsHint')) : ''}
  ${row(t('weekStartsOn'), seg('firstDayOfWeek', [[1, t('monday')], [0, t('sunday')]]))}
  ${row(t('sortTimeline'), seg('sortOrder', [['newest', t('newestFirst')], ['oldest', t('oldestFirst')]]))}
  <h2>${t('journals')}</h2>
  <p class="lead">${t('journalsLead')}</p>
  <div id="journal-rows">${d.journals.map(j => `<div class="j-row" data-jid="${attr(j.id)}"><input type="color" value="${attr(j.color)}" data-jf="color"><input type="text" class="sealtxt" value="${attr(j.seal || '')}" data-jf="seal" maxlength="2" placeholder="${attr(sealOf(j))}" title="${attr(t('sealText'))}"><input type="text" value="${attr(j.name)}" data-jf="name" placeholder="${attr(t('name'))}"><input type="text" class="desc" value="${attr(j.description || '')}" data-jf="description" placeholder="${attr(t('description'))}"><span><button class="btn small ${s.defaultJournal === j.id ? 'primary' : 'outline'}" data-action="set" data-k="defaultJournal" data-v="${attr(j.id)}" title="${attr(t('defaultJournalHint'))}">${s.defaultJournal === j.id ? t('default') : t('makeDefault')}</button> <button class="btn small danger" data-action="journal-delete" data-id="${attr(j.id)}" ${d.journals.length < 2 ? 'disabled' : ''}>${t('delete')}</button></span></div>`).join('')}</div>
  <div class="actions"><button class="btn" data-action="journal-new">${t('addJournal')}</button><button class="btn primary" data-action="journals-save">${t('saveJournals')}</button></div>
  <h2>${t('security')}</h2>
  ${row(t('passcode'), s.passcodeHash ? `<button class="btn" data-action="passcode-set">${t('change')}</button> <button class="btn danger" data-action="passcode-clear">${t('remove')}</button>` : `<button class="btn" data-action="passcode-set">${t('setPasscode')}</button>`, t('passcodeHint'))}
  ${row(t('autoLock'), `<select data-set="autoLockMinutes">${[[0, t('never')], [1, t('oneMinute')], [5, t('nMinutes', { n: 5 })], [15, t('nMinutes', { n: 15 })], [60, t('oneHour')]].map(([v, l]) => `<option value="${v}" ${+s.autoLockMinutes === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
  <h2>${t('dailyReminder')}</h2>
  ${row(t('remindMe'), sw('reminderEnabled'), t('reminderHint'))}
  ${row(t('at'), `<input type="time" value="${attr(s.reminderTime || '21:00')}" data-set="reminderTime">`)}
  <h2>${t('templates')}</h2>
  <div id="template-rows">${d.templates.map((tp, i) => `<div class="t-row" data-ti="${i}"><div class="t-head"><input type="text" value="${attr(tp.icon || '')}" data-tf="icon" style="width:52px" placeholder="📝"><input type="text" value="${attr(tp.name)}" data-tf="name" placeholder="${attr(t('templateName'))}" style="flex:1"><button class="btn small danger" data-action="template-delete" data-i="${i}">${t('delete')}</button></div><textarea data-tf="body">${esc(tp.body)}</textarea></div>`).join('')}</div>
  <div class="actions"><button class="btn" data-action="template-new">${t('addTemplate')}</button><button class="btn primary" data-action="templates-save">${t('saveTemplates')}</button>${hasContent ? `<button class="btn outline" data-action="load-templates">${t('loadBuiltinTemplates')}</button>` : ''}</div>
  <h2>${t('prompts')}</h2>
  <p class="lead">${t('promptsLead2')}</p>
  <textarea id="prompts-text" class="prompts-text">${esc(d.prompts.join('\n'))}</textarea>
  <div class="actions"><button class="btn primary" data-action="prompts-save">${t('savePrompts')}</button>${hasContent ? `<button class="btn outline" data-action="load-prompts">${t('loadBuiltinPrompts')}</button>` : ''}</div>
  <h2>${t('data')}</h2>
  ${row(t('export'), `<a class="btn" href="/api/export.zip" download>${t('exportZip')}</a> <a class="btn" href="/api/export.json" download>${t('exportJson')}</a>`, t('exportHint'))}
  ${row(t('importDayOne'), `<button class="btn" data-action="import-dayone">${t('chooseDayOne')}</button>`, t('importDayOneHint'))}
  ${row(t('importBackup'), `<button class="btn" data-action="import-htmldiary">${t('chooseBackup')}</button>`, t('importBackupHint'))}
  ${row(t('reloadFromDisk'), `<button class="btn" data-action="reload">${t('rescan')}</button>`, t('rescanHint'))}
  <h2>${t('about')}</h2>
  <p class="lead">${t('aboutText')} <span class="kbd">?</span></p>
  </div>`;
}

// ============================================================================ after render: wiring
let editorSel = null; // remembered caret so re-renders while editing don't lose the cursor
function afterRender() {
  const search = $('#search');
  if (search) {
    search.addEventListener('input', debounce(() => { state.query = search.value; renderListOnly(); }, 120));
    search.addEventListener('keydown', ev => { if (ev.key === 'Escape') { search.value = ''; state.query = ''; renderListOnly(); search.blur(); } });
  }
  const ed = $('#editor');
  if (ed) {
    autoGrow(ed);
    if (editorSel) { if (state.focusEditor) ed.focus(); try { ed.setSelectionRange(editorSel[0], editorSel[1]); } catch (_) {} editorSel = null; }
    else if (state.focusEditor) { ed.focus(); ed.setSelectionRange(ed.value.length, ed.value.length); }
    state.focusEditor = false;
    ed.addEventListener('input', () => { onEditorInput(ed); });
    ed.addEventListener('keydown', onEditorKey);
    ed.addEventListener('paste', onPaste);
    const det = $('#detail');
    det.addEventListener('dragover', ev => { ev.preventDefault(); if (!$('.drop-hint', det)) det.insertAdjacentHTML('beforeend', `<div class="drop-hint">${t('dropToAttach')}</div>`); });
    det.addEventListener('dragleave', ev => { if (ev.target === det) $('.drop-hint', det)?.remove(); });
    det.addEventListener('drop', ev => { ev.preventDefault(); $('.drop-hint', det)?.remove(); if (ev.dataTransfer.files.length) uploadFiles(ev.dataTransfer.files); });
  }
  const prose = $('#prose');
  if (prose) prose.addEventListener('change', ev => { const cb = ev.target.closest('input[data-task]'); if (cb) toggleTask(+cb.dataset.task, cb.checked); });
  if (state.route.view === 'map') initMap(); else if (state.map) { try { state.map.remove(); } catch (_) {} state.map = null; }
  if (state.route.view === 'settings') wireSettings();
  const sel = $('.entry-card.selected'); if (sel && state.scrollToSel) { sel.scrollIntoView({ block: 'nearest' }); state.scrollToSel = false; }
  applyTheme();
}
function renderListOnly() { const ls = $('#list-scroll'); if (!ls) { render(); return; } const top = ls.scrollTop; const col = $('.list-col'); if (col) { col.outerHTML = renderListCol(); $('#list-scroll').scrollTop = top; } }
function renderDetailOnly() { const d = $('#detail'); const col = $('.detail-col'); if (!col) { render(); return; } const ed = $('#editor'); if (ed) editorSel = [ed.selectionStart, ed.selectionEnd]; const top = $('.d-scroll', col)?.scrollTop || 0; col.outerHTML = renderDetailCol(); const c2 = $('.d-scroll'); if (c2) c2.scrollTop = top; afterRender(); }
function autoGrow(ta) { ta.style.height = 'auto'; ta.style.height = Math.max(ta.scrollHeight, window.innerHeight * 0.6) + 'px'; }
function applyTheme() {
  const s = S(); const root = document.documentElement;
  LANG = resolveLang(); root.lang = LANG; root.dir = RTL_LANGS.includes(LANG) ? 'rtl' : 'ltr';
  if (s.theme === 'light' || s.theme === 'dark') root.dataset.theme = s.theme; else delete root.dataset.theme;
  root.style.setProperty('--content-font', s.contentFont === 'sans' ? 'var(--sans)' : s.contentFont === 'mono' ? 'var(--mono)' : 'var(--serif)');
  root.style.setProperty('--content-size', (s.fontSize || 17) + 'px');
}

// ============================================================================ entry editing
function currentEntry() { return state.route.e ? E(state.route.e) : null; }
function onEditorInput(ed) {
  const e = currentEntry(); if (!e) return;
  e.text = ed.value; e.photos = photosFromText(e.text);
  autoGrow(ed);
  const st = $('#status'); if (st) { st.textContent = `${t('nWords', { n: wordCount(e.text) })} · ${t('saving')}`; st.classList.add('saving'); }
  queueSave(e);
  updateCardInPlace(e);
}
function photosFromText(t) { const out = []; const re = /\((\/media\/[^)\s]+)\)|src="(\/media\/[^"]+)"/g; let m; while ((m = re.exec(t || ''))) { const p = m[1] || m[2]; if (!out.includes(p)) out.push(p); } return out; }
function updateCardInPlace(e) {
  const card = $(`.entry-card[data-id="${e.id}"]`); if (!card) return;
  const tmp = document.createElement('div'); tmp.innerHTML = entryCard(e, { showDate: !!$('.ec-dow', card) });
  card.replaceWith(tmp.firstElementChild);
}
function queueSave(e) {
  clearTimeout(state.pending.get(e.id));
  state.pending.set(e.id, setTimeout(() => saveNow(e), 700));
}
async function saveNow(e) {
  clearTimeout(state.pending.get(e.id)); state.pending.delete(e.id);
  state.saving++;
  try {
    const { id, text, journal, created, starred, pinned, tags, location, weather, template, prompt } = e;
    const saved = await api('PUT', `/api/entries/${id}`, { text, journal, created, starred, pinned, tags, location, weather, template, prompt });
    Object.assign(e, saved);
    const st = $('#status'); if (st && state.route.e === e.id) { st.textContent = `${t('nWords', { n: wordCount(e.text) })} · ${t('saved')}`; st.classList.remove('saving'); }
  } catch (err) { toast(t('saveFailed') + ': ' + err.message, 4000); }
  finally { state.saving--; }
}
async function flushSaves() { for (const [id] of [...state.pending]) { const e = E(id); if (e) await saveNow(e); } }
async function patchEntry(e, patch, rerender = true) { Object.assign(e, patch); await saveNow(e); if (rerender) render(); }

async function newEntry({ date, journal, text = '', template = '', prompt = '' } = {}) {
  await flushSaves();
  const j = journal || state.route.j || S().defaultJournal || state.data.journals[0].id;
  let created = nowIso();
  if (date && date !== todayStr()) { const n = new Date(); created = toIso(new Date(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), n.getHours(), n.getMinutes())); }
  const e = await api('POST', '/api/entries', { journal: J(j) ? j : state.data.journals[0].id, created, text, template, prompt, tags: prompt ? ['prompt'] : [] });
  state.data.entries.unshift(e);
  state.freshIds.add(e.id);
  state.editing = true; state.focusEditor = true;
  const view = ['timeline', 'calendar', 'media', 'starred'].includes(state.route.view) ? state.route.view : 'timeline';
  const jScope = state.route.j && state.route.j !== e.journal ? null : state.route.j;
  state.filters = { starred: false, photos: false, year: null }; state.query = '';
  go({ view, e: e.id, j: jScope, t: null, d: state.route.view === 'calendar' ? (date || todayStr()) : null });
  return e;
}
async function leaveEntry(id) {
  const e = E(id); if (!e) return;
  await flushSaves();
  if (state.freshIds.has(id) && !e.text.trim() && !e.photos.length) {
    state.freshIds.delete(id);
    try { await api('DELETE', `/api/entries/${id}?permanent=1`); } catch (_) {}
    state.data.entries = state.data.entries.filter(x => x.id !== id);
  }
}
async function deleteEntry(id) {
  const e = E(id); if (!e) return;
  await flushSaves();
  await api('DELETE', `/api/entries/${id}`);
  state.data.entries = state.data.entries.filter(x => x.id !== id);
  state.data.trash.unshift({ ...e, deletedAt: nowIso() });
  state.editing = false;
  toast(t('movedToTrash'));
  go({ e: null });
  if (!state.route.e) render();
}
function toggleTask(n, checked) {
  const e = currentEntry(); if (!e) return;
  let i = 0;
  e.text = e.text.replace(/^(\s*(?:[-*+]|\d+\.)\s+)\[( |x|X)\]/gm, (m, pre) => (i++ === n) ? `${pre}[${checked ? 'x' : ' '}]` : m);
  queueSave(e); renderDetailOnly(); updateCardInPlace(e);
}

// ---- editor formatting
function surround(ed, before, after = before, placeholder = '') {
  const s = ed.selectionStart, en = ed.selectionEnd, v = ed.value; const sel = v.slice(s, en) || placeholder;
  ed.value = v.slice(0, s) + before + sel + after + v.slice(en);
  ed.setSelectionRange(s + before.length, s + before.length + sel.length); ed.focus(); ed.dispatchEvent(new Event('input'));
}
function linePrefix(ed, prefix, numbered = false) {
  const v = ed.value; let s = ed.selectionStart, en = ed.selectionEnd;
  const ls = v.lastIndexOf('\n', s - 1) + 1; let le = v.indexOf('\n', en); if (le < 0) le = v.length;
  const lines = v.slice(ls, le).split('\n');
  const all = lines.every(l => l.startsWith(prefix) || (numbered && /^\d+\.\s/.test(l)));
  const out = lines.map((l, i) => all ? l.replace(numbered ? /^\d+\.\s/ : prefix, '') : (numbered ? `${i + 1}. ` : prefix) + l.replace(/^(\s*[-*+]\s+\[[ x]\]\s*|\s*[-*+]\s+|\d+\.\s+|>\s?|#{1,6}\s+)/, '')).join('\n');
  ed.value = v.slice(0, ls) + out + v.slice(le);
  ed.setSelectionRange(ls, ls + out.length); ed.focus(); ed.dispatchEvent(new Event('input'));
}
function insertAtCursor(ed, text) { const s = ed.selectionStart, en = ed.selectionEnd, v = ed.value; const pre = v.slice(0, s), needNl = pre && !pre.endsWith('\n') ? '\n' : ''; ed.value = pre + needNl + text + v.slice(en); const p = s + needNl.length + text.length; ed.setSelectionRange(p, p); ed.focus(); ed.dispatchEvent(new Event('input')); }
function applyFormat(f) {
  const ed = $('#editor'); if (!ed) return;
  const n = new Date();
  ({
    bold: () => surround(ed, '**', '**', 'bold'), italic: () => surround(ed, '*', '*', 'italic'),
    h1: () => linePrefix(ed, '# '), ul: () => linePrefix(ed, '- '), ol: () => linePrefix(ed, '', true), task: () => linePrefix(ed, '- [ ] '),
    quote: () => linePrefix(ed, '> '), code: () => (ed.selectionStart !== ed.selectionEnd && ed.value.slice(ed.selectionStart, ed.selectionEnd).includes('\n')) ? surround(ed, '```\n', '\n```') : surround(ed, '`', '`', 'code'),
    hr: () => insertAtCursor(ed, '\n---\n\n'), date: () => surround(ed, `${pad2(n.getHours())}:${pad2(n.getMinutes())} `, ''),
  })[f]?.();
}
function onEditorKey(ev) {
  const ed = ev.target;
  if ((ev.metaKey || ev.ctrlKey) && !ev.shiftKey) {
    if (ev.key === 'b') { ev.preventDefault(); applyFormat('bold'); }
    else if (ev.key === 'i') { ev.preventDefault(); applyFormat('italic'); }
    return;
  }
  if (ev.key === 'Enter') { // continue lists
    const v = ed.value, s = ed.selectionStart; const ls = v.lastIndexOf('\n', s - 1) + 1; const line = v.slice(ls, s);
    const m = line.match(/^(\s*)([-*+]\s+\[[ xX]\]\s|[-*+]\s|(\d+)\.\s|>\s?)(.*)$/);
    if (m) {
      ev.preventDefault();
      if (!m[4].trim()) { ed.value = v.slice(0, ls) + v.slice(s); ed.setSelectionRange(ls, ls); }
      else { let pre = m[1] + m[2]; if (m[3]) pre = `${m[1]}${+m[3] + 1}. `; else if (/\[[xX]\]/.test(pre)) pre = pre.replace(/\[[xX]\]/, '[ ]'); ed.value = v.slice(0, s) + '\n' + pre + v.slice(s); ed.setSelectionRange(s + 1 + pre.length, s + 1 + pre.length); }
      ed.dispatchEvent(new Event('input'));
    }
  }
  if (ev.key === 'Tab') { ev.preventDefault(); const s = ed.selectionStart; ed.value = ed.value.slice(0, s) + '  ' + ed.value.slice(ed.selectionEnd); ed.setSelectionRange(s + 2, s + 2); ed.dispatchEvent(new Event('input')); }
  if (ev.key === 'Escape') { ev.preventDefault(); toggleEdit(false); }
}
function onPaste(ev) { const files = [...(ev.clipboardData?.files || [])]; if (files.length) { ev.preventDefault(); uploadFiles(files); } }
async function uploadFiles(files) {
  const e = currentEntry(); if (!e) return;
  const ed = $('#editor');
  for (const f of files) {
    try {
      toast(t('uploading', { name: f.name }), 1200);
      const r = await fetch('/api/media', { method: 'POST', headers: { 'X-Filename': encodeURIComponent(f.name || 'paste.png'), 'Content-Type': f.type || 'application/octet-stream' }, body: f });
      const data = await r.json(); if (!r.ok) throw new Error(data.error);
      const md = `![](${data.url})\n`;
      if (ed) insertAtCursor(ed, md); else { e.text = (e.text.trimEnd() + '\n\n' + md); e.photos = photosFromText(e.text); await saveNow(e); renderDetailOnly(); renderListOnly(); }
    } catch (err) { toast(t('uploadFailed') + ': ' + err.message, 4000); }
  }
}
function toggleEdit(on) {
  const e = currentEntry(); if (!e) return;
  const next = on === undefined ? !state.editing : on;
  if (!next) flushSaves();
  state.editing = next; state.focusEditor = next; editorSel = null;
  renderDetailOnly();
}

// ============================================================================ popovers & modals
function closePop() { $('#popover-root').innerHTML = ''; }
function showPop(anchor, html, { width } = {}) {
  closePop();
  const root = $('#popover-root');
  root.innerHTML = `<div class="pop-backdrop" data-action="pop-close"></div><div class="pop" ${width ? `style="width:${width}px;max-width:${width}px"` : ''}>${html}</div>`;
  const pop = $('.pop', root); const r = anchor.getBoundingClientRect();
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let left = Math.min(r.left, window.innerWidth - pw - 8), top = r.bottom + 6;
  if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
  pop.style.left = Math.max(8, left) + 'px'; pop.style.top = top + 'px';
  return pop;
}
function menu(anchor, items) {
  const html = items.map(it => it === '-' ? '<div class="sep"></div>' : it.header ? `<div class="ph">${esc(it.header)}</div>` : `<button class="mi ${it.danger ? 'danger' : ''} ${it.on ? 'on' : ''}" data-action="mi" data-i="${items.indexOf(it)}">${it.seal ? sealHtml(it.seal, 'sm') : ''}${it.icon ? `<span class="ico">${LI[it.icon] ? li(it.icon) : it.icon}</span>` : ''}<span>${esc(it.label)}</span>${it.kbd ? `<small>${it.kbd}</small>` : ''}</button>`).join('');
  const pop = showPop(anchor, html);
  pop.addEventListener('click', ev => { const b = ev.target.closest('[data-action="mi"]'); if (!b) return; const it = items[+b.dataset.i]; closePop(); it.run && it.run(); });
}
function modal(html, onMount) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-backdrop" data-action="modal-close-bg"><div class="modal">${html}</div></div>`;
  onMount && onMount($('.modal', root));
  return () => { root.innerHTML = ''; };
}
function confirmModal(title, text, okLabel = null, danger = true) {
  okLabel = okLabel || t('delete');
  return new Promise(res => {
    const close = modal(`<h3>${esc(title)}</h3><p>${esc(text)}</p><div class="actions"><button class="btn" data-x="0">${t('cancel')}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-x="1">${esc(okLabel)}</button></div>`, m => {
      m.addEventListener('click', ev => { const b = ev.target.closest('[data-x]'); if (!b) return; close(); res(b.dataset.x === '1'); });
      $('[data-x="1"]', m).focus();
    });
  });
}
function promptModal(title, text, { value = '', placeholder = '', type = 'text', okLabel = null } = {}) {
  okLabel = okLabel || t('ok');
  return new Promise(res => {
    const close = modal(`<h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}<input type="${type}" value="${attr(value)}" placeholder="${attr(placeholder)}" style="max-width:none"><div class="actions"><button class="btn" data-x="0">${t('cancel')}</button><button class="btn primary" data-x="1">${esc(okLabel)}</button></div>`, m => {
      const inp = $('input', m); inp.focus(); inp.select();
      const done = ok => { const v = inp.value; close(); res(ok ? v : null); };
      m.addEventListener('click', ev => { const b = ev.target.closest('[data-x]'); if (b) done(b.dataset.x === '1'); });
      inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') done(true); if (ev.key === 'Escape') done(false); });
    });
  });
}

// ---- entry menus
function dateMenu(anchor) {
  const e = currentEntry(); if (!e) return;
  const v = e.created.slice(0, 16);
  const pop = showPop(anchor, `<div class="ph">${t('entryDateTime')}</div><div class="pad"><input type="datetime-local" value="${attr(v)}" id="dt" step="60"></div><button class="mi" data-x="now"><span class="ico">${li('time')}</span> ${t('setToNow')}</button><div class="pad"><button class="btn primary small" data-x="ok" style="width:100%;justify-content:center">${t('apply')}</button></div>`);
  const apply = () => { const dt = $('#dt', pop).value; if (!dt) return; const d = new Date(dt); if (Number.isNaN(+d)) return; closePop(); patchEntry(e, { created: toIso(d) }); };
  pop.addEventListener('click', ev => { const b = ev.target.closest('[data-x]'); if (!b) return; if (b.dataset.x === 'now') { closePop(); patchEntry(e, { created: nowIso() }); } else apply(); });
  $('#dt', pop).addEventListener('keydown', ev => { if (ev.key === 'Enter') apply(); });
}
function journalMenu(anchor) {
  const e = currentEntry(); if (!e) return;
  menu(anchor, [{ header: t('moveToJournal') }, ...state.data.journals.map(j => ({ label: j.name, seal: j.id, on: j.id === e.journal, run: () => patchEntry(e, { journal: j.id }) }))]);
}
function entryMenu(anchor) {
  const e = currentEntry(); if (!e) return;
  menu(anchor, [
    { label: state.editing ? t('doneEditing') : t('edit'), icon: 'copy', kbd: `${MOD}+E`, run: () => toggleEdit() },
    { label: e.starred ? t('removeFromFavorites') : t('addToFavorites'), icon: 'star', run: () => patchEntry(e, { starred: !e.starred }) },
    { label: e.pinned ? t('unpin') : t('pinToTop'), icon: 'star', run: () => patchEntry(e, { pinned: !e.pinned }) },
    { label: t('changeDateEllipsis'), icon: 'calendar', run: () => dateMenu(anchor) },
    { label: t('moveToJournalEllipsis'), icon: 'all', run: () => journalMenu(anchor) },
    '-',
    { label: t('duplicate'), icon: 'dup', run: async () => { const c = await api('POST', '/api/entries', { ...e, id: undefined, created: nowIso() }); state.data.entries.unshift(c); go({ e: c.id }); toast(t('duplicated')); } },
    { label: t('copyMarkdown'), icon: 'copy', run: () => { navigator.clipboard.writeText(e.text).then(() => toast(t('copied'))); } },
    { label: t('exportEntry'), icon: 'download', run: () => downloadText(`${dayOf(e)}-${(titleOf(e) || 'entry').replace(/[^\w一-鿿-]+/g, '_').slice(0, 40)}.md`, `# ${titleOf(e) || 'Entry'}\n\n_${fmtLong(e.created)} ${fmtTime(e.created)}${e.location?.name ? ' · ' + e.location.name : ''}_\n\n${e.text}`) },
    { label: t('openFileLocation'), icon: 'folder', run: () => toast(`${state.data.dataDir}/entries/${e.journal}/${e.created.slice(0, 4)}/`, 5000) },
    '-',
    { label: t('moveToTrash'), icon: 'trash', danger: true, kbd: `${MOD}+⌫`, run: () => deleteEntry(e.id) },
  ]);
}
function downloadText(name, text) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }

function locMenu(anchor) {
  const e = currentEntry(); if (!e) return;
  const pop = showPop(anchor, `<div class="ph">${t('location')}</div><div class="pad"><input type="search" id="loc-q" placeholder="${attr(t('searchPlace'))}" autocomplete="off"></div><div id="loc-res"></div>
    <button class="mi" data-x="here"><span class="ico">${li('loc')}</span> ${t('useCurrentLocation')}</button>
    ${e.location ? `<button class="mi" data-x="edit"><span class="ico">${li('copy')}</span> ${t('editName')}</button><button class="mi danger" data-x="clear">${t('removeLocation')}</button>` : ''}`, { width: 320 });
  const q = $('#loc-q', pop); q.focus();
  q.addEventListener('input', debounce(async () => {
    const res = $('#loc-res', pop); if (!q.value.trim()) { res.innerHTML = ''; return; }
    res.innerHTML = '<div class="pad"><span class="spin"></span></div>';
    try { const list = await api('GET', `/api/geo/search?q=${encodeURIComponent(q.value.trim())}`); res.innerHTML = list.length ? list.map((l, i) => `<div class="res" data-r="${i}">${esc(l.name)}<small>${esc(l.address || l.display)}</small></div>`).join('') : `<div class="pad" style="color:var(--ink-3)">${t('noResults')}</div>`; res._list = list; }
    catch (err) { res.innerHTML = `<div class="pad" style="color:var(--danger)">${esc(err.message)}</div>`; }
  }, 350));
  q.addEventListener('keydown', ev => { if (ev.key === 'Enter' && q.value.trim()) { closePop(); setLocation(e, { name: q.value.trim(), address: '' }); } });
  pop.addEventListener('click', async ev => {
    const r = ev.target.closest('[data-r]'); if (r) { const l = $('#loc-res', pop)._list[+r.dataset.r]; closePop(); return setLocation(e, { name: l.name, address: l.address, lat: l.lat, lon: l.lon }); }
    const b = ev.target.closest('[data-x]'); if (!b) return;
    if (b.dataset.x === 'clear') { closePop(); patchEntry(e, { location: null }); }
    else if (b.dataset.x === 'edit') { closePop(); const n = await promptModal(t('locationName'), '', { value: e.location.name || '' }); if (n != null) patchEntry(e, { location: { ...e.location, name: n } }); }
    else if (b.dataset.x === 'here') {
      closePop(); toast(t('locating'));
      if (!navigator.geolocation) return toast(t('geoUnavailable'), 4000);
      navigator.geolocation.getCurrentPosition(async pos => {
        const { latitude: lat, longitude: lon } = pos.coords;
        try { const g = await api('GET', `/api/geo/reverse?lat=${lat}&lon=${lon}`); await setLocation(e, { name: g.name, address: g.address, lat, lon }); }
        catch (_) { await setLocation(e, { name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, address: '', lat, lon }); }
      }, err => toast(t('geoFailed') + ': ' + err.message + (location.protocol === 'http:' && location.hostname !== 'localhost' ? ' ' + t('geoHttpHint') : ''), 6000), { timeout: 15000 });
    }
  });
}
async function setLocation(e, loc) {
  await patchEntry(e, { location: loc });
  if (!e.weather && typeof loc.lat === 'number') fetchWeather(e, true);
}
async function fetchWeather(e, quiet = false) {
  if (!e.location || typeof e.location.lat !== 'number') { if (!quiet) toast(t('addLocationFirst')); return; }
  try {
    const wx = await api('GET', `/api/weather?lat=${e.location.lat}&lon=${e.location.lon}&when=${encodeURIComponent(e.created)}`);
    if (wx && wx.temp != null) await patchEntry(e, { weather: wx }); else if (!quiet) toast(t('noWeather'));
  } catch (err) { if (!quiet) toast(err.message, 4000); }
}
function wxMenu(anchor) {
  const e = currentEntry(); if (!e) return;
  menu(anchor, [{ label: t('refreshWeather'), icon: 'refresh', run: () => fetchWeather(e) }, { label: t('removeWeather'), icon: 'x', danger: true, run: () => patchEntry(e, { weather: null }) }]);
}
function tagAdd(anchor) {
  const e = currentEntry(); if (!e) return;
  const all = tagCounts().map(x => x[0]).filter(t => !e.tags.includes(t));
  const pop = showPop(anchor, `<div class="ph">${t('addTag')}</div><div class="pad"><input type="text" id="tag-q" placeholder="${attr(t('tagPlaceholder'))}" autocomplete="off" list="tag-dl"><datalist id="tag-dl">${all.map(t => `<option value="${attr(t)}">`).join('')}</datalist></div><div id="tag-res">${all.slice(0, 12).map(t => `<button class="mi" data-t="${attr(t)}">#${esc(t)}</button>`).join('')}</div>`, { width: 260 });
  const q = $('#tag-q', pop); q.focus();
  const add = tg => { tg = tg.trim().replace(/^#/, ''); if (!tg) return; closePop(); patchEntry(e, { tags: [...new Set([...e.tags, tg])] }); };
  q.addEventListener('keydown', ev => { if (ev.key === 'Enter') add(q.value); });
  q.addEventListener('input', () => { const v = q.value.toLowerCase(); $('#tag-res', pop).innerHTML = all.filter(t => t.toLowerCase().includes(v)).slice(0, 12).map(t => `<button class="mi" data-t="${attr(t)}">#${esc(t)}</button>`).join(''); });
  pop.addEventListener('click', ev => { const b = ev.target.closest('[data-t]'); if (b) add(b.dataset.t); });
}
function templateMenu(anchor, forNew = false) {
  const ts = state.data.templates;
  menu(anchor, [{ header: forNew ? t('newFromTemplateHeader') : t('insertTemplate') }, ...ts.map(tp => ({ label: tp.name, icon: tp.icon || 'copy', run: async () => {
    if (forNew) { await newEntry({ text: tp.body, template: tp.name }); return; }
    const ed = $('#editor'); const e = currentEntry(); if (!ed || !e) return;
    if (!ed.value.trim()) { ed.value = tp.body; e.template = tp.name; ed.setSelectionRange(ed.value.length, ed.value.length); ed.focus(); ed.dispatchEvent(new Event('input')); }
    else insertAtCursor(ed, '\n' + tp.body);
  } })), '-', { label: t('manageTemplates'), icon: 'settings', run: () => go({ view: 'settings' }) }]);
}
function filterMenu(anchor) {
  const f = state.filters; const years = [...new Set(state.data.entries.map(e => e.created.slice(0, 4)))].sort().reverse();
  menu(anchor, [
    { header: t('filter') },
    { label: t('favoritesOnly'), icon: 'star', on: f.starred, run: () => { f.starred = !f.starred; renderListOnly(); } },
    { label: t('withMediaOnly'), icon: 'media', on: f.photos, run: () => { f.photos = !f.photos; renderListOnly(); } },
    ...(years.length > 1 ? [{ header: t('year') }, { label: t('allYears'), on: !f.year, run: () => { f.year = null; renderListOnly(); } }, ...years.map(y => ({ label: y, on: f.year === y, run: () => { f.year = y; renderListOnly(); } }))] : []),
    '-', { header: t('sort') },
    { label: t('newestFirst'), on: S().sortOrder !== 'oldest', run: () => setSetting('sortOrder', 'newest') },
    { label: t('oldestFirst'), on: S().sortOrder === 'oldest', run: () => setSetting('sortOrder', 'oldest') },
  ]);
}
function listMenu(anchor) {
  menu(anchor, [
    { label: t('newEntry'), icon: 'plus', kbd: `${MOD}+N`, run: () => newEntry() },
    { label: t('newFromTemplate'), icon: 'copy', run: () => templateMenu(anchor, true) },
    { label: t('answerTodaysPrompt'), icon: 'prompts', run: () => answerPrompt() },
    '-',
    { label: t('rescan'), icon: 'refresh', run: reloadAll },
    { label: t('exportZip'), icon: 'download', run: () => { location.href = '/api/export.zip'; } },
  ]);
}
async function answerPrompt(i) {
  const ps = state.data.prompts; if (!ps.length) return toast(t('noPrompts'));
  if (i == null) { const doy = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000); i = doy % ps.length; }
  await newEntry({ text: `**${ps[i]}**\n\n`, prompt: ps[i] });
}

// ============================================================================ journals / settings / templates
async function setSetting(k, v) { S()[k] = v; applyTheme(); try { await api('PUT', '/api/settings', { [k]: v }); } catch (err) { toast(err.message); } render(); }
function wireSettings() {
  $$('[data-set]').forEach(el => el.addEventListener('change', () => { let v = el.value; if (el.type === 'number' || el.tagName === 'SELECT' && /^\d+$/.test(v)) v = +v; setSetting(el.dataset.set, v); }));
}
async function saveJournalsFromForm() {
  const rows = $$('#journal-rows .j-row');
  const js = rows.map(r => ({ id: r.dataset.jid, name: $('[data-jf="name"]', r).value.trim() || t('journal'), color: $('[data-jf="color"]', r).value, seal: $('[data-jf="seal"]', r).value.trim().slice(0, 2), description: $('[data-jf="description"]', r).value.trim() }));
  try { state.data.journals = await api('PUT', '/api/journals', js); toast(t('journalsSaved')); render(); } catch (err) { toast(err.message, 4000); }
}
async function newJournal() {
  const name = await promptModal(t('newJournal'), t('newJournalText'), { placeholder: t('journalPlaceholder'), okLabel: t('create') });
  if (!name || !name.trim()) return;
  const palette = INK_PALETTE;
  let id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'journal'; const base = id; let k = 2; while (J(id)) id = `${base}-${k++}`;
  const js = [...state.data.journals, { id, name: name.trim(), color: palette[state.data.journals.length % palette.length], seal: '', description: '' }];
  try { state.data.journals = await api('PUT', '/api/journals', js); go({ view: 'timeline', j: id, e: null, t: null }); render(); toast(t('journalCreated', { name: name.trim() })); } catch (err) { toast(err.message, 4000); }
}
async function deleteJournal(id) {
  const j = J(id); if (!j) return;
  const n = state.data.entries.filter(e => e.journal === id).length;
  const others = state.data.journals.filter(x => x.id !== id);
  const close = modal(`<h3>${esc(t('deleteJournalTitle', { name: j.name }))}</h3><p>${n ? esc(t('deleteJournalHas', { n })) : esc(t('deleteJournalNone'))}</p>
    ${n ? `<select id="mv" style="width:100%;max-width:none">${others.map(o => `<option value="${attr(o.id)}">${esc(t('moveEntriesTo', { name: o.name }))}</option>`).join('')}<option value="__trash">${esc(t('moveEntriesToTrash'))}</option></select>` : ''}
    <div class="actions"><button class="btn" data-x="0">${t('cancel')}</button><button class="btn danger" data-x="1">${t('deleteJournal')}</button></div>`, m => {
    m.addEventListener('click', async ev => {
      const b = ev.target.closest('[data-x]'); if (!b) return; const mv = $('#mv', m)?.value; close(); if (b.dataset.x !== '1') return;
      const q = mv === '__trash' ? '?deleteEntries=1' : mv ? `?moveTo=${encodeURIComponent(mv)}` : '';
      try { state.data.journals = await api('PUT', '/api/journals' + q, others); if (S().defaultJournal === id) await api('PUT', '/api/settings', { defaultJournal: others[0].id }); await reloadAll(false); toast(t('journalDeleted')); } catch (err) { toast(err.message, 4000); }
    });
  });
}
async function saveTemplatesFromForm() {
  const rows = $$('#template-rows .t-row');
  const ts = rows.map((r, i) => ({ id: state.data.templates[i]?.id || uid(), icon: $('[data-tf="icon"]', r).value.trim(), name: $('[data-tf="name"]', r).value.trim() || t('template'), body: $('[data-tf="body"]', r).value }));
  try { state.data.templates = await api('PUT', '/api/templates', ts); toast(t('templatesSaved')); render(); } catch (err) { toast(err.message, 4000); }
}
async function savePromptsFromForm() {
  const ps = $('#prompts-text').value.split('\n').map(s => s.trim()).filter(Boolean);
  try { state.data.prompts = await api('PUT', '/api/prompts', ps); toast(t('promptsSaved')); } catch (err) { toast(err.message, 4000); }
}
async function setPasscode() {
  const a = await promptModal(t('setPasscodeTitle'), t('setPasscodeText'), { type: 'password', okLabel: t('next') }); if (!a) return;
  const b = await promptModal(t('confirmPasscode'), '', { type: 'password', okLabel: t('save') }); if (b == null) return;
  if (a !== b) return toast(t('passcodeMismatch'));
  await setSetting('passcodeHash', sha256(a)); toast(t('passcodeSet'));
}
async function importFile(kind, file) {
  toast(t('importing', { name: file.name }), 3000);
  try {
    const r = await fetch(`/api/import/${kind}?name=${encodeURIComponent(file.name.replace(/\.[^.]+$/, ''))}`, { method: 'POST', body: file });
    const data = await r.json(); if (!r.ok) throw new Error(data.error);
    await reloadAll(false);
    toast(kind === 'dayone' ? t('importedDayOne', { entries: data.entries, media: data.media, journals: data.journals }) + (data.skipped ? ' ' + t('skippedDup', { n: data.skipped }) : '') : t('importedEntries', { n: data.entries }), 6000);
  } catch (err) { toast(t('importFailed') + ': ' + err.message, 6000); }
}
async function reloadAll(rescan = true) {
  if (rescan) await api('POST', '/api/reload');
  const d = await api('GET', '/api/bootstrap');
  state.data = d; render();
}

// ============================================================================ lightbox
function openLightbox(src) {
  const e = currentEntry(); const list = e ? e.photos.filter(isImage) : [src]; let i = Math.max(0, list.indexOf(src));
  const lb = $('#lightbox'); lb.hidden = false;
  const draw = () => { lb.innerHTML = `<img src="${attr(list[i])}" alt="">${list.length > 1 ? `<span class="lb-nav lb-prev" data-lb="-1">‹</span><span class="lb-nav lb-next" data-lb="1">›</span><span class="lb-count">${i + 1} / ${list.length}</span>` : ''}`; };
  draw();
  lb.onclick = ev => { const n = ev.target.closest('[data-lb]'); if (n) { ev.stopPropagation(); i = (i + +n.dataset.lb + list.length) % list.length; draw(); } else { lb.hidden = true; lb.innerHTML = ''; } };
  lb._nav = dir => { i = (i + dir + list.length) % list.length; draw(); };
}

// ============================================================================ lock screen
function lock() {
  if (!S().passcodeHash || state.locked) return;
  state.locked = true;
  const lk = $('#lock'); lk.hidden = false;
  lk.innerHTML = `<div class="lk"><div class="ico">锁</div><h3>${t('locked')}</h3><input type="password" id="pc" placeholder="••••" autofocus><div class="err" id="pc-err"></div></div>`;
  const inp = $('#pc', lk); inp.focus();
  inp.addEventListener('keydown', ev => { if (ev.key !== 'Enter') return; if (sha256(inp.value) === S().passcodeHash) { lk.hidden = true; lk.innerHTML = ''; state.locked = false; state.lastActivity = Date.now(); } else { $('#pc-err').textContent = t('wrongPasscode'); inp.value = ''; } });
}
setInterval(() => { const m = +S?.()?.autoLockMinutes || 0; if (m && !state.locked && Date.now() - state.lastActivity > m * 60000) lock(); }, 15000);
['mousemove', 'keydown', 'click', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { state.lastActivity = Date.now(); }, { passive: true }));

// ============================================================================ reminders + live reload
let lastReminder = '';
setInterval(() => {
  if (!state.data) return; const s = S(); if (!s.reminderEnabled || !s.reminderTime) return;
  const n = new Date(); const hm = `${pad2(n.getHours())}:${pad2(n.getMinutes())}`; const t = todayStr();
  if (hm === s.reminderTime && lastReminder !== t) {
    lastReminder = t;
    if (state.data.entries.some(e => dayOf(e) === t)) return;
    if ('Notification' in window && Notification.permission === 'granted') { const nn = new Notification('htmldiary', { body: t('reminderBody') }); nn.onclick = () => { window.focus(); newEntry(); }; }
    else toast(t('reminderBody'), 8000);
  }
}, 20000);
setInterval(async () => {
  if (!state.data || state.saving || state.pending.size || document.hidden) return;
  try { const base = state.data.version; const v = await api('GET', '/api/version'); if (v.version !== base) { const d = await api('GET', '/api/bootstrap'); state.data = d; if (state.editing) renderListOnly(); else render(); } } catch (_) {}
}, 5000);

// ============================================================================ actions (event delegation)
const actions = {
  nav(el) { const v = el.dataset.view; const keep = el.dataset.keep; go({ view: v, j: keep ? (el.dataset.j || null) : (el.dataset.j || null), e: keep ? state.route.e : null, t: keep ? state.route.t : null, d: v === 'calendar' ? (state.route.d || todayStr()) : null }); state.sbOpen = false; },
  'sb-open'() { state.sbOpen = true; render(); }, 'sb-close'() { state.sbOpen = false; render(); },
  tag(el) { const t = el.dataset.tag; go({ view: 'timeline', t: state.route.t === t ? null : t, e: null }); state.sbOpen = false; },
  'tag-nav'(el, ev) { if (ev.target.closest('.x')) return; go({ view: 'timeline', t: el.dataset.tag, j: null }); },
  'tag-remove'(el, ev) { ev.stopPropagation(); const e = currentEntry(); if (e) patchEntry(e, { tags: e.tags.filter(t => t !== el.dataset.tag) }); },
  'tag-add'(el) { tagAdd(el); },
  open(el) { if (!el.dataset.id) return; if (state.route.e !== el.dataset.id) { state.editing = false; } state.scrollToSel = true; go({ e: el.dataset.id }); },
  'open-tl'(el) { state.editing = false; go({ view: 'timeline', e: el.dataset.id, j: null, t: null, d: null }); },
  'open-day'(el) { state.calMonth = el.dataset.d.slice(0, 7); go({ view: 'calendar', d: el.dataset.d, e: null, j: null, t: null }); },
  'close-entry'() { go({ e: null }); },
  'new-entry'(el) { newEntry({ date: el.dataset.d || (state.route.view === 'calendar' ? state.route.d : null) }); },
  'toggle-edit'() { toggleEdit(); },
  star() { const e = currentEntry(); if (e) patchEntry(e, { starred: !e.starred }); },
  pin() { const e = currentEntry(); if (e) patchEntry(e, { pinned: !e.pinned }); },
  'date-menu'(el) { dateMenu(el); }, 'journal-menu'(el) { journalMenu(el); }, 'entry-menu'(el) { entryMenu(el); },
  'loc-menu'(el) { locMenu(el); }, 'wx-menu'(el) { wxMenu(el); }, 'wx-fetch'() { const e = currentEntry(); if (e) fetchWeather(e); },
  fmt(el) { applyFormat(el.dataset.f); },
  photo() { $('#file-photo').click(); },
  'template-menu'(el) { templateMenu(el); },
  'filter-menu'(el) { filterMenu(el); }, 'list-menu'(el) { listMenu(el); },
  'filter-toggle'(el) { state.filters[el.dataset.k] = !state.filters[el.dataset.k]; renderListOnly(); },
  'filter-year'(el) { state.filters.year = el.dataset.y || null; if (state.route.view !== 'timeline') go({ view: 'timeline', e: null }); else renderListOnly(); },
  'clear-search'() { state.query = ''; render(); },
  'cal-nav'(el) { const [y, m] = state.calMonth.split('-').map(Number); const d = new Date(y, m - 1 + +el.dataset.n, 1); state.calMonth = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; renderListOnly(); },
  'cal-today'() { state.calMonth = todayStr().slice(0, 7); go({ d: todayStr() }); renderListOnly(); },
  'cal-day'(el) { state.calMonth = el.dataset.d.slice(0, 7); go({ d: el.dataset.d }); },
  lightbox(el) { openLightbox(el.dataset.src); },
  'pop-close'() { closePop(); },
  'modal-close-bg'(el, ev) { if (ev.target === el) $('#modal-root').innerHTML = ''; },
  'trash-restore': async el => { const e = await api('POST', `/api/trash/${el.dataset.id}/restore`); state.data.trash = state.data.trash.filter(x => x.id !== el.dataset.id); state.data.entries.unshift(e); state.data.entries.sort((a, b) => b.created.localeCompare(a.created)); toast('Restored'); go({ e: null }); render(); },
  'trash-purge': async el => { if (!await confirmModal(t('deleteForeverTitle'), t('deleteForeverText'))) return; await api('DELETE', `/api/trash/${el.dataset.id}`); state.data.trash = state.data.trash.filter(x => x.id !== el.dataset.id); go({ e: null }); render(); },
  'trash-empty': async () => { if (!state.data.trash.length) return; if (!await confirmModal(t('emptyTrashTitle'), t('emptyTrashText', { n: state.data.trash.length }), t('emptyTrash'))) return; await api('DELETE', '/api/trash'); state.data.trash = []; go({ e: null }); render(); },
  set(el) { let v = el.dataset.v; if (el.dataset.bool) v = !!v; else if (/^\d+$/.test(v)) v = +v; setSetting(el.dataset.k, v); },
  'journal-new'() { newJournal(); }, 'journal-delete'(el) { deleteJournal(el.dataset.id); }, 'journals-save'() { saveJournalsFromForm(); },
  'template-new'() { state.data.templates.push({ id: uid(), name: t('newTemplate'), icon: '📝', body: t('titlePlaceholder') + '\n\n' }); render(); window.scrollTo(0, 0); $('#template-rows .t-row:last-child input[data-tf="name"]')?.focus(); },
  'template-delete'(el) { state.data.templates.splice(+el.dataset.i, 1); render(); },
  'templates-save'() { saveTemplatesFromForm(); }, 'prompts-save'() { savePromptsFromForm(); },
  'prompt-answer'(el) { answerPrompt(+el.dataset.i); },
  'passcode-set'() { setPasscode(); }, 'passcode-clear'() { setSetting('passcodeHash', ''); toast(t('passcodeRemoved')); },
  'load-templates': async () => { const c = LOCAL_CONTENT[LANG]; if (!c) return; if (!await confirmModal(t('loadBuiltinTemplates'), t('replaceListConfirm', { what: t('templates'), lang: langName() }), t('replace'), false)) return; state.data.templates = await api('PUT', '/api/templates', c.templates.map(x => ({ ...x }))); toast(t('templatesSaved')); render(); },
  'load-prompts': async () => { const c = LOCAL_CONTENT[LANG]; if (!c) return; if (!await confirmModal(t('loadBuiltinPrompts'), t('replaceListConfirm', { what: t('prompts'), lang: langName() }), t('replace'), false)) return; state.data.prompts = await api('PUT', '/api/prompts', c.prompts.slice()); toast(t('promptsSaved')); render(); },
  'import-dayone'() { $('#file-import-dayone').click(); }, 'import-htmldiary'() { $('#file-import-htmldiary').click(); },
  reload() { reloadAll().then(() => toast(t('rescanned'))); },
  help() { const K = k => `<span class="kbd">${k}</span>`; modal(`<h3>${t('keyboardShortcuts')}</h3><div class="sc">
    <span>${t('scNewEntry')}</span><span>${K(MOD)} ${K('N')}</span>
    <span>${t('scEdit')}</span><span>${K(MOD)} ${K('E')}</span>
    <span>${t('scSearch')}</span><span>${K(MOD)} ${K('F')} ${t('or')} ${K('/')}</span>
    <span>${t('scSave')}</span><span>${K(MOD)} ${K('S')}</span>
    <span>${t('scBoldItalic')}</span><span>${K(MOD)} ${K('B')} / ${K('I')}</span>
    <span>${t('scNav')}</span><span>${K('J')} / ${K('K')}</span>
    <span>${t('scFavorite')}</span><span>${K('S')}</span>
    <span>${t('scTrash')}</span><span>${K(MOD)} ${K('⌫')}</span>
    <span>${t('scEscape')}</span><span>${K('Esc')}</span>
    <span>${t('scViews')}</span><span>${K('1')}–${K('6')} ${t('scViewsList')}</span>
    <span>${t('scHelp')}</span><span>${K('?')}</span></div>
    <div class="actions"><button class="btn primary" data-action="modal-close">${t('close')}</button></div>`); },
  'modal-close'() { $('#modal-root').innerHTML = ''; },
};
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-action]'); if (!el) return;
  const fn = actions[el.dataset.action]; if (!fn) return;
  if (el.tagName === 'A') return;
  fn(el, ev);
});
$('#file-photo').addEventListener('change', ev => { uploadFiles(ev.target.files); ev.target.value = ''; });
$('#file-import-dayone').addEventListener('change', ev => { if (ev.target.files[0]) importFile('dayone', ev.target.files[0]); ev.target.value = ''; });
$('#file-import-htmldiary').addEventListener('change', ev => { if (ev.target.files[0]) importFile('htmldiary', ev.target.files[0]); ev.target.value = ''; });

// ============================================================================ keyboard
document.addEventListener('keydown', ev => {
  if (state.locked) return;
  const mod = ev.metaKey || ev.ctrlKey;
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  const lb = $('#lightbox');
  if (!lb.hidden) { if (ev.key === 'Escape') { lb.hidden = true; lb.innerHTML = ''; } if (ev.key === 'ArrowRight') lb._nav?.(1); if (ev.key === 'ArrowLeft') lb._nav?.(-1); return; }
  if (ev.key === 'Escape') { if ($('#popover-root').innerHTML) return closePop(); if ($('#modal-root').innerHTML) return $('#modal-root').innerHTML = ''; if (state.editing && !typing) return toggleEdit(false); if (!typing && state.route.e) return go({ e: null }); }
  if (mod && ev.key.toLowerCase() === 'n') { ev.preventDefault(); return newEntry(); }
  if (mod && ev.key.toLowerCase() === 'e' && currentEntry()) { ev.preventDefault(); return toggleEdit(); }
  if (mod && ev.key.toLowerCase() === 's') { ev.preventDefault(); flushSaves().then(() => toast(t('savedToast'))); return; }
  if ((mod && ev.key.toLowerCase() === 'f') || (!typing && ev.key === '/')) { ev.preventDefault(); const s = $('#search'); if (s) { s.focus(); s.select(); } else go({ view: 'timeline' }); return; }
  if (mod && ev.key === 'Backspace' && currentEntry() && !state.editing) { ev.preventDefault(); return deleteEntry(state.route.e); }
  if (typing) return;
  if (ev.key === '?') return actions.help();
  if (ev.key === 'j' || ev.key === 'k' || ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
    const list = state.route.view === 'trash' ? state.data.trash : scopeEntries(); if (!list.length) return;
    const i = list.findIndex(x => x.id === state.route.e); const dir = (ev.key === 'j' || ev.key === 'ArrowDown') ? 1 : -1;
    const n = list[Math.min(list.length - 1, Math.max(0, i + dir))]; if (n && n.id !== state.route.e) { ev.preventDefault(); state.editing = false; state.scrollToSel = true; go({ e: n.id }); }
    return;
  }
  if (ev.key === 's' && currentEntry()) return actions.star();
  if (ev.key === 'e' && currentEntry()) return toggleEdit(true);
  const views = { 1: 'timeline', 2: 'calendar', 3: 'media', 4: 'map', 5: 'otd', 6: 'stats' };
  if (views[ev.key]) go({ view: views[ev.key], d: views[ev.key] === 'calendar' ? (state.route.d || todayStr()) : null });
});
window.addEventListener('beforeunload', ev => { if (state.pending.size) { flushSaves(); ev.preventDefault(); ev.returnValue = ''; } });

// ============================================================================ init
(async function init() {
  try {
    state.data = await api('GET', '/api/bootstrap');
  } catch (err) { $('#app').innerHTML = `<div class="boot">Could not reach the htmldiary server: ${esc(err.message)}</div>`; return; }
  state.route = parseHash();
  if (state.route.view === 'calendar' && !state.route.d) state.route.d = todayStr();
  if (state.route.d) state.calMonth = state.route.d.slice(0, 7);
  applyTheme();
  render();
  if (S().passcodeHash) lock();
  if (S().reminderEnabled && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
})();
