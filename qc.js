/* AGA monthly report engine — shared by elite.html, baxter.html, vantive.html
   Backend: Supabase lad_sites / lad_reports via lad_* (staff) and lad_c_* (client link) RPCs — separate from the pr_* tables of other reports */
"use strict";
const SITE = window.SITE;
const DEF = QC_SITES[SITE];
const EN = DEF.lang === 'en';
const SB = 'https://zhdigumxkjfvrkkmqqpk.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoZGlndW14a2pmdnJra21xcXBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMjI2NjcsImV4cCI6MjA5Nzc5ODY2N30.NJpFFXX_KYGgICo3WNaevMxjXc0EB9X7rOzOhWXiIK0';
const BUCKET = 'pest-reports';
const TH_M = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const TH_S = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const EN_M = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const EN_S = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SP_COL = ['#5b9bd5', '#ed7d31', '#a5a5a5', '#ffc000'];
const PIE_COL = ['#5b9bd5', '#ed7d31', '#a5a5a5', '#ffc000', '#4472c4', '#70ad47', '#264478', '#9e480e'];
const FONT = EN ? "'Times New Roman',Times,serif" : "'Sarabun',sans-serif";

/* ───────── helpers ───────── */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nl = s => esc(s).replace(/\n/g, '<br>');
const pad = n => String(n).padStart(2, '0');
const mk = (y, m) => y + '-' + pad(m);
const clone = o => JSON.parse(JSON.stringify(o));
const sum = a => (a || []).reduce((t, v) => t + (+v || 0), 0);
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('on'), 2400); }
function setStatus(t) { $('#status').textContent = t; }
function deepMerge(a, b) {
  for (const k of Object.keys(b || {})) {
    const v = b[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) deepMerge(a[k], v);
    else a[k] = v;
  }
  return a;
}
function addMonths(k, d) { let [y, m] = k.split('-').map(Number); m += d; while (m > 12) { m -= 12; y++ } while (m < 1) { m += 12; y-- } return mk(y, m); }
const mName = k => { const [y, m] = k.split('-').map(Number); return EN ? EN_M[m - 1] + ' ' + y : TH_M[m - 1] + ' ' + (y + 543); };
const mShort = k => { const [y, m] = k.split('-').map(Number); return EN ? EN_S[m - 1] : TH_S[m - 1] + '-' + String(y + 543).slice(-2); };
function dTH(iso, short) { if (!iso) return '…… / …… / ……'; const [y, m, d] = iso.split('-'); const by = +y + 543; return pad(+d) + ' / ' + pad(+m) + ' / ' + (short ? String(by).slice(-2) : by); }
function dEN(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-').map(Number); return d + ' ' + EN_M[m - 1] + ' ' + y; }

/* ───────── backend ───────── */
let cfg = clone(DEF);
let Y, M;                   // Gregorian year / month currently selected
const reports = {};         // 'YYYY-MM' -> report data
let KEY = null, ROLE = 'staff', STATUS = {};
const isClient = () => ROLE === 'client';
async function rpc(fn, args) {
  const r = await fetch(SB + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}) });
  const t = await r.text(); if (!r.ok) { let m = t; try { m = JSON.parse(t).message } catch (e) { } throw new Error(m); } return t ? JSON.parse(t) : null;
}
async function loadCfg() {
  let c = null;
  if (isClient()) c = (await rpc('lad_c_bootstrap', { k: KEY })).config;
  else c = (await rpc('lad_bootstrap', { p_site: SITE })).config;
  cfg = deepMerge(clone(DEF), c || {});
}
async function loadReports() {
  const a = '2025-01', b = '2029-12';
  const o = (isClient() ? await rpc('lad_c_year', { k: KEY, p_from: a, p_to: b }) : await rpc('lad_year', { p_site: SITE, p_from: a, p_to: b })) || {};
  Object.keys(reports).forEach(k => delete reports[k]);
  Object.entries(o).forEach(([k, v]) => reports[k] = v);
}
async function loadStatus() {
  STATUS = {};
  try { const l = (isClient() ? await rpc('lad_c_list', { k: KEY }) : await rpc('lad_list', { p_site: SITE })) || []; l.forEach(x => STATUS[x.month] = x); } catch (e) { }
  renderSendBox(); labelMonths();
}
async function saveCfg() { const c = clone(cfg); await rpc('lad_save_config', { p_site: SITE, p_config: c }); }
let saveTimer = null, saving = false; const pending = new Set();
function markDirty() {
  if (isClient()) return; const k = mk(Y, M); pending.add(k); if (reports[k]) delete reports[k]._new;
  setStatus('ยังไม่บันทึก…'); clearTimeout(saveTimer); saveTimer = setTimeout(flush, 900);
}
async function flush() {
  if (saving) { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 600); return; }
  saving = true;
  try {
    for (const k of [...pending]) {
      pending.delete(k); const r = clone(reports[k]); delete r._new; r.updatedAt = new Date().toISOString();
      try { await rpc('lad_save_report', { p_site: SITE, p_month: k, p_data: r, p_send: false }); }
      catch (e) { pending.add(k); setStatus('บันทึกไม่สำเร็จ จะลองใหม่'); saveTimer = setTimeout(flush, 4000); return; }
    }
    setStatus('บันทึกแล้ว ✓'); loadStatusQuiet();
  } finally { saving = false; }
}
let lsT = null; function loadStatusQuiet() { clearTimeout(lsT); lsT = setTimeout(loadStatus, 1500); }
async function uploadImg(blob) {
  const path = SITE + '/' + new Date().toISOString().slice(0, 7) + '/' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2)) + '.jpg';
  const r = await fetch(SB + '/storage/v1/object/' + BUCKET + '/' + path, { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'image/jpeg' }, body: blob });
  if (!r.ok) throw new Error('อัปโหลดไม่สำเร็จ (' + r.status + ')'); return path;
}
const mem = {};
const imgURL = id => !id ? '' : id.startsWith('up:') ? (mem[id] || '') : /^(data:|blob:|img\/|https?:)/.test(id) ? id : SB + '/storage/v1/object/public/' + BUCKET + '/' + id;
async function shrink(file, max = 1600, q = .84) {
  let bmp; try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }) } catch (e) { bmp = await createImageBitmap(file) }
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height)); const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise(res => c.toBlob(res, 'image/jpeg', q));
}
function pickFiles(multiple, accept = 'image/*') { return new Promise(res => { const fi = $('#fileIn'); fi.value = ''; fi.multiple = multiple; fi.accept = accept; fi.onchange = () => res([...fi.files]); fi.click(); }); }

/* ───────── report model ───────── */
const has = k => !!cfg[k];
function prevReport(k) { const ks = Object.keys(reports).filter(x => x < k && !reports[x]._new).sort(); return ks.length ? reports[ks[ks.length - 1]] : null; }
function blank(k) {
  const p = prevReport(k);
  const r = { svcDate: '', svcTime: (p && p.svcTime) || cfg.svcTime || '', techs: [...((p && p.techs) || cfg.techs || [])],
    notes: Object.assign({}, cfg.notes || {}, (p && p.notes) || {}), sum: {}, problems: [] };
  if (p && p.sum && p.sum.levelNote) r.sum.levelNote = '';
  if (has('ilt') && p && Array.isArray(p.ilt)) r.ilt = cfg.ilt.st.map((_, i) => ({ on: p.ilt[i] ? p.ilt[i].on !== false : true, sp: [0, 0, 0, 0], chk: p.ilt[i] && p.ilt[i].chk ? [...p.ilt[i].chk] : undefined, note: '' }));
  return r;
}
function normalize(r) {
  if (has('bait')) r.bait = cfg.bait.st.map((_, i) => { const x = (r.bait || [])[i] || {}; return { n: Math.max(0, Math.min(cfg.bait.cap || 99, Math.round(+x.n || 0))), rem: x.rem || '' } });
  if (has('glue')) r.glue = cfg.glue.st.map((_, i) => { const x = (r.glue || [])[i] || {}; return { n: Math.max(0, Math.round(+x.n || 0)), rem: x.rem || '' } });
  if (has('ilt')) { const nc = (cfg.ilt.checks || []).length; r.ilt = cfg.ilt.st.map((_, i) => { const x = (r.ilt || [])[i] || {}; return { on: x.on !== false, sp: [0, 1, 2, 3].map(j => Math.max(0, Math.round(+(x.sp || [])[j] || 0))), chk: Array.from({ length: nc }, (_, j) => x.chk ? x.chk[j] !== false : true), note: x.note || '' } }); }
  if (has('cr')) r.cr = cfg.cr.st.map((_, i) => Math.max(0, Math.round(+(r.cr || [])[i] || 0)));
  r.notes = r.notes || {}; r.sum = r.sum || {}; r.problems = Array.isArray(r.problems) ? r.problems : [];
  r.techs = Array.isArray(r.techs) ? r.techs : [...(cfg.techs || [])];
  return r;
}
function cur() { const k = mk(Y, M); if (!reports[k]) { reports[k] = blank(k); reports[k]._new = true; } return normalize(reports[k]); }
const curKey = () => mk(Y, M);
function dataOf(k) { if (k === curKey()) return cur(); const r = reports[k]; return r && !r._new ? normalize(r) : null; }
const H = k => (cfg.hist || {})[k] || null;
function upTo(k) { return k <= curKey(); }
function baitTot(k) { if (!upTo(k)) return null; const d = dataOf(k); if (d) return sum(d.bait.map(x => x.n)); const h = H(k); return h && h.bait != null ? h.bait : null; }
function glueTot(k) { if (!upTo(k)) return null; const d = dataOf(k); if (d) return sum(d.glue.map(x => x.n)); const h = H(k); return h && h.glue != null ? h.glue : null; }
function iltSp(k, i) { if (!upTo(k)) return null; const d = dataOf(k); if (d) return d.ilt[i].on ? d.ilt[i].sp : null; const h = H(k); return h && h.iltSp ? h.iltSp[i] || null : null; }
function iltSt(k, i) { if (!upTo(k)) return null; const d = dataOf(k); if (d) return d.ilt[i].on ? sum(d.ilt[i].sp) : null; const h = H(k); if (!h) return null; if (h.iltSt) return h.iltSt[i] ?? null; if (h.iltSp) return h.iltSp[i] ? sum(h.iltSp[i]) : null; return null; }
function iltTot(k) { if (!upTo(k)) return null; const d = dataOf(k); if (d) return sum(d.ilt.map(x => x.on ? sum(x.sp) : 0)); const h = H(k); if (!h) return null; if (h.iltTot != null) return h.iltTot; if (h.ilt != null) return h.ilt; if (h.iltSt) return sum(h.iltSt); if (h.iltSp) return sum(h.iltSp.map(sum)); return null; }
function crStarted(k, i) { const s = (cfg.cr.start || {})[i]; return !s || k >= s; }
function crSt(k, i) { if (!crStarted(k, i)) return '-'; if (!upTo(k)) return null; const d = dataOf(k); if (d) return d.cr[i]; const h = H(k); if (h && h.cr) return h.cr[i] == null ? '-' : h.cr[i]; return null; }
function yearKeys() { const ys = cfg.yearStart || 1; const fy = M >= ys ? Y : Y - 1; return Array.from({ length: 12 }, (_, i) => addMonths(mk(fy, ys), i)); }
function iltLimit(i) { return { a: (cfg.ilt.alert || [])[i], b: (cfg.ilt.action || [])[i] }; }

