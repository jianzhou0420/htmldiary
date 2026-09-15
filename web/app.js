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
function fmtMonthYear(ym) { const [y, m] = ym.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; }
function fmtLong(iso) { const d = localDate(iso); return `${DOWS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; }
function fmtShort(iso) { const d = localDate(iso); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`; }
function fmtTime(iso) { const [h, m] = iso.slice(11, 16).split(':').map(Number); if (Number.isNaN(h)) return ''; return `${h % 12 || 12}:${pad2(m)} ${h < 12 ? 'AM' : 'PM'}`; }
function relDay(iso) { const t = todayStr(), d = iso.slice(0, 10); if (d === t) return 'Today'; const y = new Date(); y.setDate(y.getDate() - 1); if (d === toIso(y).slice(0, 10)) return 'Yesterday'; return ''; }
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

const ICONS = {
  timeline: '☰', calendar: '📅', media: '🖼', map: '🗺', otd: '🕰', prompts: '💡', starred: '★', stats: '📈', trash: '🗑', settings: '⚙', all: '📓', tags: '#',
};
function renderSidebar() {
  const d = state.data, r = state.route;
  const counts = {}; for (const e of d.entries) counts[e.journal] = (counts[e.journal] || 0) + 1;
  const isActive = (view, j) => r.view === view && (r.j || null) === (j || null) && !r.t;
  const item = (view, label, ico, extra = '', j = null, count = '') =>
    `<div class="sb-item ${isActive(view, j) ? 'active' : ''}" data-action="nav" data-view="${view}" ${j ? `data-j="${attr(j)}"` : ''}>${extra || `<span class="sb-ico">${ico}</span>`}<span class="sb-label">${esc(label)}</span><span class="sb-count">${count}</span></div>`;
  const tags = tagCounts().slice(0, 40);
  return `<aside class="sidebar">
    <div class="sb-search"><input type="search" id="search" placeholder="Search entries" value="${attr(state.query)}" autocomplete="off"></div>
    <div class="sb-scroll">
      <div class="sb-section">Journals <button data-action="journal-new" title="New journal">+</button></div>
      ${item('timeline', 'All Entries', ICONS.all, '', null, d.entries.length)}
      ${d.journals.map(j => item('timeline', j.name, '', `<span class="sb-dot" style="background:${attr(j.color)}"></span>`, j.id, counts[j.id] || 0)).join('')}
      <div class="sb-section">Views</div>
      ${item('starred', 'Favorites', ICONS.starred, '', null, d.entries.filter(e => e.starred).length)}
      ${item('otd', 'On This Day', ICONS.otd)}
      ${item('calendar', 'Calendar', ICONS.calendar)}
      ${item('media', 'Media', ICONS.media, '', null, d.entries.reduce((n, e) => n + e.photos.length, 0))}
      ${item('map', 'Map', ICONS.map)}
      ${item('prompts', 'Daily Prompts', ICONS.prompts)}
      ${item('stats', 'Streaks & Stats', ICONS.stats)}
      ${item('trash', 'Trash', ICONS.trash, '', null, d.trash.length || '')}
      ${tags.length ? `<div class="sb-section">Tags</div><div class="sb-tags">${tags.map(([t, n]) => `<span class="tag-chip ${r.t === t ? 'active' : ''}" data-action="tag" data-tag="${attr(t)}">${esc(t)} <small>${n}</small></span>`).join('')}</div>` : ''}
    </div>
    <div class="sb-foot">
      <div class="sb-item ${r.view === 'settings' ? 'active' : ''}" data-action="nav" data-view="settings"><span class="sb-ico">⚙</span><span class="sb-label">Settings</span></div>
      <div class="sb-item" data-action="help"><span class="sb-ico">?</span></div>
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

// ---------------------------------------------------------------- list column
function scopeTitle() {
  const r = state.route;
  if (r.t) return `#${r.t}`;
  if (r.view === 'starred') return 'Favorites';
  if (r.view === 'trash') return 'Trash';
  if (r.j) { const j = J(r.j); return j ? `<span class="sb-dot" style="background:${attr(j.color)}"></span>${esc(j.name)}` : 'Journal'; }
  return 'All Entries';
}
function renderListCol() {
  const r = state.route;
  const f = state.filters;
  const anyFilter = f.starred || f.photos || f.year;
  const views = [['timeline', ICONS.timeline, 'Timeline'], ['calendar', ICONS.calendar, 'Calendar'], ['media', ICONS.media, 'Media']];
  const isTrash = r.view === 'trash';
  const head = `<div class="list-head">
      <button class="icon-btn mob-only" data-action="sb-open" title="Menu">${SVG.menu}</button>
      <h2>${scopeTitle()}</h2>
      ${isTrash ? `<button class="btn small danger" data-action="trash-empty">Empty</button>` : `
      <button class="icon-btn ${anyFilter ? 'active' : ''}" data-action="filter-menu" title="Filter & sort">${SVG.filter}</button>
      <button class="icon-btn" data-action="list-menu" title="More">${SVG.more}</button>
      <button class="icon-btn primary" data-action="new-entry" title="New entry (${MOD}+N)">${SVG.plus}</button>`}
    </div>
    ${isTrash || r.view === 'starred' ? '' : `<div class="view-switch">${views.map(([v, ico, label]) => `<button class="icon-btn ${r.view === v ? 'active' : ''}" data-action="nav" data-view="${v}" data-j="${attr(r.j || '')}" data-keep="1">${ico} ${label}</button>`).join('')}</div>`}
    ${anyFilter || state.query ? `<div class="filter-bar">${state.query ? `<span class="tag-chip active">“${esc(state.query)}” <span data-action="clear-search">×</span></span>` : ''}${f.starred ? `<span class="tag-chip active" data-action="filter-toggle" data-k="starred">★ Starred ×</span>` : ''}${f.photos ? `<span class="tag-chip active" data-action="filter-toggle" data-k="photos">🖼 With media ×</span>` : ''}${f.year ? `<span class="tag-chip active" data-action="filter-year" data-y="">${f.year} ×</span>` : ''}</div>` : ''}`;
  let body;
  if (isTrash) body = renderTrashList();
  else if (r.view === 'calendar') body = renderCalendar();
  else if (r.view === 'media') body = renderMediaGrid();
  else body = renderTimeline(scopeEntries());
  return `<div class="list-col">${head}<div class="list-scroll" id="list-scroll">${body}</div></div>`;
}