/* auto texts */
function joinEN(a) { return a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
function autoTypes(r) {
  const tot = [0, 1, 2, 3].map(j => sum(r.ilt.map(x => x.on ? x.sp[j] : 0)));
  const names = (cfg.ilt.spShort || cfg.ilt.sp);
  const idx = [0, 1, 2, 3].filter(j => tot[j] > 0).sort((a, b) => tot[b] - tot[a]);
  return idx.length ? joinEN(idx.map(j => names[j])) : 'Not found';
}
function autoPositions(r) {
  const out = []; r.ilt.forEach((x, i) => { if (!x.on) return; const t = sum(x.sp); const L = iltLimit(i); if (L.a != null && t >= L.a) out.push(cfg.ilt.st[i]); });
  return out.length ? joinEN(out) : 'Not found';
}
function autoTopStations(r) {
  const t = r.ilt.map((x, i) => ({ i, t: x.on ? sum(x.sp) : 0 })).filter(o => o.t > 0).sort((a, b) => b.t - a.t);
  if (!t.length) return { pos: 'Not found insects in light traps', sp: '' };
  const top = t.filter(o => o.t >= t[Math.min(1, t.length - 1)].t).slice(0, 3);
  const sp = [0, 1, 2, 3].map(j => ({ j, v: sum(top.map(o => r.ilt[o.i].sp[j])) })).filter(o => o.v > 0).sort((a, b) => b.v - a.v).map(o => (cfg.ilt.spShort || cfg.ilt.sp)[o.j]);
  return { pos: 'The most of position found insects catcher in light trap ' + joinEN(top.map(o => 'No. ' + (o.i + 1))), sp: joinEN(sp) };
}
function autoLevel(r) {
  let a = false, b = false;
  if (cfg.ilt.siteAlert != null) { const t = iltTot(curKey()); a = t >= cfg.ilt.siteAlert; b = t >= cfg.ilt.siteAction; }
  else r.ilt.forEach((x, i) => { const t = x.on ? sum(x.sp) : 0; const L = iltLimit(i); if (L.a != null && t >= L.a) a = true; if (L.b != null && t >= L.b) b = true; });
  if (SITE === 'baxter') return b ? 'High levels' : a ? 'Medium levels' : 'Low levels';
  return b ? 'High risk level (Action limit)' : a ? 'Medium risk level (Alert limit)' : 'Low risk level';
}
function autoCrText(r) {
  const hit = r.cr.map((v, i) => ({ v, i })).filter(o => o.v > 0);
  if (!hit.length) return '***Not found cockroach and other pests within the Trap.***';
  return `***Found ${sum(hit.map(o => o.v))} cockroach/crawling insect(s) at Station ${joinEN(hit.map(o => 'No.' + (o.i + 1)))}.***`;
}
const sv = (r, k, auto) => (r.sum[k] && String(r.sum[k]).trim()) ? r.sum[k] : auto;

/* ───────── charts (canvas → PNG) ───────── */
function niceMax(v) { if (v <= 1) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); for (const f of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (f * p >= v) return f * p; return 10 * p; }
function niceStep(max) { for (const n of [5, 4, 6, 8, 10]) { const s = max / n; if (Number.isInteger(s) || max <= 1) return s; } return max / 5; }
function chart(o) {
  /* o: {w,h,title,labels,bars:[{name,color,vals}],lines:[{name,color,vals,width}],yMax,yTitle,legend:'bottom'|'top'|'none',vals:true,font} */
  const S = 2, W = o.w * S, Hh = o.h * S, c = document.createElement('canvas'); c.width = W; c.height = Hh; const g = c.getContext('2d'); g.scale(S, S);
  const F = o.font || FONT; g.fillStyle = '#fff'; g.fillRect(0, 0, o.w, o.h);
  const allV = [...(o.bars || []).flatMap(s => s.vals), ...(o.lines || []).flatMap(s => s.vals)].filter(v => v != null && v !== '-').map(Number);
  const yMax = o.yMax || (Math.max(0, ...allV) <= 0 ? 5 : niceMax(Math.max(1, ...allV) * 1.1)); const step = o.yStep || niceStep(yMax);
  const legH = o.legend === 'none' ? 0 : 22;
  const top = (o.title ? 34 : 14) + (o.legend === 'top' ? legH : 0), bottom = o.h - (o.rotate ? 46 : 28) - (o.legend === 'bottom' || !o.legend ? legH : 0), left = o.yTitle ? 52 : 40, right = o.w - 14;
  if (o.title) { g.fillStyle = '#404040'; g.font = `15px ${F}`; g.textAlign = 'center'; g.fillText(o.title, o.w / 2, 22); }
  if (o.yTitle) { g.save(); g.translate(14, (top + bottom) / 2); g.rotate(-Math.PI / 2); g.font = `11px ${F}`; g.fillStyle = '#404040'; g.textAlign = 'center'; g.fillText(o.yTitle, 0, 0); g.restore(); }
  g.font = `10.5px ${F}`; g.textAlign = 'right'; g.lineWidth = 1;
  for (let v = 0; v <= yMax + 1e-9; v += step) { const y = bottom - (bottom - top) * v / yMax; g.strokeStyle = '#d9d9d9'; g.beginPath(); g.moveTo(left, y); g.lineTo(right, y); g.stroke(); g.fillStyle = '#595959'; g.fillText(Number.isInteger(+step.toFixed(6)) ? String(Math.round(v)) : String(Math.round(v * 10) / 10), left - 5, y + 4); }
  const n = o.labels.length, bw = (right - left) / n;
  g.textAlign = 'center'; g.fillStyle = '#595959'; g.font = `10.5px ${F}`;
  o.labels.forEach((t, i) => { const x = left + bw * (i + .5); if (o.rotate) { g.save(); g.translate(x + 4, bottom + 8); g.rotate(-Math.PI / 4); g.textAlign = 'right'; g.fillText(t, 0, 4); g.restore(); } else g.fillText(t, x, bottom + 15); });
  const bars = o.bars || []; const nb = bars.length; const gw = bw * (nb > 1 ? .75 : .55), w1 = nb ? gw / nb : 0;
  bars.forEach((s, j) => s.vals.forEach((v, i) => {
    if (v == null || v === '-') return; const x = left + bw * i + (bw - gw) / 2 + w1 * j, h = (bottom - top) * Math.min(+v, yMax) / yMax;
    g.fillStyle = s.color; g.fillRect(x, bottom - h, w1 - (nb > 1 ? 1 : 0), h);
    if (o.vals && +v > 0) { g.fillStyle = '#404040'; g.font = `10px ${F}`; g.textAlign = 'center'; g.fillText(String(v), x + w1 / 2, bottom - h - 4); }
  }));
  (o.lines || []).forEach(s => {
    g.strokeStyle = s.color; g.lineWidth = s.width || 2; g.beginPath(); let st = false;
    s.vals.forEach((v, i) => { if (v == null || v === '-') { st = false; return; } const x = left + bw * (i + .5), y = bottom - (bottom - top) * Math.min(+v, yMax) / yMax; st ? g.lineTo(x, y) : g.moveTo(x, y); st = true; });
    g.stroke();
    if (s.endLabel != null) { g.fillStyle = '#000'; g.font = `bold 10px ${F}`; g.textAlign = 'left'; const v = s.vals[s.vals.length - 1]; g.fillText(String(s.endLabel), right - 16, bottom - (bottom - top) * v / yMax - 3); }
  });
  g.strokeStyle = '#bfbfbf'; g.lineWidth = 1; g.beginPath(); g.moveTo(left, bottom); g.lineTo(right, bottom); g.stroke();
  if (o.legend !== 'none') {
    const items = [...bars.map(s => ({ n: s.name, c: s.color, t: 'b' })), ...(o.lines || []).filter(s => s.name).map(s => ({ n: s.name, c: s.color, t: 'l' }))];
    g.font = `10.5px ${F}`; const wid = items.map(it => g.measureText(it.n).width + 26); const tw = wid.reduce((a, b) => a + b, 0);
    let x = (o.w - tw) / 2; const y = o.legend === 'top' ? (o.title ? 38 : 12) : o.h - 12;
    items.forEach((it, i) => { g.fillStyle = it.c; g.strokeStyle = it.c; if (it.t === 'b') g.fillRect(x, y - 7, 8, 8); else { g.lineWidth = 2; g.beginPath(); g.moveTo(x - 4, y - 3); g.lineTo(x + 14, y - 3); g.stroke(); } g.fillStyle = '#595959'; g.textAlign = 'left'; g.fillText(it.n, x + (it.t === 'b' ? 12 : 18), y); x += wid[i]; });
  }
  return c.toDataURL('image/png');
}
function pie(o) {
  const S = 2, c = document.createElement('canvas'); c.width = o.w * S; c.height = o.h * S; const g = c.getContext('2d'); g.scale(S, S);
  g.fillStyle = '#fff'; g.fillRect(0, 0, o.w, o.h); const F = FONT;
  g.fillStyle = '#000'; g.font = `bold 12px ${F}`; g.textAlign = 'center'; g.fillText(o.title, o.w * .62, 26);
  const tot = sum(o.vals); const cx = o.w * .42, cy = o.h * .55, R = Math.min(o.w, o.h) * .3; let a = -Math.PI / 2;
  if (!tot) { g.strokeStyle = '#bbb'; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke(); g.fillStyle = '#777'; g.font = `12px ${F}`; g.fillText('0', cx, cy + 4); }
  o.vals.forEach((v, i) => { if (!tot || !v) return; const b = a + 2 * Math.PI * v / tot; g.fillStyle = PIE_COL[i % PIE_COL.length]; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, a, b); g.closePath(); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke(); a = b; });
  a = -Math.PI / 2; g.font = `11px ${F}`; g.fillStyle = '#404040';
  o.vals.forEach((v, i) => { const b = a + (tot ? 2 * Math.PI * v / tot : 0); const m = (a + b) / 2; g.textAlign = 'center'; g.fillText(String(v), cx + Math.cos(m) * (R + 14), cy + Math.sin(m) * (R + 14) + 4); a = b; });
  o.labels.forEach((t, i) => { const y = 60 + i * 18; g.fillStyle = PIE_COL[i % PIE_COL.length]; g.fillRect(o.w - 70, y - 8, 9, 9); g.fillStyle = '#404040'; g.textAlign = 'left'; g.fillText(t, o.w - 56, y); });
  return c.toDataURL('image/png');
}