function entryCard(e, { showDate = true, cls = '' } = {}) {
  const t = titleOf(e), x = excerptOf(e);
  const d = localDate(e.created);
  const photo = e.photos.find(isImage);
  const meta = [];
  meta.push(fmtTime(e.created));
  if (e.location && e.location.name) meta.push('📍 ' + esc(e.location.name));
  if (e.weather && e.weather.temp != null) meta.push(`${e.weather.icon || ''} ${fmtTemp(e.weather.temp)}`);
  if (e.pinned) meta.push('📌');
  const tagHtml = e.tags.slice(0, 4).map(t => `<span class="ec-tag">#${esc(t)}</span>`).join('');
  return `<div class="entry-card ${cls} ${state.route.e === e.id ? 'selected' : ''}" data-action="open" data-id="${e.id}">
    <div class="ec-date">${showDate ? `<div class="ec-dow">${DOWS[d.getDay()].slice(0, 3).toUpperCase()}</div><div class="ec-day">${d.getDate()}</div>` : ''}</div>
    <div class="ec-body" style="border-left-color:${attr(journalColor(e.journal))}">
      <div class="ec-title ${t ? '' : 'untitled'}">${t ? esc(t) : (photo ? 'Photo' : 'Empty entry')}${e.starred ? ' <span class="ec-star">★</span>' : ''}</div>
      ${x ? `<div class="ec-excerpt">${esc(x)}</div>` : ''}
      <div class="ec-meta">${meta.map(m => `<span>${m}</span>`).join('')}${tagHtml}</div>
    </div>
    ${photo ? `<div class="ec-thumb-wrap"><img class="ec-thumb" src="${attr(photo)}" loading="lazy" alt="">${e.photos.length > 1 ? `<span class="ec-thumb-count">${e.photos.length}</span>` : ''}</div>` : ''}
  </div>`;
}

function renderTimeline(list) {
  if (!list.length) return `<div class="empty"><strong>${state.query || state.filters.starred || state.filters.photos ? 'No matches' : 'No entries yet'}</strong>${state.query ? 'Try a different search.' : `Press <span class="kbd">${MOD}</span> <span class="kbd">N</span> or the + button to write your first entry.`}<br><button class="btn primary" data-action="new-entry">New Entry</button></div>`;
  let out = '', month = '', day = '';
  for (const e of list) {
    const ym = e.created.slice(0, 7);
    if (e.pinned && month !== 'pinned') { month = 'pinned'; out += `<div class="tl-month">📌 Pinned</div>`; }
    else if (!e.pinned && ym !== month) { month = ym; day = ''; out += `<div class="tl-month">${fmtMonthYear(ym)}</div>`; }
    const dd = dayOf(e); const showDate = e.pinned || dd !== day; day = dd;
    out += entryCard(e, { showDate });
  }
  return out;
}

function renderTrashList() {
  const t = state.data.trash;
  if (!t.length) return `<div class="empty"><strong>Trash is empty</strong>Deleted entries stay here until you empty the trash.</div>`;
  return t.map(e => entryCard(e, { cls: 'trash-card' })).join('');
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
  const dows = []; for (let i = 0; i < 7; i++) dows.push(`<div class="cal-dow">${DOWS[(fdow + i) % 7].slice(0, 2)}</div>`);
  const sel = state.route.d;
  const dayList = sel ? (byDay[sel] || []) : [];
  const below = sel ? (dayList.length ? `<div class="tl-month">${fmtLong(sel + 'T00:00')}</div>` + dayList.map(e => entryCard(e, { showDate: false })).join('') : `<div class="empty"><strong>${fmtLong(sel + 'T00:00')}</strong>No entries on this day.<br><button class="btn primary" data-action="new-entry" data-d="${sel}">Write about this day</button></div>`) : `<div class="empty">Select a day to see its entries.</div>`;
  return `<div class="cal">
    <div class="cal-head"><button class="icon-btn" data-action="cal-nav" data-n="-1">${SVG.prev}</button><b data-action="cal-today" style="cursor:pointer">${MONTHS[m - 1]} ${y}</b><button class="icon-btn" data-action="cal-nav" data-n="1">${SVG.next}</button></div>
    <div class="cal-grid">${dows.join('')}${cells.join('')}</div>
  </div>${below}`;
}

function renderMediaGrid() {
  const list = scopeEntries().filter(e => e.photos.length);
  if (!list.length) return `<div class="empty"><strong>No media yet</strong>Photos and videos you add to entries will show up here.</div>`;
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
    return `<div class="detail-col"><div class="empty" style="margin:auto"><strong>${list.length ? 'Select an entry' : 'Welcome to htmldiary'}</strong>
      ${st.current ? `🔥 ${st.current}-day streak · ` : ''}${state.data.entries.length} entries · ${state.data.journals.length} journal${state.data.journals.length === 1 ? '' : 's'}<br>
      <button class="btn primary" data-action="new-entry">New Entry</button> <button class="btn" data-action="nav" data-view="otd">On This Day</button></div></div>`;
  }
  const j = J(e.journal) || { name: e.journal, color: '#888' };
  const list = isTrash ? state.data.trash : scopeEntries();
  const idx = list.findIndex(x => x.id === e.id);
  const prev = list[idx - 1], next = list[idx + 1];
  const rel = relDay(e.created);
  const head = `<div class="d-head">
    <button class="icon-btn mob-only" data-action="close-entry" title="Back">${SVG.back}</button>
    <button class="icon-btn" data-action="open" data-id="${prev ? prev.id : ''}" ${prev ? '' : 'disabled style="opacity:.3"'} title="Newer">${SVG.prev}</button>
    <button class="icon-btn" data-action="open" data-id="${next ? next.id : ''}" ${next ? '' : 'disabled style="opacity:.3"'} title="Older">${SVG.next}</button>
    <span class="d-date" data-action="date-menu" title="Change date">${rel ? rel + ' · ' : ''}${fmtLong(e.created)}<small>${fmtTime(e.created)}</small></span>
    <span class="spacer"></span>
    ${isTrash ? `<button class="btn small" data-action="trash-restore" data-id="${e.id}">Restore</button><button class="btn small danger" data-action="trash-purge" data-id="${e.id}">Delete forever</button>` : `
    <span class="chip" data-action="journal-menu"><span class="sb-dot" style="background:${attr(j.color)}"></span>${esc(j.name)} ▾</span>
    <button class="icon-btn star-btn ${e.starred ? 'on' : ''}" data-action="star" title="Favorite">${e.starred ? SVG.starOn : SVG.star}</button>
    <button class="icon-btn pin-btn ${e.pinned ? 'on' : ''}" data-action="pin" title="Pin">${SVG.pin}</button>
    <button class="btn small ${state.editing ? 'primary' : ''}" data-action="toggle-edit" title="${MOD}+E">${state.editing ? 'Done' : 'Edit'}</button>
    <button class="icon-btn" data-action="entry-menu" title="More">${SVG.more}</button>`}
  </div>`;
  const loc = e.location;
  const wx = e.weather;
  const meta = `<div class="d-meta">
    ${loc && (loc.name || loc.address) ? `<span class="chip" data-action="loc-menu" title="${attr(loc.address || '')}">📍 ${esc(loc.name || loc.address)}</span>` : (isTrash ? '' : `<span class="chip ghost" data-action="loc-menu">📍 Add location</span>`)}
    ${wx && wx.temp != null ? `<span class="chip" data-action="wx-menu" title="${attr(wx.desc || '')}">${wx.icon || '🌤'} ${fmtTemp(wx.temp)} ${esc(wx.desc || '')}</span>` : (isTrash ? '' : `<span class="chip ghost" data-action="wx-fetch">🌤 Weather</span>`)}
    ${e.tags.map(t => `<span class="chip" data-action="tag-nav" data-tag="${attr(t)}">#${esc(t)}${isTrash ? '' : ` <span class="x" data-action="tag-remove" data-tag="${attr(t)}">×</span>`}</span>`).join('')}
    ${isTrash ? '' : `<span class="chip ghost" data-action="tag-add">+ Tag</span>`}
    ${e.template ? `<span class="chip" title="Template">📝 ${esc(e.template)}</span>` : ''}
  </div>`;
  let body, foot = '';
  if (state.editing && !isTrash) {
    body = `<textarea class="editor" id="editor" placeholder="Start writing…" spellcheck="true">${esc(e.text)}</textarea>`;
    const fmt = (a, ico, title) => `<button class="fmt" data-action="fmt" data-f="${a}" title="${title}">${ico}</button>`;
    foot = `<div class="d-foot">
      ${fmt('bold', SVG.bold, `Bold (${MOD}+B)`)}${fmt('italic', SVG.italic, `Italic (${MOD}+I)`)}${fmt('h1', SVG.h, 'Heading')}<span class="sep"></span>
      ${fmt('ul', SVG.ul, 'Bulleted list')}${fmt('ol', SVG.ol, 'Numbered list')}${fmt('task', SVG.task, 'Checklist')}${fmt('quote', SVG.quote, 'Quote')}${fmt('code', SVG.code, 'Code')}${fmt('hr', SVG.hr, 'Divider')}<span class="sep"></span>
      <button class="fmt" data-action="photo" title="Insert photo / video">${SVG.photo}</button>
      <button class="fmt" data-action="template-menu" title="Insert template">${SVG.template}</button>
      <button class="fmt" data-action="fmt" data-f="date" title="Insert current time">🕒</button>
      <span class="status" id="status">${wordCount(e.text)} words</span>
    </div>`;
  } else {
    body = `<article class="prose" id="prose">${renderMarkdown(e.text)}</article>`;
    if (!isTrash) foot = `<div class="d-foot"><span class="status">${wordCount(e.text)} words · ${e.photos.length ? e.photos.length + ' media · ' : ''}edited ${fmtShort(e.modified)}</span></div>`;
  }
  return `<div class="detail-col" id="detail" style="position:relative">${head}<div class="d-scroll">${meta}<div class="d-body">${body}</div></div>${foot}</div>`;
}

function renderMarkdown(text) {
  if (!text || !text.trim()) return '<p class="empty-hint">Nothing written yet. Press Edit to start.</p>';
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
  const t = todayStr(); const md = t.slice(5);
  const yearNow = +t.slice(0, 4);
  const list = state.data.entries.filter(e => e.created.slice(5, 10) === md).sort((a, b) => b.created.localeCompare(a.created));
  const groups = new Map(); for (const e of list) { const y = +e.created.slice(0, 4); (groups.get(y) || groups.set(y, []).get(y)).push(e); }
  const d = localDate(t + 'T00:00');
  let out = `<div class="page"><h1>On This Day</h1><p class="lead">${d.getDate()} ${MONTHS[d.getMonth()]} — looking back across your journals.</p>`;
  if (!list.length) out += `<div class="empty"><strong>Nothing from this day yet</strong>Write today, and next year this page will greet you with it.<br><button class="btn primary" data-action="new-entry">Write today's entry</button></div>`;
  for (const [y, es] of groups) {
    const diff = yearNow - y;
    out += `<div class="otd-year">${diff === 0 ? 'Today' : diff === 1 ? '1 year ago' : `${diff} years ago`} · ${y}</div>`;
    out += es.map(e => `<div class="otd-card" data-action="open-tl" data-id="${e.id}" style="border-left-color:${attr(journalColor(e.journal))}"><div class="t">${esc(titleOf(e) || 'Untitled')}</div><div class="x">${esc(stripMd(e.text).slice(0, 400))}</div><div class="m">${esc(J(e.journal)?.name || '')} · ${fmtTime(e.created)}${e.location?.name ? ' · 📍 ' + esc(e.location.name) : ''}${e.photos.length ? ` · 🖼 ${e.photos.length}` : ''}</div></div>`).join('');
  }
  return out + '</div>';
}