/* ───────── report pages ───────── */
const LOGO = 'img/logo.png';
const signImg = () => cfg.sign ? imgURL(cfg.sign) : 'img/sign.png';
function cover(r) {
  const k = curKey();
  const body = EN ? `
    <div class="cv-l1">Monthly Report</div><div class="cv-l2">Ants/Cockroaches/Flies</div>
    ${cfg.contracts.map(c => `<div class="cv-l2">Contract No.&nbsp; ${esc(c)}</div>`).join('')}
    <div class="cv-l3">${esc(mName(k))}</div><div class="cv-l3">Present</div><div class="cv-l2">${esc(cfg.client)}</div>
    <div class="cv-l3">Make by</div><div class="cv-l3">${esc(cfg.preparer)}</div><div class="cv-l4">${esc(cfg.preparerTitle)}</div>`
    : `
    <div class="cv-t">รายงานการปฏิบัติงานกำจัดสัตว์พาหะ</div>
    ${cfg.contracts.map(c => `<div class="cv-t">เลขที่สัญญา ${esc(c)}</div>`).join('')}
    <div class="cv-t">ประจำเดือน ${esc(mName(k))}</div>
    <div class="cv-s" style="margin-top:26px">เสนอ</div><div class="cv-s">${esc(cfg.client)}</div>
    <div class="cv-s" style="margin-top:26px">จัดทำโดย</div><div class="cv-s">${esc(cfg.preparer)}</div><div class="cv-s3">${esc(cfg.preparerTitle)}</div>`;
  return { o: 'P', name: 'หน้าปก', html: `<div class="pg P cov ${EN ? 'en' : 'th'}"><div class="cv-bar"></div><img class="cv-logo" src="${LOGO}"><div class="cv-body">${body}</div>
  <div class="cv-wave2"></div><div class="cv-wave"></div><div class="cv-band"><div class="cv-aipm">Advance<br>Integrated<br>Pest Management</div><div class="cv-tel">02 704 5333</div>
  <div class="cv-foot"><b>Advance Group Asia Co.,Ltd | บริษัท แอ๊ดวานซ์ กรุ๊ป เอเซีย จำกัด</b><br>234/9 ถนนเสรีไทย แขวงคันนายาว เขตคันนายาว กรุงเทพมหานคร 10230 · โทร 02-704-5333 · แฟกซ์ 02-704-5353<br>callcenter@advancegroupasia.com · www.advancegroupasia.com</div></div></div>` };
}
function thHead(title) { return `<div class="th-hd"><img src="${LOGO}"><div><b>${esc(title)}</b><br><b>${esc(cfg.client)}</b></div></div>`; }
function thDateLine(r) { return `<div class="th-dl"><b>วันที่ทำบริการ / Service Date: ${dTH(r.svcDate)}</b><b>เวลา : ${esc(r.svcTime || '……')} น.</b></div>`; }
function thFoot(r, note) {
  return `${note ? `<div class="th-note"><b>หมายเหตุ</b> ${nl(note)}</div>` : ''}
  <div class="th-tech"><b>ผู้ทำบริการ</b><div>${r.techs.map((t, i) => `${i + 1}. ${esc(t)}`).join('<br>')}</div></div>
  <div class="th-acc"><b>ผู้รับเรื่อง / Accepted by :</b> ……………………………………<br><b>วันที่ / Date :</b> ${dTH(r.svcDate, true)}</div>`;
}
function thMonthChart(vals, ytitle, title, unit) {
  const ks = yearKeys(); const labels = ks.map(mShort);
  const img = chart({ w: 500, h: 300, title: unit, labels, bars: [{ name: unit, color: '#5b9bd5', vals }], vals: true, yTitle: ytitle, legend: 'none', rotate: true });
  return `<div class="th-ct">${esc(title)}</div><div class="th-cw"><img src="${img}" style="width:500px;flex:none;border:1px solid #bfbfbf">
  <table class="tt mt"><tr><th>เดือน</th><th>${esc(unit)}</th></tr>${ks.map((k, i) => `<tr><td>${mShort(k)}</td><td>${vals[i] ?? ''}</td></tr>`).join('')}</table></div>`;
}
function pageBait(r) {
  const rows = cfg.bait.st.map((loc, i) => { const x = r.bait[i]; return `<tr><td class="l">${esc(loc)}</td><td>${i + 1}</td><td>${x.n > 0 ? '/' : ''}</td><td>${x.n > 0 ? '' : '/'}</td><td>${x.n}</td><td>${esc(x.rem)}</td></tr>` }).join('');
  const vals = yearKeys().map(baitTot);
  return { o: 'P', name: 'รายงานการวางกล่องเหยื่อพิษกำจัดหนู', html: `<div class="pg P th">${thHead('รายงานการวางกล่องเหยื่อพิษกำจัดหนู')}${thDateLine(r)}
  <table class="tt st"><tr><th rowspan="2" style="width:200px">สถานที่ทำบริการ<br>Service Areas</th><th rowspan="2" style="width:80px">หมายเลข<br>Bait Station No.</th><th colspan="3">หนู</th><th rowspan="2" style="width:90px">หมายเหตุ<br>Remarks</th></tr>
  <tr><th style="width:80px">กัดแทะเหยื่อ</th><th style="width:80px">ไม่กัดแทะเหยื่อ</th><th style="width:80px">จำนวน(ก้อน)</th></tr>${rows}</table>
  ${thMonthChart(vals, 'จำนวนการกัดแทะหนู (ก้อน)', 'จำนวนเหยื่อพิษที่ถูกกัดแทะหนูในแต่ละเดือน', 'หนู (ก้อน)')}${thFoot(r, r.notes.bait)}</div>` };
}
function pageGlue(r) {
  const rows = cfg.glue.st.map((loc, i) => { const x = r.glue[i]; return `<tr><td class="l">${esc(loc)}</td><td>${i + 1}</td><td>${x.n > 0 ? '/' : ''}</td><td>${x.n > 0 ? '' : '/'}</td><td>${x.n}</td><td>${esc(x.rem)}</td></tr>` }).join('');
  const vals = yearKeys().map(glueTot);
  return { o: 'P', name: 'รายงานการวางกล่องกาวดักหนู', html: `<div class="pg P th">${thHead('รายงานการวางกล่องกาวดักหนู')}${thDateLine(r)}
  <table class="tt st"><tr><th rowspan="2" style="width:220px">สถานที่ทำบริการ<br>Service Areas</th><th rowspan="2" style="width:80px">หมายเลข<br>Bait Station No.</th><th colspan="3">หนู</th><th rowspan="2" style="width:90px">หมายเหตุ<br>Remarks</th></tr>
  <tr><th style="width:70px">ติด</th><th style="width:70px">ไม่ติด</th><th style="width:80px">จำนวน(ตัว)</th></tr>${rows}</table>
  ${thMonthChart(vals, 'จำนวนหนู (ตัว)', 'จำนวนหนูในแต่ละเดือน', 'หนู (ตัว)')}${thFoot(r, r.notes.glue)}</div>` };
}
function pageIltTH(r) {
  const sp = cfg.ilt.sp;
  const rows = cfg.ilt.st.map((loc, i) => { const x = r.ilt[i]; return `<tr><td>${i + 1}</td><td>${esc(loc)}</td><td>${x.on ? '✓' : ''}</td><td>${x.on ? '' : '✓'}</td>${x.sp.map(v => `<td>${x.on ? v : '-'}</td>`).join('')}<td>${x.on ? sum(x.sp) : '-'}</td></tr>` }).join('');
  const tot = sum(r.ilt.map(x => x.on ? sum(x.sp) : 0));
  const vals = yearKeys().map(iltTot);
  return { o: 'P', name: 'รายงานการตรวจเช็คเครื่องดักแมลง', html: `<div class="pg P th">${thHead('รายงานการตรวจเช็คเครื่องดักแมลง')}${thDateLine(r)}
  <table class="tt st ilt"><tr><th rowspan="2" style="width:40px">No.</th><th rowspan="2" style="width:190px">สถานที่ตั้ง/ตำแหน่ง</th><th colspan="2">การเปิดใช้งาน</th><th colspan="${sp.length + 1}">ชนิดและแมลงที่ตรวจพบ (ตัว)</th></tr>
  <tr><th style="width:44px">เปิด</th><th style="width:44px">ปิด</th>${sp.map(s => `<th style="width:62px">${esc(s)}</th>`).join('')}<th style="width:62px">ผลรวม</th></tr>${rows}
  <tr><td colspan="${4 + sp.length}" style="text-align:center"><b>ผลรวม</b></td><td><b>${tot}</b></td></tr></table>
  ${thMonthChart(vals, 'จำนวนแมลง (ตัว)', 'จำนวนแมลงในแต่ละเดือน', 'แมลง (ตัว)')}${thFoot(r, r.notes.ilt)}</div>` };
}
function enHead(lines, big) { return `<div class="en-hd"><img src="${LOGO}"><div>${lines.map((l, i) => `<div class="${i === 0 && big ? 'b1' : 'b2'}">${esc(l)}</div>`).join('')}</div></div>`; }
function signBlock(withAck) {
  return `<div class="sg"><div class="sg1"><span class="lab">Check by</span><div class="sgc"><img src="${signImg()}"><div class="ln"></div>(${esc(cfg.preparer)})<br><b>${esc(cfg.preparerTitle)}</b></div></div>
  ${withAck ? `<div class="sg1"><span class="lab">Acknowledgment by</span><div class="sgc"><div style="height:34px"></div><div class="ln"></div>(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</div></div>` : ''}</div>`;
}
function annot(r) { const t = (r.notes.annot || '').trim(); return `<div class="annot"><b><u>Annotation</u></b><div>${t ? nl(t) : ''}</div><i></i><i></i><i></i></div>`; }
function pageIltTableBaxter(r) {
  const sp = cfg.ilt.sp; let T = [0, 0, 0, 0];
  const rows = cfg.ilt.st.map((loc, i) => { const x = r.ilt[i]; const L = iltLimit(i); x.sp.forEach((v, j) => T[j] += x.on ? v : 0); const t = x.on ? sum(x.sp) : 0;
    return `<tr><td>${i + 1}</td><td class="l">${esc(loc)}</td>${x.sp.map(v => `<td>${x.on ? v : '-'}</td>`).join('')}<td>${esc(x.note || (x.on ? '-' : 'Off'))}</td><td><b>${t}</b></td><td>${L.a ?? ''}</td><td class="red"><b>${L.b ?? ''}</b></td></tr>` }).join('');
  return { o: 'L', name: 'Summary chart for Insect Light Traps (table)', html: `<div class="pg L en">${enHead(['ADVANCE GROUP ASIA CO.,LTD.', 'Summary chart for Insect Light Traps', cfg.client, 'On ' + mName(curKey())])}
  <table class="et"><tr><th rowspan="2" style="width:60px">Number</th><th rowspan="2" style="width:220px"><u>checked light trap station</u></th><th colspan="4">Types of insects</th><th rowspan="2" style="width:70px">Note</th><th rowspan="2" style="width:80px">Total Insect</th><th rowspan="2" style="width:70px">Alert limit</th><th rowspan="2" style="width:70px" class="red">Action limit</th></tr>
  <tr>${sp.map(s => `<th style="width:110px">${esc(s)}</th>`).join('')}</tr>${rows}
  <tr><td></td><td><b>Total Insect</b></td>${T.map(v => `<td>${v}</td>`).join('')}<td>-</td><td><b>${sum(T)}</b></td><td>${cfg.ilt.siteAlert ?? ''}</td><td class="red"><b>${cfg.ilt.siteAction ?? ''}</b></td></tr></table>
  ${annot(r)}${signBlock(true)}</div>` };
}
function pageIltTableVantive(r) {
  const sp = cfg.ilt.sp, ck = cfg.ilt.checks || []; let T = [0, 0, 0, 0];
  const box = on => `<span class="cb ${on ? 'on' : ''}"></span>`;
  const rows = cfg.ilt.st.map((loc, i) => { const x = r.ilt[i]; const L = iltLimit(i); x.sp.forEach((v, j) => T[j] += x.on ? v : 0);
    return `<tr><td><b>${i + 1}</b></td><td class="l">${esc(loc)}</td>${x.sp.map(v => `<td>${x.on ? v : '-'}</td>`).join('')}<td><b>${x.on ? sum(x.sp) : '-'}</b></td><td>${L.a ?? ''}</td><td>${L.b ?? ''}</td>${x.chk.map(c => `<td>${box(c)}</td>`).join('')}<td>${esc(x.note)}</td></tr>` }).join('');
  return { o: 'L', name: 'Summary chart for Insect Light Traps (table)', html: `<div class="pg L en">${enHead(['ADVANCE GROUP ASIA CO.,LTD.', 'Summary chart for Insect Light Traps', cfg.client, 'On ' + mName(curKey())])}
  <table class="et vt"><tr><th class="c-or" style="width:46px">No.</th><th class="c-bl" style="width:170px">checked light trap station</th>${sp.map(s => `<th class="c-gr" style="width:86px">${esc(s)}</th>`).join('')}<th class="c-pk" style="width:62px">Total insect</th><th class="c-pk" style="width:62px">Alert limit</th><th class="c-pk" style="width:62px">Ation limit</th>${ck.map(c => `<th class="c-cy" style="width:62px">${esc(c)}</th>`).join('')}<th class="c-cy">Note</th></tr>${rows}
  <tr><td></td><td style="text-align:center"><b>รวม</b></td>${T.map(v => `<td>${v}</td>`).join('')}<td><b>${sum(T)}</b></td><td colspan="${3 + ck.length}"></td></tr></table>
  ${annot(r)}${signBlock(true)}</div>` };
}
function guideHTML(r) {
  return `<div class="gd"><div class="red" style="margin-bottom:10px">${esc(sv(r, 'cr', autoCrText(r)))}</div>
  <b>Guidelines for prevention and solving problem :</b><br><b>By ADVANCE GROUP ASIA CO.,LTD.</b><div class="pre">${esc(cfg.guideAdv)}</div>
  <b>By ${esc(cfg.clientGuideName || cfg.client)}</b><div class="pre">${esc(cfg.guideClient)}</div></div>`;
}
function crStationChart(i, w, h) {
  const ks = yearKeys(); const vals = ks.map(k => { const v = crSt(k, i); return v === '-' ? null : v; });
  return chart({ w, h, title: cfg.cr.st[i], labels: ks.map(k => EN_S[+k.slice(5) - 1]), lines: [{ name: '', color: '#4472c4', vals, width: 2 }], legend: 'none', yMax: Math.max(1, niceMax(Math.max(0, ...vals.filter(v => v != null)))), yStep: Math.max(...vals.filter(v => v != null), 0) <= 1 ? .1 : undefined });
}
function pagesCrCharts(r) {
  const out = []; const n = cfg.cr.st.length; const lines = [cfg.client, 'Summary chart for Cockroach Station on ' + mName(curKey())];
  for (let i = 0; i < n; i += 3) {
    const ids = []; for (let j = i; j < Math.min(n, i + 3); j++) ids.push(j);
    const last = i + 3 >= n; const withGuide = last && ids.length === 1;
    out.push({ o: 'P', name: 'Cockroach Station ' + (i + 1) + '–' + (ids[ids.length - 1] + 1), html: `<div class="pg P en">${enHead(lines, true)}<div class="crc">${ids.map(j => `<img src="${crStationChart(j, 540, 270)}" style="width:540px">`).join('')}</div>
    ${withGuide ? `<div style="margin:16px 90px 0">${enHead(lines, true).replace('<img src="img/logo.png">', '')}${guideHTML(r)}<div style="margin-top:10px">${signBlock(false)}</div></div>` : ''}</div>` });
    if (last && !withGuide) out.push({ o: 'P', name: 'Cockroach guidelines', html: `<div class="pg P en">${enHead(lines, true)}<div style="margin:20px 90px 0">${guideHTML(r)}<div style="margin-top:10px">${signBlock(false)}</div></div></div>` });
  }
  return out;
}
function pagesIltChartsBaxter(r) {
  const out = []; const n = cfg.ilt.st.length; const k = curKey(); const ks = yearKeys(); const lines = [cfg.client2 || cfg.client, 'Summary chart for Insect Light Traps on ' + mName(k)];
  const stChart = i => chart({ w: 520, h: 225, title: 'No.' + (i + 1), labels: ks.map(x => EN_S[+x.slice(5) - 1]), bars: [0, 1, 2, 3].map(j => ({ name: (cfg.ilt.spLegend || cfg.ilt.sp)[j], color: SP_COL[j], vals: ks.map(x => { const s = iltSp(x, i); return s ? s[j] : null; }) })), legend: 'bottom' });
  const pieImg = () => pie({ w: 520, h: 300, title: mName(k), labels: cfg.ilt.st.map((_, i) => String(i + 1)), vals: r.ilt.map(x => x.on ? sum(x.sp) : 0) });
  for (let i = 0; i < n; i += 4) {
    const ids = []; for (let j = i; j < Math.min(n, i + 4); j++) ids.push(j); const last = i + 4 >= n;
    const addPie = last && ids.length <= 2;
    out.push({ o: 'P', name: 'Insect Light Trap charts ' + (i + 1) + '–' + (ids[ids.length - 1] + 1), html: `<div class="pg P en">${enHead(lines, true)}<div class="crc">${ids.map(j => `<img src="${stChart(j)}" style="width:520px;border:1px solid #d0d0d0">`).join('')}
      ${addPie ? `<div style="margin-top:14px">${enHead(lines, true).replace('<img src="img/logo.png">', '<span></span>')}</div><img src="${pieImg()}" style="width:520px;border:1.5px solid #000;margin-top:8px">` : ''}</div></div>` });
    if (last && !addPie) out.push({ o: 'P', name: 'Insect Light Trap pie', html: `<div class="pg P en">${enHead(lines, true)}<div class="crc"><img src="${pieImg()}" style="width:520px;border:1.5px solid #000"></div></div>` });
  }
  return out;
}
function pageIltSummaryBaxter(r) {
  const k = curKey(); const ks = yearKeys(); const y = Y;
  const yr = yy => cfg.yearTotals && cfg.yearTotals[String(yy)] ? cfg.yearTotals[String(yy)] : Array.from({ length: 12 }, (_, i) => { const kk = mk(yy, i + 1); return reports[kk] && !reports[kk]._new ? iltTotOf(kk) : (H(kk) ? iltTot(kk) : null); });
  const series = [{ y: y - 2, c: '#0000ff', v: yr(y - 2) }, { y: y - 1, c: '#ff0000', v: yr(y - 1) }, { y, c: '#00e600', v: ks.map(iltTot) }];
  const A = cfg.ilt.siteAlert, B = cfg.ilt.siteAction;
  const img = chart({ w: 680, h: 250, title: 'Summary Chart of Insect Light Traps', labels: EN_S, bars: series.map(s => ({ name: String(s.y), color: s.c, vals: s.v })), lines: [{ name: 'Action limit', color: '#70ad47', vals: EN_S.map(() => B), width: 1.5, endLabel: B }, { name: 'Alert limit', color: '#e00000', vals: EN_S.map(() => A), width: 2.5, endLabel: A }], legend: 'none', yMax: niceMax(Math.max(B * 1.6, ...series.flatMap(s => s.v).filter(v => v != null))) });
  const tbl = `<table class="yt"><tr><td style="width:100px"></td>${EN_S.map(m => `<td>${m}</td>`).join('')}</tr>
  ${series.map(s => `<tr><td class="l"><span class="sw" style="background:${s.c}"></span>${s.y}</td>${s.v.map(v => `<td>${v ?? ''}</td>`).join('')}</tr>`).join('')}
  <tr><td class="l"><span class="sl" style="background:#e00000"></span>Alert limit</td>${EN_S.map(() => `<td>${A}</td>`).join('')}</tr>
  <tr><td class="l"><span class="sl" style="background:#70ad47"></span>Action limit</td>${EN_S.map(() => `<td>${B}</td>`).join('')}</tr></table>`;
  const rm = (cfg.limitRemark || '').split('\n');
  const probs = r.problems.length ? r.problems.map(p => `<tr><td><div class="pimg">${(p.img || []).map(id => `<div style="background-image:url('${esc(imgURL(id))}')"></div>`).join('')}</div></td><td>${nl(p.problem)}</td><td>${nl(p.advice)}${(p.advImg || []).length ? `<div class="pimg a">${p.advImg.map(id => `<div style="background-image:url('${esc(imgURL(id))}')"></div>`).join('')}</div>` : ''}</td></tr>`).join('') : `<tr><td style="height:60px">-</td><td>-</td><td>-</td></tr>`;
  return { o: 'P', name: 'Summary of Insect Light Traps', html: `<div class="pg P en">${enHead([cfg.client2 || cfg.client, 'Summary chart for Insect Light Traps on  ' + mName(k)], true)}
  <div class="ybox"><div class="amt">Amount</div><img src="${img}" style="width:680px">${tbl}</div>
  <div class="rmk"><b>Remark</b><div class="i1">${esc(rm[0] || '')}</div><div class="i1"><span class="sl" style="background:#000"></span>${esc(rm[1] || '')}</div><div class="blu">${esc(rm[2] || '')}</div><div class="i1"><span class="sl" style="background:#e00000"></span>${esc(rm[3] || '')}</div><div class="red">${esc(rm[4] || '')}</div></div>
  <div class="sres"><b>Summary of the results on ${esc(dEN(r.sum.date || r.svcDate) || mName(k))}</b>
  <div class="kv"><span>1.The most of type insect found insects catcher in light trap ${cfg.ilt.st.length} types</span><span>= ${esc(sv(r, 'types', autoTypes(r)))}</span></div>
  <div class="kv"><span>2. The most of position found insects catcher in light trap ${cfg.ilt.st.length} points</span><span>= <b>${esc(sv(r, 'pos', autoPositions(r)))}</b></span></div>
  <div class="kv"><span>3.Level of Insect</span><span class="grn"><b>${esc(sv(r, 'level', autoLevel(r)))}</b></span></div></div>
  <div class="sres"><b>Guidelines for prevention and solving problem :</b></div>
  <table class="pt"><tr><th colspan="3">ADVANCE GROUP ASIA</th></tr><tr><th style="width:255px">Area (image)</th><th style="width:175px">Problem</th><th>Advice</th></tr>${probs}</table>
  <div style="position:absolute;right:70px;bottom:46px">${signBlock(false)}</div></div>` };
}
function iltTotOf(k) { const d = normalize(clone(reports[k])); return sum(d.ilt.map(x => x.on ? sum(x.sp) : 0)); }
function pageCrTableVantive(r) {
  const ks = yearKeys(); const n = cfg.cr.st.length; const L = cfg.cr.limit ?? 1;
  const rows = cfg.cr.st.map((nm, i) => { const v = ks.map(k => crSt(k, i)); return `<tr><td>${i + 1}</td><td class="l">${esc(nm)}</td>${v.map(x => `<td>${x ?? ''}</td>`).join('')}<td>${sum(v.filter(x => x !== '-'))}</td></tr>` }).join('');
  const tot = ks.map(k => { const v = cfg.cr.st.map((_, i) => crSt(k, i)); return v.every(x => x == null) ? null : sum(v.filter(x => x !== '-')); });
  return { o: 'L', name: 'Summary chart for Crawling insects Station (table)', html: `<div class="pg L en">${enHead(['ADVANCE GROUP ASIA CO.,LTD.', cfg.client, 'Summary chart for Crawling insects Station on ' + mName(curKey()), EN_M[+ks[0].slice(5) - 1] + ' ' + ks[0].slice(0, 4) + ' - ' + EN_M[+ks[11].slice(5) - 1] + ' ' + ks[11].slice(0, 4)])}
  <table class="et cr"><tr><th rowspan="2" style="width:40px">No.</th><th rowspan="2" style="width:230px">checked Cockroach Station</th><th colspan="12">${esc(EN_M[+ks[0].slice(5) - 1] + ' ' + ks[0].slice(0, 4) + ' - ' + EN_M[+ks[11].slice(5) - 1] + ' ' + ks[11].slice(0, 4))}</th><th rowspan="2" style="width:50px">รวม</th></tr>
  <tr>${ks.map(k => `<th style="width:46px">${EN_S[+k.slice(5) - 1]}</th>`).join('')}</tr>${rows}
  <tr><td colspan="2"><b>Total</b></td>${tot.map(t => `<td><b>${t ?? ''}</b></td>`).join('')}<td><b>${sum(tot)}</b></td></tr>
  <tr><td colspan="2"><b>Alert limit &amp; Action limit</b></td>${ks.map(() => `<td>${L}</td>`).join('')}<td>${L}</td></tr></table></div>` };
}
const CR_RISK = [
  ['Low risk level\n\n(zero crawling insect)', '', 'Not found crawling insects in area per 100 sq. m.', '- Monitor and maintain the area to keep it clean.\n- Seal any leaks that may be entry points.'],
  ['High risk level\n\n(≥ 1)', 'Alert and Action limit', '- A small number of crawling insects were found (no more than 1-2 per 100 sq. m.), mostly in dark spots, but there was no indication of them spreading.\n- Crawling insects were found in several locations throughout the area. Crawling insects droppings or molted skin may also be present.', '- Apply bait gel to high-risk areas.\n- Reduce humidity and check hiding places such as under the kitchen sink and in storage rooms.\n- Increase the frequency of follow-up.\n- Check every 2 weeks.\n- Use a record of crawling insects sightings.'],
  ['High risk level\n\n(>10)', 'Alert and Action limit', 'Crawling insects of various sizes (larvae and adults) were found, along with traces of feces and eggs.', '- Use cockroach, Ant gel in conjunction with targeted chemical spraying.\n- Check hiding places in pipes and corners.\n- Increase the frequency of follow-up.\n- Check every 1 week.\n- Keep a record of cockroach sightings.'],
  ['The risk level is very high\n\n(over control , > 20)', 'Alert and Action limit', 'There is an outbreak, with large quantities found both day and night.', '- Coordinate with pest control experts.\n- Implement mixed control measures such as poison bait, insecticide spraying, and elimination of food sources.\n- Increase the frequency of follow-up.\n- Continuously monitor and track results.\n- Inspect every 3 days.']];
const FLY_RISK = [
  ['Low risk level', '', 'They are mostly found in areas where light enters or comes in from the outside, and no breeding grounds have been found in the area', '- Monitor the area and maintain cleanliness.\n- Inspect and seal any cracks or entry points, such as air curtains or screens.\n- Follow up according to Monthly service.'],
  ['Medium risk level', '(Alert limit)', 'Flying insects are found in various locations around the area, or they may begin to congregate in sheltered spots. Suitable egg-laying sites may be found, such as wet garbage or areas with accumulated moisture, but they have not yet spread widely.', '- Add more insect trap locations or re-observe for detections.\n- Reduce humidity and remove food sources/waste by sealing them tightly.\n- Monitor every two weeks and record sighting statistics.'],
  ['High risk level', '(Action limit)', 'The continuous presence of flying insects of various sizes, including larvae(mosquitolarvae/caterpillars) and adults, indicates a complete life cycle in the area, but it has not yet reached a critical level.', '- Use targeted spot treatment in conjunction with larvae control.\n- Inspect drainage systems, confined spaces, and high-humidity areas in depth.\n- Increase the monitoring frequency to every 1 week.'],
  ['The risk level is very high', '(Action limit)\n\n3 consecutive months', 'Large numbers of flying insects are found both day and night, scattered across multiple locations simultaneously. Clear breeding grounds (eggs/larvae) have been identified. This constitutes an urgent matter requiring immediate action.', '- Coordinate with experts to analyze the cause and implement integrated pest management (IPM) measures.\n- ULV (Ultra Low Volume) fogging and strict site organization are recommended.\n- Extended periods of 3-5 days are required for in-depth area restoration.']];
function riskTable(rows, lvColor) {
  return `<table class="rk"><tr><th style="width:125px">Risk level</th><th style="width:190px">Evaluation</th><th>Guidelines for solutions and prevention.</th></tr>
  ${rows.map(r => `<tr><td style="text-align:center">${nl(r[0])}${r[1] ? `<div style="color:${lvColor(r)};font-weight:700;margin-top:8px">${nl(r[1])}</div>` : ''}</td><td>${nl(r[2])}</td><td>${nl(r[3])}</td></tr>`).join('')}</table>`;
}
function pageCrSummaryVantive(r) {
  const n = cfg.cr.st.length; const L = cfg.cr.limit ?? 1;
  const img = chart({ w: 470, h: 220, title: 'Crawling insects Station', labels: cfg.cr.st.map((_, i) => String(i + 1)), bars: [{ name: 'Found (' + mName(curKey()) + ')', color: '#5b9bd5', vals: r.cr }], lines: [{ name: 'Alert limit & Action limit', color: '#ffc000', vals: cfg.cr.st.map(() => L) }], legend: 'top', yMax: Math.max(5, niceMax(Math.max(...r.cr) * 1.2)), yStep: 1 });
  return { o: 'L', name: 'Crawling insects summary & guidelines', html: `<div class="pg L en">${enHead(['ADVANCE GROUP ASIA CO.,LTD.', cfg.client, 'Summary chart for Crawling insects ' + n + ' Stations on ' + mName(curKey())])}
  <div class="two"><div style="width:470px"><img src="${img}" style="width:470px;border:1px solid #d0d0d0">${guideHTML(r)}</div>
  <div style="width:560px">${riskTable(CR_RISK, () => '#e00000')}<div style="margin-top:24px">${signBlock(false)}</div></div></div></div>` };
}
function pagesIltStationVantive(r) {
  const ks = yearKeys(); const k = curKey();
  return cfg.ilt.st.map((nm, i) => {
    const L = iltLimit(i); const t = ks.map(x => iltSt(x, i));
    const img = chart({ w: 640, h: 300, title: 'No. ' + (i + 1), labels: ks.map((_, j) => String(j + 1)), lines: [{ name: 'Total', color: '#5b9bd5', vals: t }, { name: 'Alert limit', color: '#ed7d31', vals: ks.map(() => L.a) }, { name: 'Action limit', color: '#e00000', vals: ks.map(() => L.b) }], legend: 'bottom', yMax: niceMax(Math.max(L.b || 1, ...t.filter(v => v != null)) * 1.12) });
    return { o: 'L', name: 'Insect Light Trap No. ' + (i + 1), html: `<div class="pg L en">${enHead([cfg.client, 'Summary chart for Insect Light Traps on ' + mName(k)])}
    <table class="et sm"><tr><th style="width:110px;text-align:left">No. ${i + 1}</th>${ks.map(x => `<th>${EN_S[+x.slice(5) - 1]}</th>`).join('')}</tr>
    <tr><td class="l">Total</td>${t.map(v => `<td>${v ?? ''}</td>`).join('')}</tr><tr><td class="l">Alert limit</td>${ks.map(() => `<td class="red">${L.a ?? ''}</td>`).join('')}</tr><tr><td class="l">Action limit</td>${ks.map(() => `<td class="red">${L.b ?? ''}</td>`).join('')}</tr></table>
    <div style="text-align:center;margin-top:16px"><img src="${img}" style="width:640px;border:1px solid #d0d0d0"></div></div>` };
  });
}
function pageFlyRiskVantive(r) {
  const k = curKey(); const top = autoTopStations(r);
  const l1 = sv(r, 'pos', top.pos), l1b = sv(r, 'types', top.sp);
  const g = (cfg.flyGuide || '').split('\n').map(s => { const m = s.match(/^(\d+\.\s*[^.]+\.)(.*)$/); return m ? `<b>${esc(m[1])}</b>${esc(m[2])}` : esc(s); }).join('<br>');
  return { o: 'L', name: 'Risk Assessment and Management of flying Insects', html: `<div class="pg L en">${enHead(['ADVANCE GROUP ASIA CO.,LTD.', cfg.client, 'Risk Assessment and Management of flying Insects'])}
  <div class="two"><div style="width:560px">${riskTable(FLY_RISK, x => x[0].startsWith('Medium') ? '#f0b400' : '#e00000')}</div>
  <div style="width:450px;font-size:11.5px;line-height:1.6"><b style="font-size:14px">Remark :</b><br><br><b style="font-size:14px">Guidelines for prevention and solving problem :<br>By ADVANCE GROUP ASIA CO.,LTD.</b><br>
  <b>Summary of the results on ${esc(mName(k))}</b><br>
  <div class="kv"><span>1.${esc(l1)}</span><span>${l1b ? '= ' + esc(l1b) : ''}</span></div>
  <div>2. ${esc(sv(r, 'crLine', r.cr && sum(r.cr) ? 'Found Cockroach in monitor trap ' + sum(r.cr) + ' insect(s)' : 'Not found Cockroach in monitor trap'))}</div>
  <div class="kv"><span>3.Level of Insect</span><span class="grn"><b>${esc(sv(r, 'level', autoLevel(r)))}</b></span></div>
  ${(r.sum.levelNote || '').trim() ? `<div class="red" style="text-align:right"><b>( ${esc(r.sum.levelNote)} )</b></div>` : ''}
  <b>Guidelines for prevention and solving problem :</b><div style="font-size:11.5px">${g}</div><div style="margin-top:14px">${signBlock(false)}</div></div></div></div>` };
}
function pagesLayout() {
  return (cfg.layouts || []).map(l => { const src = cfg.layoutImg && cfg.layoutImg[l.key] ? imgURL(cfg.layoutImg[l.key]) : l.src; return { o: 'L', img: src, name: l.label, html: `<div class="pg L"><img class="full" src="${esc(src)}"></div>` }; });
}
function buildPages() {
  const r = cur(); const P = [];
  const B = {
    cover: () => P.push(cover(r)),
    bait: () => P.push(pageBait(r)), glue: () => P.push(pageGlue(r)), ilt: () => P.push(pageIltTH(r)),
    iltTable: () => P.push(SITE === 'vantive' ? pageIltTableVantive(r) : pageIltTableBaxter(r)),
    crCharts: () => P.push(...pagesCrCharts(r)), iltCharts: () => P.push(...pagesIltChartsBaxter(r)), iltSummary: () => P.push(pageIltSummaryBaxter(r)),
    crTable: () => P.push(pageCrTableVantive(r)), crSummary: () => P.push(pageCrSummaryVantive(r)), iltStation: () => P.push(...pagesIltStationVantive(r)), flyRisk: () => P.push(pageFlyRiskVantive(r)),
    layout: () => P.push(...pagesLayout())
  };
  (cfg.blocks || []).forEach(b => { if (!(cfg.off || {})[b] && B[b]) B[b](); });
  return P;
}

/* ───────── UI ───────── */
const TABS = [['info', 'ข้อมูลการเข้าบริการ'], ...(has('bait') ? [['bait', 'เหยื่อพิษกำจัดหนู']] : []), ...(has('glue') ? [['glue', 'กาวดักหนู']] : []),
  ...(has('cr') ? [['cr', EN ? 'Cockroach / Crawling station' : 'บ้านแมลงสาบ']] : []), ...(has('ilt') ? [['ilt', EN ? 'Insect Light Trap' : 'เครื่องดักแมลง']] : []),
  ...(EN ? [['sum', 'สรุปผล & คำแนะนำ']] : []), ['out', 'ตรวจ & ดาวน์โหลด PDF'], ['cfg', 'ตั้งค่า']];
function buildShell() {
  document.title = cfg.title; $('#appTitle').textContent = cfg.title;
  $('#tabs').innerHTML = TABS.map(([k, t], i) => `<button data-t="${k}" class="${i ? '' : 'on'}">${k !== 'cfg' ? (i + 1) + ' ' : ''}${esc(t)}</button>`).join('');
  $('#tabs').querySelectorAll('button').forEach(b => b.onclick = () => goTab(b.dataset.t));
  $('main').insertAdjacentHTML('beforeend', TABS.map(([k], i) => `<section class="tab ${i ? '' : 'on'}" id="t-${k}"></section>`).join(''));
}
function goTab(t) {
  document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x.dataset.t === t));
  document.querySelectorAll('section.tab').forEach(s => s.classList.toggle('on', s.id === 't-' + t));
  if (t === 'out') renderOut(); if (t === 'sum') renderSum();
  window.scrollTo(0, 0);
}
function navRow(t) { const i = TABS.findIndex(x => x[0] === t); const p = TABS[i - 1], n = TABS[i + 1]; return `<div class="row">${p ? `<button class="btn" data-go="${p[0]}">← ย้อนกลับ</button>` : ''}${n && n[0] !== 'cfg' ? `<button class="btn pri" data-go="${n[0]}">ถัดไป: ${esc(n[1])} →</button>` : ''}</div>`; }
function bindNav(el) { el.querySelectorAll('[data-go]').forEach(b => b.onclick = () => goTab(b.dataset.go)); }
function bindText(el, r, path) { el.querySelectorAll('[data-f]').forEach(e => { e.oninput = () => { const ks = e.dataset.f.split('.'); let o = r; ks.slice(0, -1).forEach(k => o = o[k] = o[k] || {}); o[ks[ks.length - 1]] = e.value; markDirty(); }; }); }
function renderInfo() {
  const r = cur(); const el = $('#t-info');
  el.innerHTML = `<div class="card"><h2>วันเข้าบริการ · ${esc(mName(curKey()))}</h2><div class="grid2">
  <label class="f">วันที่ทำบริการ<input type="date" data-f="svcDate" value="${esc(r.svcDate)}"></label>
  ${EN ? '' : `<label class="f">เวลา (น.)<input type="text" data-f="svcTime" value="${esc(r.svcTime)}" placeholder="15.00"></label>`}</div><p class="hint" id="dateHint"></p></div>
  ${EN ? '' : `<div class="card"><h2>ผู้ทำบริการ</h2><p class="hint">บรรทัดละ 1 คน (ดึงจากเดือนก่อนมาให้ แก้เฉพาะที่เปลี่ยน)</p><textarea id="techs" rows="4">${esc(r.techs.join('\n'))}</textarea></div>`}
  ${EN ? `<div class="card"><h2>Annotation ใต้ตาราง Insect Light Traps (ถ้ามี)</h2><textarea data-f="notes.annot">${esc(r.notes.annot || '')}</textarea></div>` : ''}${navRow('info')}`;
  bindText(el, r); bindNav(el);
  const dh = () => { const bad = r.svcDate && r.svcDate.slice(0, 7) !== curKey(); $('#dateHint').innerHTML = bad ? '<b style="color:#d92d20">วันที่บริการไม่ตรงกับเดือนที่เลือก</b>' : ''; };
  el.querySelector('[data-f="svcDate"]').addEventListener('input', dh); dh();
  const t = $('#techs'); if (t) t.oninput = () => { r.techs = t.value.split('\n').map(s => s.trim()).filter(Boolean); markDirty(); };
}
function numInput(attrs, v, max) { return `<input type="number" inputmode="numeric" min="0" ${max ? `max="${max}"` : ''} step="1" ${attrs} value="${v}" class="num">`; }
function bindNums(el, onv) {
  const ins = [...el.querySelectorAll('input.num')];
  ins.forEach((inp, j) => {
    inp.onfocus = () => inp.select();
    inp.oninput = () => { let v = inp.value === '' ? 0 : Math.round(+inp.value); if (isNaN(v) || v < 0) v = 0; const mx = +inp.max || 0; if (mx && v > mx) { v = mx; inp.value = v; toast('สูงสุด ' + mx); } onv(inp, v); markDirty(); };
    inp.onblur = () => { if (inp.value === '') inp.value = 0; };
    inp.onkeydown = e => { if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); (ins[j + 1] || inp).focus(); } else if (e.key === 'ArrowUp') { e.preventDefault(); (ins[j - 1] || inp).focus(); } };
  });
}
function prevOf() { return dataOf(addMonths(curKey(), -1)); }
function renderSimple(sec) {
  const r = cur(); const el = $('#t-' + sec); const p = prevOf(); const c = cfg[sec];
  const title = { bait: 'กล่องเหยื่อพิษกำจัดหนู (นับก้อนที่ถูกกัดแทะ 0–' + (c.cap || 5) + ')', glue: 'กล่องกาวดักหนู (จำนวนหนูที่ติด)', cr: EN ? 'Cockroach / Crawling insects station (จำนวนที่พบ)' : 'บ้านแมลงสาบ' }[sec];
  const rows = c.st.map((loc, i) => {
    const v = sec === 'cr' ? r.cr[i] : r[sec][i].n; const pv = p ? (sec === 'cr' ? p.cr[i] : p[sec][i].n) : '';
    const dis = sec === 'cr' && !crStarted(curKey(), i);
    return `<tr class="${v ? 'hitrow' : ''}"><td><b>${i + 1}</b></td><td>${esc(loc)}</td><td class="hint">${pv}</td><td>${dis ? '<span class="hint">ยังไม่ติดตั้ง</span>' : numInput(`data-i="${i}"`, v, sec === 'bait' ? c.cap || 5 : 0)}</td>${sec === 'cr' ? '' : `<td><input type="text" data-rem="${i}" value="${esc(r[sec][i].rem)}" placeholder="หมายเหตุ"></td>`}</tr>`;
  }).join('');
  el.innerHTML = `<div class="card"><div class="row"><h2 style="margin:0;flex:1">${esc(title)} · ${esc(mName(curKey()))}</h2><button class="btn sm" data-zero>ล้างเป็น 0</button>${p ? '<button class="btn sm" data-copy>คัดลอกจากเดือนก่อน</button>' : ''}</div>
  <div class="stat" data-stat></div><table class="ed"><tr><th style="width:50px">จุด</th><th>สถานที่</th><th style="width:90px">เดือนก่อน</th><th style="width:130px">${sec === 'bait' ? 'ก้อนที่ถูกกิน' : 'จำนวนที่พบ'}</th>${sec === 'cr' ? '' : '<th>หมายเหตุ</th>'}</tr>${rows}</table>
  <p class="hint">พิมพ์ตัวเลขแล้วกด Enter เพื่อไปช่องถัดไป · ไม่พบใส่ 0</p></div>
  ${!EN && r.notes ? `<div class="card"><h2>หมายเหตุท้ายหน้า</h2><textarea data-f="notes.${sec}">${esc(r.notes[sec] || '')}</textarea></div>` : ''}${navRow(sec)}`;
  const upd = () => { const vals = sec === 'cr' ? r.cr : r[sec].map(x => x.n); const hit = vals.filter(v => v > 0).length; el.querySelector('[data-stat]').innerHTML = `<span>พบ <b>${hit}</b> / ${vals.length} จุด</span><span>รวม <b>${sum(vals)}</b> ${sec === 'bait' ? 'ก้อน' : 'ตัว'}</span>`; };
  bindNums(el, (inp, v) => { const i = +inp.dataset.i; if (sec === 'cr') r.cr[i] = v; else r[sec][i].n = v; inp.closest('tr').classList.toggle('hitrow', v > 0); upd(); });
  el.querySelectorAll('[data-rem]').forEach(e => e.oninput = () => { r[sec][+e.dataset.rem].rem = e.value; markDirty(); });
  el.querySelector('[data-zero]').onclick = () => { if (sec === 'cr') r.cr = r.cr.map(() => 0); else r[sec].forEach(x => x.n = 0); markDirty(); renderSimple(sec); };
  const cp = el.querySelector('[data-copy]'); if (cp) cp.onclick = () => { if (sec === 'cr') r.cr = [...p.cr]; else r[sec].forEach((x, i) => x.n = p[sec][i].n); markDirty(); renderSimple(sec); };
  bindText(el, r); bindNav(el); upd();
}
function renderIlt() {
  const r = cur(); const el = $('#t-ilt'); const c = cfg.ilt; const ck = c.checks || []; const p = prevOf();
  const rows = c.st.map((loc, i) => { const x = r.ilt[i]; const L = iltLimit(i); const t = sum(x.sp);
    return `<tr data-row="${i}" class="${x.on ? '' : 'off'}"><td><b>${i + 1}</b></td><td>${esc(loc)}${p ? `<div class="hint">เดือนก่อน: ${p.ilt[i].on ? sum(p.ilt[i].sp) : 'ปิด'}</div>` : ''}</td>
    <td><label><input type="checkbox" data-on="${i}" ${x.on ? 'checked' : ''}> ${EN ? 'ใช้งาน' : 'เปิด'}</label></td>
    ${x.sp.map((v, j) => `<td>${numInput(`data-i="${i}" data-j="${j}"`, v, 0)}</td>`).join('')}<td class="tot" data-tot="${i}"><b>${t}</b>${L.a != null ? `<div class="hint lim">alert ${L.a} / action ${L.b}</div>` : ''}</td>
    ${ck.map((_, j) => `<td><input type="checkbox" data-ck="${i}" data-j="${j}" ${x.chk[j] ? 'checked' : ''}></td>`).join('')}
    <td><input type="text" data-note="${i}" value="${esc(x.note)}" style="width:100%"></td></tr>`; }).join('');
  el.innerHTML = `<div class="card"><div class="row"><h2 style="margin:0;flex:1">${EN ? 'Insect Light Traps' : 'เครื่องดักแมลง'} · ${esc(mName(curKey()))}</h2><button class="btn sm" data-zero>ล้างเป็น 0</button></div>
  <div class="stat" data-stat></div><div style="overflow-x:auto"><table class="ed"><tr><th>No.</th><th>ตำแหน่ง</th><th>${EN ? 'สถานะ' : 'การเปิดใช้งาน'}</th>${c.sp.map(s => `<th style="width:92px">${esc(s)}</th>`).join('')}<th style="width:110px">รวม</th>${ck.map(s => `<th style="width:80px">${esc(s)}</th>`).join('')}<th>Note</th></tr>${rows}</table></div>
  <p class="hint">ใส่จำนวนแมลงแต่ละชนิดที่พบ · ช่องรวมจะเป็นสีแดงเมื่อเกิน Alert limit</p></div>
  ${!EN ? `<div class="card"><h2>หมายเหตุท้ายหน้า</h2><textarea data-f="notes.ilt">${esc(r.notes.ilt || '')}</textarea></div>` : ''}${navRow('ilt')}`;
  const upd = () => { r.ilt.forEach((x, i) => { const t = sum(x.sp); const L = iltLimit(i); const td = el.querySelector(`[data-tot="${i}"]`); td.querySelector('b').textContent = t; td.classList.toggle('warn', L.a != null && t >= L.a); });
    el.querySelector('[data-stat]').innerHTML = `<span>รวมทั้งหมด <b>${sum(r.ilt.map(x => x.on ? sum(x.sp) : 0))}</b> ตัว</span>${cfg.ilt.siteAlert != null ? `<span class="hint">Alert ${cfg.ilt.siteAlert} / Action ${cfg.ilt.siteAction}</span>` : ''}`; };
  bindNums(el, (inp, v) => { r.ilt[+inp.dataset.i].sp[+inp.dataset.j] = v; upd(); });
  el.querySelectorAll('[data-on]').forEach(e => e.onchange = () => { r.ilt[+e.dataset.on].on = e.checked; e.closest('tr').classList.toggle('off', !e.checked); markDirty(); upd(); });
  el.querySelectorAll('[data-ck]').forEach(e => e.onchange = () => { r.ilt[+e.dataset.ck].chk[+e.dataset.j] = e.checked; markDirty(); });
  el.querySelectorAll('[data-note]').forEach(e => e.oninput = () => { r.ilt[+e.dataset.note].note = e.value; markDirty(); });
  el.querySelector('[data-zero]').onclick = () => { r.ilt.forEach(x => x.sp = [0, 0, 0, 0]); markDirty(); renderIlt(); };
  bindText(el, r); bindNav(el); upd();
}
function sumField(key, label, auto, opts) {
  const r = cur();
  if (opts) return `<label class="f">${esc(label)}<select data-s="${key}"><option value="">อัตโนมัติ: ${esc(auto)}</option>${opts.map(o => `<option ${r.sum[key] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
  return `<label class="f">${esc(label)}<input type="text" data-s="${key}" value="${esc(r.sum[key] || '')}" placeholder="อัตโนมัติ: ${esc(auto)}"></label>`;
}
function renderSum() {
  const r = cur(); const el = $('#t-sum'); if (!el) return;
  let body = `<div class="card"><h2>ข้อความสรุปในรายงาน</h2><p class="hint">ช่องที่เว้นว่างระบบจะเขียนให้อัตโนมัติจากตัวเลขที่กรอก (ข้อความสีเทาคือค่าที่จะใช้) · พิมพ์ทับเมื่อต้องการแก้</p><div class="grid1">`;
  body += sumField('cr', 'ข้อความใต้กราฟแมลงสาบ (สีแดง)', autoCrText(r));
  if (SITE === 'baxter') {
    body += `<label class="f">วันที่ใน "Summary of the results on"<input type="date" data-s="date" value="${esc(r.sum.date || '')}"></label>`;
    body += sumField('types', '1. The most of type insect found', autoTypes(r)) + sumField('pos', '2. The most of position found (เกิน Alert limit)', autoPositions(r)) + sumField('level', '3. Level of Insect', autoLevel(r), ['Low levels', 'Medium levels', 'High levels', 'Very high levels']);
  } else {
    const t = autoTopStations(r);
    body += sumField('pos', '1. ตำแหน่งที่พบแมลงมากที่สุด', t.pos) + sumField('types', '   = ชนิดแมลงที่พบ', t.sp) + sumField('crLine', '2. ผลบ้านแมลงสาบ', sum(r.cr) ? 'Found Cockroach in monitor trap ' + sum(r.cr) + ' insect(s)' : 'Not found Cockroach in monitor trap') + sumField('level', '3. Level of Insect', autoLevel(r), ['Low risk level', 'Medium risk level (Alert limit)', 'High risk level (Action limit)', 'The risk level is very high (Action limit)'])
      + `<label class="f">หมายเหตุระดับความเสี่ยง (สีแดง เช่น สาเหตุที่แมลงเพิ่ม)<input type="text" data-s="levelNote" value="${esc(r.sum.levelNote || '')}" placeholder="เช่น Due to the frequent rains this month, the number of insects has increased."></label>`;
  }
  body += '</div></div>';
  if (SITE === 'baxter') {
    body += `<div class="card"><div class="row"><h2 style="margin:0;flex:1">ตารางปัญหาที่พบ & คำแนะนำ (Guidelines)</h2><button class="btn sm" id="addProb">+ เพิ่มปัญหา</button></div>
    ${r.problems.length ? '' : '<p class="hint">ยังไม่มีรายการ — ถ้าไม่มี รายงานจะแสดง "-"</p>'}${r.problems.map((p, i) => `<div class="prob" data-p="${i}">
    <div class="row"><b style="flex:1">ปัญหาที่ ${i + 1}</b><button class="btn sm" data-del>ลบ</button></div><div class="grid2">
    <div><div class="hint">รูปพื้นที่ (Area image) สูงสุด 2 รูป</div><div class="thumbs">${(p.img || []).map((id, j) => `<div class="th" style="background-image:url('${esc(imgURL(id))}')"><button data-rm="img" data-j="${j}">✕</button></div>`).join('')}<button class="btn sm" data-add="img">+ รูป</button></div></div>
    <div><div class="hint">รูปประกอบคำแนะนำ (ถ้ามี)</div><div class="thumbs">${(p.advImg || []).map((id, j) => `<div class="th" style="background-image:url('${esc(imgURL(id))}')"><button data-rm="advImg" data-j="${j}">✕</button></div>`).join('')}<button class="btn sm" data-add="advImg">+ รูป</button></div></div>
    <label class="f">Problem<textarea data-pf="problem">${esc(p.problem || '')}</textarea></label><label class="f">Advice<textarea data-pf="advice">${esc(p.advice || '')}</textarea></label></div></div>`).join('')}</div>`;
  }
  el.innerHTML = body + navRow('sum');
  el.querySelectorAll('[data-s]').forEach(e => { const f = () => { r.sum[e.dataset.s] = e.value; markDirty(); }; e.oninput = f; e.onchange = f; });
  const ap = $('#addProb'); if (ap) ap.onclick = () => { r.problems.push({ img: [], problem: '', advice: '', advImg: [] }); markDirty(); renderSum(); };
  el.querySelectorAll('[data-p]').forEach(box => { const p = r.problems[+box.dataset.p];
    box.querySelector('[data-del]').onclick = () => { r.problems.splice(+box.dataset.p, 1); markDirty(); renderSum(); };
    box.querySelectorAll('[data-pf]').forEach(e => e.oninput = () => { p[e.dataset.pf] = e.value; markDirty(); });
    box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { p[b.dataset.rm].splice(+b.dataset.j, 1); markDirty(); renderSum(); });
    box.querySelectorAll('[data-add]').forEach(b => b.onclick = async () => { const fs = await pickFiles(true); if (!fs.length) return; const key = b.dataset.add; p[key] = p[key] || [];
      for (const f of fs) { const tmp = 'up:' + Math.random().toString(36).slice(2); mem[tmp] = URL.createObjectURL(f); p[key].push(tmp); renderSum();
        try { const id = await uploadImg(await shrink(f)); mem[id] = mem[tmp]; p[key][p[key].indexOf(tmp)] = id; } catch (e) { p[key].splice(p[key].indexOf(tmp), 1); toast(e.message); } }
      markDirty(); renderSum(); });
  });
  bindNav(el);
}
function issues() {
  const r = cur(); const out = [];
  if (!r.svcDate) out.push(['bad', 'ยังไม่ได้ใส่วันที่ทำบริการ']); else if (r.svcDate.slice(0, 7) !== curKey()) out.push(['bad', 'วันที่ทำบริการไม่อยู่ในเดือนที่เลือก']);
  if (!EN && !r.techs.length) out.push(['bad', 'ยังไม่ได้ใส่ชื่อผู้ทำบริการ']);
  if (has('ilt')) r.ilt.forEach((x, i) => { const L = iltLimit(i); if (x.on && L.b != null && sum(x.sp) >= L.b) out.push(['warn', `${cfg.ilt.st[i]}: เกิน Action limit (${sum(x.sp)} ≥ ${L.b}) — ตรวจระดับความเสี่ยง/คำแนะนำในหน้าสรุป`]); });
  if (JSON.stringify(r).includes('"up:')) out.push(['bad', 'รูปยังอัปโหลดไม่เสร็จ']);
  const pk = addMonths(curKey(), -1); if (!dataOf(pk) && !H(pk) && yearKeys().indexOf(pk) >= 0) out.push(['warn', `ยังไม่มีข้อมูลเดือน ${mName(pk)} (กราฟจะเว้นว่างเดือนนั้น)`]);
  if (!out.length) out.push(['ok', 'ครบถ้วน พร้อมดาวน์โหลด']);
  return out;
}
function renderOut() {
  const el = $('#t-out');
  el.innerHTML = `${isClient() ? '' : `<div class="card"><h2>ตรวจก่อนส่ง</h2><ul class="checks">${issues().map(([c, t]) => `<li class="${c}">${c === 'ok' ? '✓' : c === 'warn' ? '!' : '•'} ${esc(t)}</li>`).join('')}</ul></div>`}
  <div class="card"><h2>${isClient() ? 'ดาวน์โหลดรายงาน' : 'ส่งให้ลูกค้า & ดาวน์โหลด PDF'}</h2><div id="sendBox" style="margin-bottom:10px"></div>
  <div class="row"><button class="btn pri" id="btnPdf">ดาวน์โหลด PDF ทั้งเล่ม</button><span class="hint" id="pdfInfo"></span></div><div class="prog" id="prog" style="display:none"><i></i></div><p class="hint" id="pdfMsg"></p></div>
  <div class="card"><div class="row"><h2 style="margin:0;flex:1">ตัวอย่างทุกหน้า</h2><button class="btn sm" id="btnPreview">สร้างตัวอย่าง</button></div><div id="preview"><p class="hint">กด "สร้างตัวอย่าง" เพื่อดูทุกหน้า</p></div></div>`;
  $('#btnPreview').onclick = renderPreview; $('#btnPdf').onclick = downloadPdf; renderSendBox();
}
function renderSendBox() {
  const b = $('#sendBox'); if (!b) return; if (isClient()) { b.innerHTML = ''; return; }
  const st = STATUS[curKey()];
  b.innerHTML = `<div class="row"><span>สถานะเดือนนี้: <b>${st ? (st.status === 'draft' ? 'ฉบับร่าง (ลูกค้ายังไม่เห็น)' : st.status === 'approved' ? 'ลูกค้ารับรองแล้ว' : 'ส่งให้ลูกค้าแล้ว') : 'ยังไม่บันทึก'}</b>${st && st.sent_at ? ' · ส่งเมื่อ ' + new Date(st.sent_at).toLocaleString('th-TH') : ''}</span>
  <button class="btn" id="btnSend">${st && st.status !== 'draft' ? 'ส่งฉบับแก้ไขให้ลูกค้าอีกครั้ง' : 'ส่งรายงานให้ลูกค้า'}</button></div>`;
  $('#btnSend').onclick = async () => { const bad = issues().filter(x => x[0] === 'bad'); const btn = $('#btnSend');
    if (bad.length && !btn.dataset.sure) { btn.dataset.sure = 1; btn.textContent = 'ยังมี ' + bad.length + ' รายการที่ควรแก้ · กดอีกครั้งเพื่อส่งเลย'; return; }
    btn.disabled = true; try { await flush(); const r = clone(cur()); delete r._new; await rpc('lad_save_report', { p_site: SITE, p_month: curKey(), p_data: r, p_send: true }); toast('ส่งรายงานให้ลูกค้าแล้ว'); await loadStatus(); } catch (e) { toast('ส่งไม่สำเร็จ: ' + e.message); btn.disabled = false; } };
}
function renderPreview() {
  const pages = buildPages(); const box = $('#preview'); const sc = Math.min(1, (box.clientWidth || 900) / 1150) * 0.66;
  box.innerHTML = pages.map((p, i) => { const w = p.o === 'P' ? 794 : 1123, h = p.o === 'P' ? 1123 : 794; return `<div class="pvlab">หน้า ${i + 1} · ${esc(p.name || '')}</div><div class="pvw" style="width:${w * sc}px;height:${h * sc}px">${p.html.replace('class="pg ', `style="transform:scale(${sc})" class="pg `)}</div>`; }).join('');
  $('#pdfInfo').textContent = `ทั้งหมด ${pages.length} หน้า`;
}
let fontCSS = null;
async function getFontCSS() {
  if (fontCSS) return fontCSS;
  const files = { 'sarabun-thai-400-normal': 'U+0E01-0E5B,U+200C-200D,U+25CC', 'sarabun-thai-700-normal': 'U+0E01-0E5B,U+200C-200D,U+25CC', 'sarabun-latin-400-normal': 'U+0000-00FF,U+2000-206F,U+2212', 'sarabun-latin-700-normal': 'U+0000-00FF,U+2000-206F,U+2212' };
  let css = ''; for (const [f, u] of Object.entries(files)) { const b = await (await fetch('fonts/' + f + '.woff2')).blob(); const d = await new Promise(rs => { const fr = new FileReader(); fr.onload = () => rs(fr.result); fr.readAsDataURL(b); });
    css += `@font-face{font-family:'Sarabun';font-weight:${f.includes('700') ? 700 : 400};src:url(${d}) format('woff2');unicode-range:${u};}`; }
  return fontCSS = css;
}
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => rej(new Error('โหลดรูปไม่ได้: ' + src)); i.src = src; }); }
async function waitImgs(el) {
  await Promise.all([...el.querySelectorAll('img')].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  const bgs = [...el.querySelectorAll('[style*="background-image"]')].map(d => (d.style.backgroundImage.match(/url\("?(.*?)"?\)/) || [])[1]).filter(Boolean);
  await Promise.all(bgs.map(s => loadImg(s).catch(() => 0)));
}
async function makePdf(onProg) {
  const { jsPDF } = window.jspdf; const pages = buildPages(); const root = $('#exportRoot');
  await document.fonts.ready; const fcss = await getFontCSS(); let pdf = null;
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]; const o = p.o === 'P' ? 'portrait' : 'landscape';
    if (!pdf) pdf = new jsPDF({ orientation: o, unit: 'mm', format: 'a4', compress: true }); else pdf.addPage('a4', o);
    const W = o === 'portrait' ? 210 : 297, Hh = o === 'portrait' ? 297 : 210;
    if (p.img) { const im = await loadImg(p.img); const s = Math.min((W - 16) / im.naturalWidth, (Hh - 16) / im.naturalHeight); const w = im.naturalWidth * s, h = im.naturalHeight * s; pdf.addImage(im, 'JPEG', (W - w) / 2, (Hh - h) / 2, w, h, undefined, 'FAST'); }
    else { root.innerHTML = p.html; const el = root.firstElementChild; await waitImgs(el);
      const url = await htmlToImage.toJpeg(el, { quality: .9, pixelRatio: 1.8, backgroundColor: '#ffffff', fontEmbedCSS: fcss, cacheBust: false });
      pdf.addImage(url, 'JPEG', 0, 0, W, Hh, undefined, 'FAST'); }
    onProg && onProg((i + 1) / pages.length, i + 1, pages.length); await new Promise(r => setTimeout(r, 0));
  }
  root.innerHTML = ''; return pdf.output('blob');
}
async function downloadPdf() {
  const b = $('#btnPdf'); b.disabled = true; $('#prog').style.display = 'block'; const bar = $('#prog i'); $('#pdfMsg').textContent = 'กำลังสร้าง PDF…';
  try { if (!isClient()) await flush();
    const blob = await makePdf((f, i, n) => { bar.style.width = (f * 100) + '%'; $('#pdfMsg').textContent = `กำลังสร้างหน้า ${i}/${n}`; });
    const name = EN ? `Monthly Report ${cfg.client} ${mName(curKey())}.pdf` : `รายงานประจำเดือน ${cfg.client} ${mName(curKey())}.pdf`;
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.textContent = 'ถ้าไฟล์ไม่ดาวน์โหลดเอง กดที่นี่';
    $('#pdfMsg').innerHTML = 'ดาวน์โหลดแล้ว ✓ (' + (blob.size / 1048576).toFixed(1) + ' MB) · '; $('#pdfMsg').appendChild(a); a.click();
  } catch (e) { console.error(e); $('#pdfMsg').textContent = 'สร้าง PDF ไม่สำเร็จ: ' + (e.message || e); }
  b.disabled = false;
}
window.__buildPages = buildPages; window.__makePdf = makePdf;

/* ───────── settings ───────── */
function renderCfg() {
  const el = $('#t-cfg'); const lines = a => (a || []).join('\n');
  const stBox = (k, label) => has(k) ? `<label class="f">${esc(label)}<textarea data-st="${k}" rows="8">${esc(lines(cfg[k].st))}</textarea></label>` : '';
  el.innerHTML = `<div class="card"><h2>ข้อมูลลูกค้า / หน้าปก</h2><div class="grid2">
  <label class="f">ชื่อลูกค้า<input data-c="client" value="${esc(cfg.client)}"></label>
  ${cfg.client2 != null ? `<label class="f">ชื่อลูกค้า (หัวหน้ากราฟเครื่องดักแมลง)<input data-c="client2" value="${esc(cfg.client2)}"></label>` : ''}
  <label class="f">เลขที่สัญญา (คั่นด้วย ,)<input data-c="contracts" value="${esc(cfg.contracts.join(', '))}"></label>
  <label class="f">ผู้จัดทำ<input data-c="preparer" value="${esc(cfg.preparer)}"></label><label class="f">ตำแหน่ง<input data-c="preparerTitle" value="${esc(cfg.preparerTitle)}"></label>
  ${has('bait') ? `<label class="f">จำนวนก้อนต่อกล่องเหยื่อ<input data-c="bait.cap" type="number" value="${cfg.bait.cap || 5}"></label>` : ''}
  ${cfg.ilt && cfg.ilt.siteAlert != null ? `<label class="f">Alert limit (รวมทั้งไซต์)<input data-c="ilt.siteAlert" type="number" value="${cfg.ilt.siteAlert}"></label><label class="f">Action limit (รวมทั้งไซต์)<input data-c="ilt.siteAction" type="number" value="${cfg.ilt.siteAction}"></label>` : ''}
  ${has('cr') && cfg.cr.limit != null ? `<label class="f">Alert & Action limit แมลงสาบ<input data-c="cr.limit" type="number" value="${cfg.cr.limit}"></label>` : ''}
  </div></div>
  <div class="card"><h2>รายชื่อจุด/สถานี (บรรทัดละ 1 จุด)</h2><div class="grid2">${stBox('bait', 'กล่องเหยื่อพิษ')}${stBox('glue', 'กล่องกาวดักหนู')}${stBox('ilt', 'เครื่องดักแมลง')}${stBox('cr', 'บ้านแมลงสาบ / Crawling station')}
  ${has('ilt') && cfg.ilt.alert ? `<label class="f">Alert, Action limit ของเครื่องดักแมลงแต่ละเครื่อง (บรรทัดละเครื่อง เช่น 26, 52)<textarea data-lim rows="8">${esc(cfg.ilt.st.map((_, i) => (cfg.ilt.alert[i] ?? '') + ', ' + (cfg.ilt.action[i] ?? '')).join('\n'))}</textarea></label>` : ''}</div>
  <p class="hint">เพิ่ม/ลดจุดได้ ข้อมูลเดือนเก่าจะเรียงตามลำดับบรรทัด</p></div>
  ${EN ? `<div class="card"><h2>ข้อความคำแนะนำ (Guidelines)</h2><div class="grid2"><label class="f">By ADVANCE GROUP ASIA<textarea data-c="guideAdv" rows="7">${esc(cfg.guideAdv)}</textarea></label><label class="f">By ลูกค้า<textarea data-c="guideClient" rows="7">${esc(cfg.guideClient)}</textarea></label>
  ${cfg.flyGuide != null ? `<label class="f" style="grid-column:1/-1">Guidelines หน้า Risk Assessment (แมลงบิน)<textarea data-c="flyGuide" rows="6">${esc(cfg.flyGuide)}</textarea></label>` : ''}</div></div>` : ''}
  ${cfg.yearTotals ? `<div class="card"><h2>ยอดรวมแมลงปีก่อน ๆ (กราฟเปรียบเทียบรายปี)</h2><p class="hint">รูปแบบ: ปี: ม.ค., ก.พ., … ธ.ค.</p><textarea data-yt rows="3">${esc(Object.entries(cfg.yearTotals).map(([y, v]) => y + ': ' + v.join(', ')).join('\n'))}</textarea></div>` : ''}
  <div class="card"><h2>หน้าแผนผัง (Layout) และลายเซ็น</h2><div class="tiles">${(cfg.layouts || []).map(l => `<div class="ltile"><b>${esc(l.label)}</b><img src="${esc(cfg.layoutImg && cfg.layoutImg[l.key] ? imgURL(cfg.layoutImg[l.key]) : l.src)}"><button class="btn sm" data-lay="${l.key}">อัปโหลดรูปใหม่</button></div>`).join('')}
  ${EN ? `<div class="ltile"><b>ลายเซ็น (Check by)</b><img src="${esc(signImg())}" style="height:60px;object-fit:contain"><button class="btn sm" data-sign>อัปโหลดลายเซ็น (PNG พื้นใส)</button></div>` : ''}</div></div>
  <div class="card"><h2>ข้อมูลย้อนหลัง (ก่อนเริ่มใช้ระบบ)</h2><p class="hint">ใช้แสดงในกราฟ/ตารางทั้งปี สำหรับเดือนที่ไม่มีรายงานในระบบ · แก้เฉพาะเมื่อจำเป็น (รูปแบบ JSON)</p><textarea data-hist rows="6" style="font-family:monospace;font-size:12px">${esc(JSON.stringify(cfg.hist || {}, null, 0).replace(/\},"/g, '},\n"'))}</textarea></div>
  <div class="card"><h2>ลิงก์สำหรับลูกค้า</h2><p class="hint">ลูกค้าเปิดลิงก์นี้แล้วดูและดาวน์โหลดได้เฉพาะรายงานที่กด "ส่งให้ลูกค้า" แล้ว แก้ไขข้อมูลไม่ได้</p>
  <div class="row"><button class="btn" id="btnClientLink">แสดงลิงก์ลูกค้า</button><input type="text" id="clientLink" readonly style="flex:1"><button class="btn" id="copyLink">คัดลอก</button></div></div>
  <div class="row"><button class="btn pri" id="saveCfg">บันทึกการตั้งค่า</button><span class="hint" id="cfgMsg"></span></div>`;
  el.querySelectorAll('[data-lay]').forEach(b => b.onclick = async () => { const [f] = await pickFiles(false); if (!f) return; try { const id = await uploadImg(await shrink(f, 2600, .88)); cfg.layoutImg = cfg.layoutImg || {}; cfg.layoutImg[b.dataset.lay] = id; await saveCfg(); renderCfg(); toast('อัปโหลดแล้ว'); } catch (e) { toast(e.message); } });
  const sg = el.querySelector('[data-sign]'); if (sg) sg.onclick = async () => { const [f] = await pickFiles(false, 'image/png,image/*'); if (!f) return;
    try { const path = SITE + '/sign-' + Date.now() + '.png'; const r = await fetch(SB + '/storage/v1/object/' + BUCKET + '/' + path, { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': f.type || 'image/png' }, body: f }); if (!r.ok) throw new Error('อัปโหลดไม่สำเร็จ'); cfg.sign = path; await saveCfg(); renderCfg(); toast('อัปโหลดลายเซ็นแล้ว'); } catch (e) { toast(e.message); } };
  $('#btnClientLink').onclick = async () => { try { const ck = await rpc('lad_client_key', { p_site: SITE }); $('#clientLink').value = location.origin + location.pathname + '?k=' + ck; } catch (e) { toast(e.message); } };
  $('#copyLink').onclick = () => { const i = $('#clientLink'); i.select(); navigator.clipboard?.writeText(i.value).then(() => toast('คัดลอกแล้ว'), () => { }); };
  $('#saveCfg').onclick = async () => {
    try {
      el.querySelectorAll('[data-c]').forEach(e => { const ks = e.dataset.c.split('.'); let o = cfg; ks.slice(0, -1).forEach(k => o = o[k]); let v = e.value; if (e.type === 'number') v = +v; if (ks[0] === 'contracts') v = v.split(',').map(s => s.trim()).filter(Boolean); o[ks[ks.length - 1]] = v; });
      el.querySelectorAll('[data-st]').forEach(e => { cfg[e.dataset.st].st = e.value.split('\n').map(s => s.trim()).filter(Boolean); });
      const lim = el.querySelector('[data-lim]'); if (lim) { const L = lim.value.split('\n').map(s => s.split(',').map(x => x.trim() === '' ? null : +x)); cfg.ilt.alert = cfg.ilt.st.map((_, i) => (L[i] || [])[0] ?? null); cfg.ilt.action = cfg.ilt.st.map((_, i) => (L[i] || [])[1] ?? null); }
      const yt = el.querySelector('[data-yt]'); if (yt) { const o = {}; yt.value.split('\n').forEach(l => { const m = l.match(/^\s*(\d{4})\s*:(.*)$/); if (m) o[m[1]] = m[2].split(',').map(x => x.trim() === '' ? null : +x); }); cfg.yearTotals = o; }
      cfg.hist = JSON.parse(el.querySelector('[data-hist]').value || '{}');
      await saveCfg(); $('#cfgMsg').textContent = 'บันทึกแล้ว ✓'; renderAll();
    } catch (e) { $('#cfgMsg').textContent = 'บันทึกไม่สำเร็จ: ' + e.message; }
  };
}

/* ───────── month selector & boot ───────── */
function buildSelectors() {
  const ys = $('#selYear'); ys.innerHTML = ''; for (let y = 2026; y <= 2029; y++) ys.add(new Option(EN ? y : y + 543, y)); ys.value = Y;
  const ms = $('#selMonth'); ms.innerHTML = ''; (EN ? EN_M : TH_M).forEach((t, i) => ms.add(new Option(t, i + 1))); ms.value = M;
  ys.onchange = async () => { if (!isClient()) await flush(); Y = +ys.value; renderAll(); };
  ms.onchange = async () => { if (!isClient()) await flush(); M = +ms.value; renderAll(); };
  labelMonths();
}
function labelMonths() {
  const ms = $('#selMonth'); if (!ms) return;
  [...ms.options].forEach((o, i) => { const k = mk(Y, i + 1); const st = STATUS[k]; const x = reports[k]; o.textContent = (EN ? EN_M : TH_M)[i] + (st ? (st.status === 'draft' ? ' · ร่าง' : ' · ส่งแล้ว ✓') : (x && !x._new ? ' · มีข้อมูล' : '')); });
}
function renderAll() {
  $('#selYear').value = Y; $('#selMonth').value = M;
  if (!isClient()) { renderInfo(); ['bait', 'glue', 'cr'].forEach(s => has(s) && renderSimple(s)); if (has('ilt')) renderIlt(); renderSum(); renderCfg(); }
  renderOut(); labelMonths();
}
function applyRole() {
  if (!isClient()) return;
  document.querySelectorAll('#tabs button').forEach(b => { if (b.dataset.t !== 'out') b.style.display = 'none'; });
  goTab('out'); const bn = $('#banner'); bn.style.display = 'block'; bn.textContent = 'โหมดลูกค้า: เลือกเดือนด้านบน แล้วกด "สร้างตัวอย่าง" หรือ "ดาวน์โหลด PDF"';
  $('#btnHome').style.display = 'none';
}
(async function boot() {
  buildShell();
  const now = new Date(); Y = now.getFullYear(); M = now.getMonth() + 1;
  const km = (location.search + location.hash).match(/[?#&]k=([A-Za-z0-9_-]+)/);
  setStatus('กำลังเชื่อมต่อ…');
  try {
    if (km) { const w = await rpc('lad_c_bootstrap', { k: km[1] }); if (w.site !== SITE) throw new Error('ลิงก์นี้ไม่ใช่ของลูกค้ารายนี้'); KEY = km[1]; ROLE = 'client'; }
  } catch (e) { toast(e.message); }
  try { await loadCfg(); await loadReports(); } catch (e) { setStatus('โหลดข้อมูลไม่สำเร็จ'); toast(e.message); }
  // open the latest month that has data (or the month after it), not beyond today
  const ks = Object.keys(reports).sort(); const last = ks[ks.length - 1];
  if (isClient() && last) { [Y, M] = last.split('-').map(Number); }
  else if (last && !reports[mk(Y, M)]) { const nx = addMonths(last, 1); if (nx < mk(Y, M)) [Y, M] = nx.split('-').map(Number); }
  buildSelectors(); renderAll(); applyRole(); await loadStatus();
  setStatus(isClient() ? 'ลูกค้า · ดูอย่างเดียว' : 'บันทึกอัตโนมัติ');
})();
window.addEventListener('beforeunload', () => { if (pending.size) flush(); });