function renderPrompts() {
  const prompts = state.data.prompts;
  const doy = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const todayIdx = prompts.length ? doy % prompts.length : 0;
  const answered = new Set(state.data.entries.map(e => e.prompt).filter(Boolean));
  const card = (p, i, today) => `<div class="p-card ${today ? 'today' : ''}"><span class="q">${esc(p)}</span>${answered.has(p) ? '<span class="tag-chip">answered</span>' : ''}<button class="btn ${today ? 'primary' : ''} small" data-action="prompt-answer" data-i="${i}">Answer</button></div>`;
  return `<div class="page"><h1>Daily Prompts</h1><p class="lead">A question a day. Edit the list in Settings → Prompts.</p>
    <h2>Today's prompt</h2>${prompts.length ? card(prompts[todayIdx], todayIdx, true) : '<div class="empty">No prompts configured.</div>'}
    <h2>All prompts</h2>${prompts.map((p, i) => i === todayIdx ? '' : card(p, i, false)).join('')}</div>`;
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
    heat += `<i class="${n ? 'l' + Math.min(4, n) : ''}" title="${ds}: ${n} ${n === 1 ? 'entry' : 'entries'}"${n ? ` data-action="open-day" data-d="${ds}" style="cursor:pointer"` : ''}></i>`;
  }
  const first = es.length ? es.reduce((a, e) => e.created < a ? e.created : a, es[0].created) : null;
  const months = {}; for (const e of es) { const m = +e.created.slice(5, 7); months[m] = (months[m] || 0) + 1; }
  const maxM = Math.max(1, ...Object.values(months));
  const longestEntry = es.reduce((a, e) => wordCount(e.text) > (a ? wordCount(a.text) : -1) ? e : a, null);
  const jrows = state.data.journals.map(j => { const n = es.filter(e => e.journal === j.id).length; return `<div class="stat" style="border-left:4px solid ${attr(j.color)}"><b>${n}</b><span>${esc(j.name)}</span></div>`; }).join('');
  return `<div class="page"><h1>Streaks & Stats</h1><p class="lead">${first ? `Journaling since ${fmtShort(first)}.` : 'No entries yet.'}</p>
    <div class="cards">
      <div class="stat"><b>🔥 ${st.current}</b><span>Current streak (days)</span></div>
      <div class="stat"><b>${st.longest}</b><span>Longest streak</span></div>
      <div class="stat"><b>${es.length}</b><span>Entries</span></div>
      <div class="stat"><b>${st.days}</b><span>Days journaled</span></div>
      <div class="stat"><b>${words.toLocaleString()}</b><span>Words</span></div>
      <div class="stat"><b>${photos}</b><span>Media</span></div>
      <div class="stat"><b>${es.length ? Math.round(words / es.length) : 0}</b><span>Avg words / entry</span></div>
      <div class="stat"><b>${es.filter(e => e.starred).length}</b><span>Favorites</span></div>
    </div>
    <h2>Last 12 months</h2><div class="heat">${heat}</div>
    <h2>Entries per year</h2>
    <div class="bars">${ys.map(y => `<div class="bar" data-action="filter-year" data-y="${y}" style="cursor:pointer"><span>${years[y]}</span><i style="height:${Math.round(years[y] / maxY * 100)}%"></i></div>`).join('')}</div>
    <div class="bar-labels">${ys.map(y => `<span>${y}</span>`).join('')}</div>
    <h2>Entries by month</h2>
    <div class="bars">${MONTHS.map((m, i) => `<div class="bar"><span>${months[i + 1] || ''}</span><i style="height:${Math.round((months[i + 1] || 0) / maxM * 100)}%"></i></div>`).join('')}</div>
    <div class="bar-labels">${MONTHS.map(m => `<span>${m.slice(0, 3)}</span>`).join('')}</div>
    <h2>Journals</h2><div class="cards">${jrows}</div>
    ${longestEntry ? `<h2>Longest entry</h2><div class="otd-card" data-action="open-tl" data-id="${longestEntry.id}"><div class="t">${esc(titleOf(longestEntry) || 'Untitled')}</div><div class="m">${wordCount(longestEntry.text)} words · ${fmtShort(longestEntry.created)}</div></div>` : ''}
  </div>`;
}

function renderMapView() { return `<div class="map-wrap"><div id="map"></div></div>`; }
function initMap() {
  const el = $('#map'); if (!el || typeof L === 'undefined') return;
  if (state.map) { try { state.map.remove(); } catch (_) {} state.map = null; }
  const map = L.map(el, { zoomControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  const pts = state.data.entries.filter(e => e.location && typeof e.location.lat === 'number' && typeof e.location.lon === 'number');
  const group = [];
  for (const e of pts) {
    const mk = L.circleMarker([e.location.lat, e.location.lon], { radius: 7, color: journalColor(e.journal), fillColor: journalColor(e.journal), fillOpacity: .8, weight: 2 }).addTo(map);
    mk.bindPopup(`<b>${esc(titleOf(e) || 'Untitled')}</b>${esc(fmtShort(e.created))} · ${esc(e.location.name || '')}<br><a href="#/timeline?e=${e.id}">Open entry →</a>`);
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
  return `<div class="page"><h1>Settings</h1><p class="lead">Everything is stored as plain files in <code>${esc(d.dataDir)}</code>.</p>
  <h2>Appearance</h2>
  ${row('Theme', seg('theme', [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]))}
  ${row('Entry font', seg('contentFont', [['sans', 'Sans'], ['serif', 'Serif'], ['mono', 'Mono']]))}
  ${row('Font size', `<input type="number" min="12" max="28" value="${s.fontSize}" data-set="fontSize" style="width:80px"> px`)}
  ${row('Temperature', seg('temperatureUnit', [['C', '°C'], ['F', '°F']]))}
  ${row('Week starts on', seg('firstDayOfWeek', [[1, 'Monday'], [0, 'Sunday']]))}
  ${row('Sort timeline', seg('sortOrder', [['newest', 'Newest first'], ['oldest', 'Oldest first']]))}
  <h2>Journals</h2>
  <div id="journal-rows">${d.journals.map(j => `<div class="j-row" data-jid="${attr(j.id)}"><input type="color" value="${attr(j.color)}" data-jf="color"><input type="text" value="${attr(j.name)}" data-jf="name" placeholder="Name"><input type="text" class="desc" value="${attr(j.description || '')}" data-jf="description" placeholder="Description"><span><button class="btn small ${s.defaultJournal === j.id ? 'primary' : 'outline'}" data-action="set" data-k="defaultJournal" data-v="${attr(j.id)}" title="Default journal for new entries">${s.defaultJournal === j.id ? 'Default' : 'Make default'}</button> <button class="btn small danger" data-action="journal-delete" data-id="${attr(j.id)}" ${d.journals.length < 2 ? 'disabled' : ''}>Delete</button></span></div>`).join('')}</div>
  <div class="actions"><button class="btn" data-action="journal-new">+ New journal</button><button class="btn primary" data-action="journals-save">Save journals</button></div>
  <h2>Security</h2>
  ${row('Passcode', s.passcodeHash ? `<button class="btn" data-action="passcode-set">Change</button> <button class="btn danger" data-action="passcode-clear">Remove</button>` : `<button class="btn" data-action="passcode-set">Set a passcode</button>`, 'Locks the page on load and after idle time. Data on disk stays unencrypted.')}
  ${row('Auto-lock after', `<select data-set="autoLockMinutes">${[[0, 'Never'], [1, '1 minute'], [5, '5 minutes'], [15, '15 minutes'], [60, '1 hour']].map(([v, l]) => `<option value="${v}" ${+s.autoLockMinutes === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
  <h2>Daily reminder</h2>
  ${row('Remind me to write', sw('reminderEnabled'), 'Uses browser notifications while htmldiary is open in a tab.')}
  ${row('At', `<input type="time" value="${attr(s.reminderTime || '21:00')}" data-set="reminderTime">`)}
  <h2>Templates</h2>
  <div id="template-rows">${d.templates.map((t, i) => `<div class="t-row" data-ti="${i}"><div class="t-head"><input type="text" value="${attr(t.icon || '')}" data-tf="icon" style="width:52px" placeholder="📝"><input type="text" value="${attr(t.name)}" data-tf="name" placeholder="Template name" style="flex:1"><button class="btn small danger" data-action="template-delete" data-i="${i}">Delete</button></div><textarea data-tf="body">${esc(t.body)}</textarea></div>`).join('')}</div>
  <div class="actions"><button class="btn" data-action="template-new">+ New template</button><button class="btn primary" data-action="templates-save">Save templates</button></div>
  <h2>Prompts</h2>
  <p class="lead">One prompt per line. Today's prompt rotates through the list by day of year.</p>
  <textarea id="prompts-text" style="width:100%;min-height:160px;font-family:var(--mono-font);font-size:12.5px;padding:8px 10px;border-radius:7px;border:1px solid var(--line-strong);background:var(--bg-elev)">${esc(d.prompts.join('\n'))}</textarea>
  <div class="actions"><button class="btn primary" data-action="prompts-save">Save prompts</button></div>
  <h2>Data</h2>
  ${row('Export', `<a class="btn" href="/api/export.zip" download>⬇ Export everything (.zip)</a> <a class="btn" href="/api/export.json" download>⬇ JSON</a>`, 'The zip holds your Markdown entries, media, and a htmldiary.json snapshot.')}
  ${row('Import from Day One', `<button class="btn" data-action="import-dayone">Choose Day One export (.zip / .json)</button>`, 'Day One → Export → JSON. Journals, photos, tags, locations, weather, stars are preserved.')}
  ${row('Import htmldiary backup', `<button class="btn" data-action="import-htmldiary">Choose backup (.zip / .json)</button>`, 'Entries with ids that already exist are skipped.')}
  ${row('Reload from disk', `<button class="btn" data-action="reload">Rescan data folder</button>`, 'Use after editing Markdown files by hand. Changes are also picked up automatically every few seconds.')}
  <h2>About</h2>
  <p class="lead">htmldiary · a local, file-first journal in the spirit of Day One. Entries are Markdown with front matter under <code>entries/</code>; media under <code>media/</code>; deleted entries under <code>trash/</code>. Shortcuts: <span class="kbd">?</span></p>
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
    det.addEventListener('dragover', ev => { ev.preventDefault(); if (!$('.drop-hint', det)) det.insertAdjacentHTML('beforeend', '<div class="drop-hint">Drop to attach</div>'); });
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
  if (s.theme === 'light' || s.theme === 'dark') root.dataset.theme = s.theme; else delete root.dataset.theme;
  root.style.setProperty('--content-font', s.contentFont === 'serif' ? 'var(--serif-font)' : s.contentFont === 'mono' ? 'var(--mono-font)' : 'var(--ui-font)');
  root.style.setProperty('--content-size', (s.fontSize || 17) + 'px');
}

// ============================================================================ entry editing
function currentEntry() { return state.route.e ? E(state.route.e) : null; }
function onEditorInput(ed) {
  const e = currentEntry(); if (!e) return;
  e.text = ed.value; e.photos = photosFromText(e.text);
  autoGrow(ed);
  const st = $('#status'); if (st) { st.textContent = `${wordCount(e.text)} words · saving…`; st.classList.add('saving'); }
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
    const st = $('#status'); if (st && state.route.e === e.id) { st.textContent = `${wordCount(e.text)} words · saved`; st.classList.remove('saving'); }
  } catch (err) { toast('Save failed: ' + err.message, 4000); }
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
  toast('Moved to Trash');
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
      toast(`Uploading ${f.name}…`, 1200);
      const r = await fetch('/api/media', { method: 'POST', headers: { 'X-Filename': encodeURIComponent(f.name || 'paste.png'), 'Content-Type': f.type || 'application/octet-stream' }, body: f });
      const data = await r.json(); if (!r.ok) throw new Error(data.error);
      const md = `![](${data.url})\n`;
      if (ed) insertAtCursor(ed, md); else { e.text = (e.text.trimEnd() + '\n\n' + md); e.photos = photosFromText(e.text); await saveNow(e); renderDetailOnly(); renderListOnly(); }
    } catch (err) { toast('Upload failed: ' + err.message, 4000); }
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
  const html = items.map(it => it === '-' ? '<div class="sep"></div>' : it.header ? `<div class="ph">${esc(it.header)}</div>` : `<button class="mi ${it.danger ? 'danger' : ''} ${it.on ? 'on' : ''}" data-action="mi" data-i="${items.indexOf(it)}">${it.dot ? `<span class="sb-dot" style="background:${attr(it.dot)}"></span>` : ''}${it.icon ? `<span>${it.icon}</span>` : ''}<span>${esc(it.label)}</span>${it.kbd ? `<small>${it.kbd}</small>` : ''}</button>`).join('');
  const pop = showPop(anchor, html);
  pop.addEventListener('click', ev => { const b = ev.target.closest('[data-action="mi"]'); if (!b) return; const it = items[+b.dataset.i]; closePop(); it.run && it.run(); });
}
function modal(html, onMount) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-backdrop" data-action="modal-close-bg"><div class="modal">${html}</div></div>`;
  onMount && onMount($('.modal', root));
  return () => { root.innerHTML = ''; };
}
function confirmModal(title, text, okLabel = 'Delete', danger = true) {
  return new Promise(res => {
    const close = modal(`<h3>${esc(title)}</h3><p>${esc(text)}</p><div class="actions"><button class="btn" data-x="0">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-x="1">${esc(okLabel)}</button></div>`, m => {
      m.addEventListener('click', ev => { const b = ev.target.closest('[data-x]'); if (!b) return; close(); res(b.dataset.x === '1'); });
      $('[data-x="1"]', m).focus();
    });
  });
}
function promptModal(title, text, { value = '', placeholder = '', type = 'text', okLabel = 'OK' } = {}) {
  return new Promise(res => {
    const close = modal(`<h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}<input type="${type}" value="${attr(value)}" placeholder="${attr(placeholder)}" style="max-width:none"><div class="actions"><button class="btn" data-x="0">Cancel</button><button class="btn primary" data-x="1">${esc(okLabel)}</button></div>`, m => {
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
  const pop = showPop(anchor, `<div class="ph">Entry date & time</div><div class="pad"><input type="datetime-local" value="${attr(v)}" id="dt" step="60"></div><button class="mi" data-x="now">🕒 Set to now</button><div class="pad"><button class="btn primary small" data-x="ok" style="width:100%;justify-content:center">Apply</button></div>`);
  const apply = () => { const dt = $('#dt', pop).value; if (!dt) return; const d = new Date(dt); if (Number.isNaN(+d)) return; closePop(); patchEntry(e, { created: toIso(d) }); };
  pop.addEventListener('click', ev => { const b = ev.target.closest('[data-x]'); if (!b) return; if (b.dataset.x === 'now') { closePop(); patchEntry(e, { created: nowIso() }); } else apply(); });
  $('#dt', pop).addEventListener('keydown', ev => { if (ev.key === 'Enter') apply(); });
}
function journalMenu(anchor) {
  const e = currentEntry(); if (!e) return;
  menu(anchor, [{ header: 'Move to journal' }, ...state.data.journals.map(j => ({ label: j.name, dot: j.color, on: j.id === e.journal, run: () => patchEntry(e, { journal: j.id }) }))]);
}
function entryMenu(anchor) {
  const e = currentEntry(); if (!e) return;
  menu(anchor, [
    { label: state.editing ? 'Done editing' : 'Edit', icon: '✏️', kbd: `${MOD}+E`, run: () => toggleEdit() },
    { label: e.starred ? 'Remove from favorites' : 'Add to favorites', icon: '★', run: () => patchEntry(e, { starred: !e.starred }) },
    { label: e.pinned ? 'Unpin' : 'Pin to top', icon: '📌', run: () => patchEntry(e, { pinned: !e.pinned }) },
    { label: 'Change date…', icon: '📅', run: () => dateMenu(anchor) },
    { label: 'Move to journal…', icon: '📓', run: () => journalMenu(anchor) },
    '-',
    { label: 'Duplicate', icon: '⧉', run: async () => { const c = await api('POST', '/api/entries', { ...e, id: undefined, created: nowIso() }); state.data.entries.unshift(c); go({ e: c.id }); toast('Duplicated'); } },
    { label: 'Copy as Markdown', icon: '📋', run: () => { navigator.clipboard.writeText(e.text).then(() => toast('Copied')); } },
    { label: 'Export entry (.md)', icon: '⬇', run: () => downloadText(`${dayOf(e)}-${(titleOf(e) || 'entry').replace(/[^\w一-鿿-]+/g, '_').slice(0, 40)}.md`, `# ${titleOf(e) || 'Entry'}\n\n_${fmtLong(e.created)} ${fmtTime(e.created)}${e.location?.name ? ' · ' + e.location.name : ''}_\n\n${e.text}`) },
    { label: 'Open file location', icon: '📁', run: () => toast(`${state.data.dataDir}/entries/${e.journal}/${e.created.slice(0, 4)}/`, 5000) },
    '-',
    { label: 'Move to Trash', icon: '🗑', danger: true, kbd: `${MOD}+⌫`, run: () => deleteEntry(e.id) },
  ]);
}
function downloadText(name, text) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }

function locMenu(anchor) {
  const e = currentEntry(); if (!e) return;
  const pop = showPop(anchor, `<div class="ph">Location</div><div class="pad"><input type="search" id="loc-q" placeholder="Search a place…" autocomplete="off"></div><div id="loc-res"></div>
    <button class="mi" data-x="here">${SVG.loc.replace('<svg', '<svg style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2"')} Use current location</button>
    ${e.location ? `<button class="mi" data-x="edit">✏️ Edit name…</button><button class="mi danger" data-x="clear">Remove location</button>` : ''}`, { width: 320 });
  const q = $('#loc-q', pop); q.focus();
  q.addEventListener('input', debounce(async () => {
    const res = $('#loc-res', pop); if (!q.value.trim()) { res.innerHTML = ''; return; }
    res.innerHTML = '<div class="pad"><span class="spin"></span></div>';
    try { const list = await api('GET', `/api/geo/search?q=${encodeURIComponent(q.value.trim())}`); res.innerHTML = list.length ? list.map((l, i) => `<div class="res" data-r="${i}">${esc(l.name)}<small>${esc(l.address || l.display)}</small></div>`).join('') : '<div class="pad" style="color:var(--fg-3)">No results</div>'; res._list = list; }
    catch (err) { res.innerHTML = `<div class="pad" style="color:var(--danger)">${esc(err.message)}</div>`; }
  }, 350));
  q.addEventListener('keydown', ev => { if (ev.key === 'Enter' && q.value.trim()) { closePop(); setLocation(e, { name: q.value.trim(), address: '' }); } });
  pop.addEventListener('click', async ev => {
    const r = ev.target.closest('[data-r]'); if (r) { const l = $('#loc-res', pop)._list[+r.dataset.r]; closePop(); return setLocation(e, { name: l.name, address: l.address, lat: l.lat, lon: l.lon }); }
    const b = ev.target.closest('[data-x]'); if (!b) return;
    if (b.dataset.x === 'clear') { closePop(); patchEntry(e, { location: null }); }
    else if (b.dataset.x === 'edit') { closePop(); const n = await promptModal('Location name', '', { value: e.location.name || '' }); if (n != null) patchEntry(e, { location: { ...e.location, name: n } }); }
    else if (b.dataset.x === 'here') {
      closePop(); toast('Locating…');
      if (!navigator.geolocation) return toast('Geolocation unavailable in this browser', 4000);
      navigator.geolocation.getCurrentPosition(async pos => {
        const { latitude: lat, longitude: lon } = pos.coords;
        try { const g = await api('GET', `/api/geo/reverse?lat=${lat}&lon=${lon}`); await setLocation(e, { name: g.name, address: g.address, lat, lon }); }
        catch (_) { await setLocation(e, { name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, address: '', lat, lon }); }
      }, err => toast('Could not get location: ' + err.message + (location.protocol === 'http:' && location.hostname !== 'localhost' ? ' (browsers only allow geolocation on localhost or https)' : ''), 6000), { timeout: 15000 });
    }
  });
}
async function setLocation(e, loc) {
  await patchEntry(e, { location: loc });
  if (!e.weather && typeof loc.lat === 'number') fetchWeather(e, true);
}
async function fetchWeather(e, quiet = false) {
  if (!e.location || typeof e.location.lat !== 'number') { if (!quiet) toast('Add a location with coordinates first'); return; }
  try {
    const wx = await api('GET', `/api/weather?lat=${e.location.lat}&lon=${e.location.lon}&when=${encodeURIComponent(e.created)}`);
    if (wx && wx.temp != null) await patchEntry(e, { weather: wx }); else if (!quiet) toast('No weather data for that time');
  } catch (err) { if (!quiet) toast(err.message, 4000); }
}
function wxMenu(anchor) {
  const e = currentEntry(); if (!e) return;
  menu(anchor, [{ label: 'Refresh weather', icon: '🔄', run: () => fetchWeather(e) }, { label: 'Remove weather', icon: '✕', danger: true, run: () => patchEntry(e, { weather: null }) }]);
}
function tagAdd(anchor) {
  const e = currentEntry(); if (!e) return;
  const all = tagCounts().map(x => x[0]).filter(t => !e.tags.includes(t));
  const pop = showPop(anchor, `<div class="ph">Add tag</div><div class="pad"><input type="text" id="tag-q" placeholder="Tag name, Enter to add" autocomplete="off" list="tag-dl"><datalist id="tag-dl">${all.map(t => `<option value="${attr(t)}">`).join('')}</datalist></div><div id="tag-res">${all.slice(0, 12).map(t => `<button class="mi" data-t="${attr(t)}">#${esc(t)}</button>`).join('')}</div>`, { width: 260 });
  const q = $('#tag-q', pop); q.focus();
  const add = t => { t = t.trim().replace(/^#/, ''); if (!t) return; closePop(); patchEntry(e, { tags: [...new Set([...e.tags, t])] }); };
  q.addEventListener('keydown', ev => { if (ev.key === 'Enter') add(q.value); });
  q.addEventListener('input', () => { const v = q.value.toLowerCase(); $('#tag-res', pop).innerHTML = all.filter(t => t.toLowerCase().includes(v)).slice(0, 12).map(t => `<button class="mi" data-t="${attr(t)}">#${esc(t)}</button>`).join(''); });
  pop.addEventListener('click', ev => { const b = ev.target.closest('[data-t]'); if (b) add(b.dataset.t); });
}
function templateMenu(anchor, forNew = false) {
  const ts = state.data.templates;
  menu(anchor, [{ header: forNew ? 'New entry from template' : 'Insert template' }, ...ts.map(t => ({ label: t.name, icon: t.icon || '📝', run: async () => {
    if (forNew) { await newEntry({ text: t.body, template: t.name }); return; }
    const ed = $('#editor'); const e = currentEntry(); if (!ed || !e) return;
    if (!ed.value.trim()) { ed.value = t.body; e.template = t.name; ed.setSelectionRange(ed.value.length, ed.value.length); ed.focus(); ed.dispatchEvent(new Event('input')); }
    else insertAtCursor(ed, '\n' + t.body);
  } })), '-', { label: 'Manage templates…', icon: '⚙', run: () => go({ view: 'settings' }) }]);
}
function filterMenu(anchor) {
  const f = state.filters; const years = [...new Set(state.data.entries.map(e => e.created.slice(0, 4)))].sort().reverse();
  menu(anchor, [
    { header: 'Filter' },
    { label: 'Favorites only', icon: '★', on: f.starred, run: () => { f.starred = !f.starred; renderListOnly(); } },
    { label: 'With media only', icon: '🖼', on: f.photos, run: () => { f.photos = !f.photos; renderListOnly(); } },
    ...(years.length > 1 ? [{ header: 'Year' }, { label: 'All years', on: !f.year, run: () => { f.year = null; renderListOnly(); } }, ...years.map(y => ({ label: y, on: f.year === y, run: () => { f.year = y; renderListOnly(); } }))] : []),
    '-', { header: 'Sort' },
    { label: 'Newest first', on: S().sortOrder !== 'oldest', run: () => setSetting('sortOrder', 'newest') },
    { label: 'Oldest first', on: S().sortOrder === 'oldest', run: () => setSetting('sortOrder', 'oldest') },
  ]);
}
function listMenu(anchor) {
  menu(anchor, [
    { label: 'New entry', icon: '＋', kbd: `${MOD}+N`, run: () => newEntry() },
    { label: 'New from template…', icon: '📝', run: () => templateMenu(anchor, true) },
    { label: "Answer today's prompt", icon: '💡', run: () => answerPrompt() },
    '-',
    { label: 'Rescan data folder', icon: '🔄', run: reloadAll },
    { label: 'Export everything (.zip)', icon: '⬇', run: () => { location.href = '/api/export.zip'; } },
  ]);
}
async function answerPrompt(i) {
  const ps = state.data.prompts; if (!ps.length) return toast('No prompts configured');
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
  const js = rows.map(r => ({ id: r.dataset.jid, name: $('[data-jf="name"]', r).value.trim() || 'Journal', color: $('[data-jf="color"]', r).value, description: $('[data-jf="description"]', r).value.trim() }));
  try { state.data.journals = await api('PUT', '/api/journals', js); toast('Journals saved'); render(); } catch (err) { toast(err.message, 4000); }
}
async function newJournal() {
  const name = await promptModal('New journal', 'Give it a name. You can pick a colour in Settings.', { placeholder: 'e.g. Travel', okLabel: 'Create' });
  if (!name || !name.trim()) return;
  const palette = ['#2d7ff9', '#30a46c', '#f76b15', '#8e4ec6', '#e5484d', '#12a594', '#f5b300', '#e93d82', '#ad7f58', '#5b5bd6'];
  let id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'journal'; const base = id; let k = 2; while (J(id)) id = `${base}-${k++}`;
  const js = [...state.data.journals, { id, name: name.trim(), color: palette[state.data.journals.length % palette.length], description: '' }];
  try { state.data.journals = await api('PUT', '/api/journals', js); go({ view: 'timeline', j: id, e: null, t: null }); render(); toast(`Journal “${name.trim()}” created`); } catch (err) { toast(err.message, 4000); }
}
async function deleteJournal(id) {
  const j = J(id); if (!j) return;
  const n = state.data.entries.filter(e => e.journal === id).length;
  const others = state.data.journals.filter(x => x.id !== id);
  const close = modal(`<h3>Delete “${esc(j.name)}”?</h3><p>${n ? `It has ${n} entries. Move them to another journal, or send them to the Trash.` : 'It has no entries.'}</p>
    ${n ? `<select id="mv" style="width:100%;max-width:none">${others.map(o => `<option value="${attr(o.id)}">Move entries to ${esc(o.name)}</option>`).join('')}<option value="__trash">Move entries to Trash</option></select>` : ''}
    <div class="actions"><button class="btn" data-x="0">Cancel</button><button class="btn danger" data-x="1">Delete journal</button></div>`, m => {
    m.addEventListener('click', async ev => {
      const b = ev.target.closest('[data-x]'); if (!b) return; const mv = $('#mv', m)?.value; close(); if (b.dataset.x !== '1') return;
      const q = mv === '__trash' ? '?deleteEntries=1' : mv ? `?moveTo=${encodeURIComponent(mv)}` : '';
      try { state.data.journals = await api('PUT', '/api/journals' + q, others); if (S().defaultJournal === id) await api('PUT', '/api/settings', { defaultJournal: others[0].id }); await reloadAll(false); toast('Journal deleted'); } catch (err) { toast(err.message, 4000); }
    });
  });
}
async function saveTemplatesFromForm() {
  const rows = $$('#template-rows .t-row');
  const ts = rows.map((r, i) => ({ id: state.data.templates[i]?.id || uid(), icon: $('[data-tf="icon"]', r).value.trim(), name: $('[data-tf="name"]', r).value.trim() || 'Template', body: $('[data-tf="body"]', r).value }));
  try { state.data.templates = await api('PUT', '/api/templates', ts); toast('Templates saved'); render(); } catch (err) { toast(err.message, 4000); }
}
async function savePromptsFromForm() {
  const ps = $('#prompts-text').value.split('\n').map(s => s.trim()).filter(Boolean);
  try { state.data.prompts = await api('PUT', '/api/prompts', ps); toast('Prompts saved'); } catch (err) { toast(err.message, 4000); }
}
async function setPasscode() {
  const a = await promptModal('Set passcode', 'Choose a passcode. It only guards this page; files on disk stay readable.', { type: 'password', okLabel: 'Next' }); if (!a) return;
  const b = await promptModal('Confirm passcode', '', { type: 'password', okLabel: 'Save' }); if (b == null) return;
  if (a !== b) return toast('Passcodes did not match');
  await setSetting('passcodeHash', sha256(a)); toast('Passcode set');
}
async function importFile(kind, file) {
  toast(`Importing ${file.name}…`, 3000);
  try {
    const r = await fetch(`/api/import/${kind}?name=${encodeURIComponent(file.name.replace(/\.[^.]+$/, ''))}`, { method: 'POST', body: file });
    const data = await r.json(); if (!r.ok) throw new Error(data.error);
    await reloadAll(false);
    toast(kind === 'dayone' ? `Imported ${data.entries} entries, ${data.media} media, ${data.journals} new journals${data.skipped ? ` (${data.skipped} skipped as duplicates)` : ''}` : `Imported ${data.entries} entries`, 6000);
  } catch (err) { toast('Import failed: ' + err.message, 6000); }
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
  lk.innerHTML = `<div class="lk"><div class="ico">🔒</div><h3>htmldiary is locked</h3><input type="password" id="pc" placeholder="••••" autofocus><div class="err" id="pc-err"></div></div>`;
  const inp = $('#pc', lk); inp.focus();
  inp.addEventListener('keydown', ev => { if (ev.key !== 'Enter') return; if (sha256(inp.value) === S().passcodeHash) { lk.hidden = true; lk.innerHTML = ''; state.locked = false; state.lastActivity = Date.now(); } else { $('#pc-err').textContent = 'Wrong passcode'; inp.value = ''; } });
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
    if ('Notification' in window && Notification.permission === 'granted') { const nn = new Notification('htmldiary', { body: 'Time to write today’s entry ✍️' }); nn.onclick = () => { window.focus(); newEntry(); }; }
    else toast('Time to write today’s entry ✍️', 8000);
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
  'trash-purge': async el => { if (!await confirmModal('Delete forever?', 'This entry will be permanently removed from disk.')) return; await api('DELETE', `/api/trash/${el.dataset.id}`); state.data.trash = state.data.trash.filter(x => x.id !== el.dataset.id); go({ e: null }); render(); },
  'trash-empty': async () => { if (!state.data.trash.length) return; if (!await confirmModal('Empty Trash?', `${state.data.trash.length} entries will be permanently removed.`, 'Empty Trash')) return; await api('DELETE', '/api/trash'); state.data.trash = []; go({ e: null }); render(); },
  set(el) { let v = el.dataset.v; if (el.dataset.bool) v = !!v; else if (/^\d+$/.test(v)) v = +v; setSetting(el.dataset.k, v); },
  'journal-new'() { newJournal(); }, 'journal-delete'(el) { deleteJournal(el.dataset.id); }, 'journals-save'() { saveJournalsFromForm(); },
  'template-new'() { state.data.templates.push({ id: uid(), name: 'New template', icon: '📝', body: '# Title\n\n' }); render(); window.scrollTo(0, 0); $('#template-rows .t-row:last-child input[data-tf="name"]')?.focus(); },
  'template-delete'(el) { state.data.templates.splice(+el.dataset.i, 1); render(); },
  'templates-save'() { saveTemplatesFromForm(); }, 'prompts-save'() { savePromptsFromForm(); },
  'prompt-answer'(el) { answerPrompt(+el.dataset.i); },
  'passcode-set'() { setPasscode(); }, 'passcode-clear'() { setSetting('passcodeHash', ''); toast('Passcode removed'); },
  'import-dayone'() { $('#file-import-dayone').click(); }, 'import-htmldiary'() { $('#file-import-htmldiary').click(); },
  reload() { reloadAll().then(() => toast('Rescanned')); },
  help() { modal(`<h3>Keyboard shortcuts</h3><div class="sc">
    <span>New entry</span><span><span class="kbd">${MOD}</span> <span class="kbd">N</span></span>
    <span>Edit / Done</span><span><span class="kbd">${MOD}</span> <span class="kbd">E</span></span>
    <span>Search</span><span><span class="kbd">${MOD}</span> <span class="kbd">F</span> or <span class="kbd">/</span></span>
    <span>Save now</span><span><span class="kbd">${MOD}</span> <span class="kbd">S</span></span>
    <span>Bold / Italic (in editor)</span><span><span class="kbd">${MOD}</span> <span class="kbd">B</span> / <span class="kbd">I</span></span>
    <span>Next / previous entry</span><span><span class="kbd">J</span> / <span class="kbd">K</span></span>
    <span>Favorite</span><span><span class="kbd">S</span></span>
    <span>Move to Trash</span><span><span class="kbd">${MOD}</span> <span class="kbd">⌫</span></span>
    <span>Leave editor / close</span><span><span class="kbd">Esc</span></span>
    <span>Views</span><span><span class="kbd">1</span>–<span class="kbd">6</span> timeline · calendar · media · map · on this day · stats</span>
    <span>This help</span><span><span class="kbd">?</span></span></div>
    <div class="actions"><button class="btn primary" data-action="modal-close">Close</button></div>`); },
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
  if (mod && ev.key.toLowerCase() === 's') { ev.preventDefault(); flushSaves().then(() => toast('Saved')); return; }
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
