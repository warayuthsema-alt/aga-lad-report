/* รายงานฉบับ Custom (ตัวสร้างรายงานแบบบล็อก) — ลูกค้าหลายราย (lad_sites 'custom-…'), รายงานรายเดือนใน lad_reports
   รายงาน 1 เดือน = รายการบล็อก (หน้าปก / สารเคมี / ตารางสถานี / สรุปผล / ข้อความ / รูป / แผนผัง / ลงนาม) เพิ่ม ซ่อน เรียงลำดับได้อิสระ */
"use strict";
const SB = 'https://zhdigumxkjfvrkkmqqpk.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoZGlndW14a2pmdnJra21xcXBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMjI2NjcsImV4cCI6MjA5Nzc5ODY2N30.NJpFFXX_KYGgICo3WNaevMxjXc0EB9X7rOzOhWXiIK0';
const BUCKET = 'pest-reports';
const TH_M = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const TH_S = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nl = s => esc(s).replace(/\n/g, '<br>');
const pad = n => String(n).padStart(2, '0');
const mk = (y, m) => y + '-' + pad(m);
const clone = o => JSON.parse(JSON.stringify(o));
const sum = a => (a || []).reduce((t, v) => t + (+v || 0), 0);
const lines = v => v.split('\n').map(s => s.trim()).filter(Boolean);
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('on'), 2400); }
function setStatus(t) { $('#status').textContent = t; }
async function rpc(fn, args) {
  const r = await fetch(SB + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}) });
  const t = await r.text(); if (!r.ok) { let m = t; try { m = JSON.parse(t).message } catch (e) { } throw new Error(m); } return t ? JSON.parse(t) : null;
}
const dLong = iso => { if (!iso) return '……………'; const [y, m, d] = iso.split('-').map(Number); return d + ' ' + TH_M[m - 1] + ' ' + (y + 543); };
const mName = k => { const [y, m] = k.split('-').map(Number); return TH_M[m - 1] + ' ' + (y + 543); };
const mShort = k => { const [y, m] = k.split('-').map(Number); return TH_S[m - 1] + String(y + 543).slice(-2); };
function addMonths(k, d) { let [y, m] = k.split('-').map(Number); m += d; while (m > 12) { m -= 12; y++ } while (m < 1) { m += 12; y-- } return mk(y, m); }

/* ───────── state ───────── */
let SITE = null, cfg = {}, Y, M; const reports = {}; let STATUS = {};
const curKey = () => mk(Y, M);
const siteFromHash = () => (location.hash.match(/c=(custom-[a-z0-9]+)/) || [])[1] || null;
const C = k => cfg[k] ?? CUSTOM_DEF[k];

function prevReport(k) { const ks = Object.keys(reports).filter(x => x < k && !reports[x]._new).sort(); return ks.length ? reports[ks[ks.length - 1]] : null; }
/* รายงานรุ่นแรก (ก่อนมีระบบบล็อก) → แปลงเป็นบล็อก */
const PEST_ORDER = ['แมลงหวี่', 'แมลงวัน', 'แมลงสาบ', 'ปลวก', 'หนู', 'ยุง', 'มด'];
const guessPest = t => PEST_ORDER.find(p => (t || '').includes(p)) || '';
function migrate(r) {
  r.blocks.forEach(b => {
    if (b.type === 'chem') { ['showActive', 'showRatio', 'showMethod'].forEach(k => { if (b[k] === undefined) b[k] = true; });
      b.rows.forEach(c => { if (c.active === undefined) { const m = findMaster(c.pest, c.name); c.active = m ? m.active : ''; c.ratio = m ? m.ratio : ''; c.method = m ? m.method : ''; } }); }
    if (b.type === 'sections') { if (b.showRisk === undefined) { b.showRisk = true; b.showRiskTable = true; }
      b.items.forEach(s => { if (s.pest === undefined) { s.pest = guessPest(s.title); s.risk = 0; } if (s.kind === undefined) { const t = s.title || ''; s.kind = /กาว/.test(t) ? 'glue' : /เหยื่อพิษ/.test(t) ? 'bait' : /สถานีแมลงสาบ|บ้านแมลงสาบ/.test(t) ? 'crst' : /เครื่องดัก/.test(t) ? 'ilt' : /เหยื่อ.*ปลวก/.test(t) ? 'ttb' : 'area'; const m = t.match(/พื้นที่\s*(.+)$/); s.area = m ? m[1].trim() : 'ภายในอาคาร'; } }); }
  });
  r.blocks.forEach(b => { if (b.type === 'image' && !b.layouts) { b.layouts = b.img ? [b.img] : []; delete b.img; } if (b.type === 'stations' && !b.layouts) b.layouts = []; });
  r._mig = 4; return r;
}
function upgrade(r) {
  if (Array.isArray(r.blocks)) return r._mig === 4 ? r : migrate(r);
  r.blocks = [newBlock('cover', { showDate: r.showDate !== false }), newBlock('chem', { rows: r.chem || clone(CUSTOM_DEF.chem), showDate: r.showDate !== false }),
    newBlock('sign', { techs: r.techs || [...CUSTOM_DEF.techs], showSign: false }),
    newBlock('sections', { items: r.sections || clone(CUSTOM_DEF.sections) }), newBlock('photos', { photos: r.photos || [], title: cfg.photoTitle || CUSTOM_DEF.photoTitle })];
  delete r.chem; delete r.techs; delete r.sections; delete r.photos; return migrate(r);
}
/* เดือนใหม่: คัดลอกโครงรายงานจากเดือนก่อน ล้างตัวเลข/รูป */
function blank(k) {
  const p = prevReport(k);
  if (!p) return { svcDate: '', blocks: PRESETS[cfg.preset || 'standard'].make() };
  const blocks = clone(upgrade(p).blocks).map(b => {
    if (b.type === 'stations') b.rows.forEach(r => { r.v = r.v.map(() => 0); r.rem = ''; });
    if (b.type === 'photos') b.photos = [];
    return b;
  });
  return { svcDate: '', blocks };
}
function cur() { const k = curKey(); if (!reports[k]) { reports[k] = blank(k); reports[k]._new = true; } return upgrade(reports[k]); }
const vis = r => r.blocks.filter(b => !b.hidden);

let saveTimer = null, saving = false; const pending = new Set();
function markDirty() { const k = curKey(); pending.add(k); if (reports[k]) delete reports[k]._new; setStatus('ยังไม่บันทึก…'); clearTimeout(saveTimer); saveTimer = setTimeout(flush, 900); }
async function flush() {
  if (saving) { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 600); return; }
  saving = true;
  try { for (const k of [...pending]) { pending.delete(k); if (!reports[k]) continue; const r = clone(reports[k]); delete r._new; r.updatedAt = new Date().toISOString();
      try { await rpc('lad_save_report', { p_site: SITE, p_month: k, p_data: r, p_send: false }); } catch (e) { pending.add(k); setStatus('บันทึกไม่สำเร็จ จะลองใหม่'); saveTimer = setTimeout(flush, 4000); return; } }
    setStatus('บันทึกแล้ว ✓'); loadStatusQuiet();
  } finally { saving = false; }
}
let cfgTimer = null;
function cfgDirty() { setStatus('ยังไม่บันทึก…'); clearTimeout(cfgTimer); cfgTimer = setTimeout(async () => { try { await rpc('lad_save_config', { p_site: SITE, p_config: cfg }); if (cfg.client) await rpc('lad_custom_rename', { p_site: SITE, p_name: cfg.client }); setStatus('บันทึกแล้ว ✓'); } catch (e) { setStatus('บันทึกไม่สำเร็จ'); } }, 900); }
let lsT = null; function loadStatusQuiet() { clearTimeout(lsT); lsT = setTimeout(loadStatus, 1500); }
async function loadStatus() { STATUS = {}; try { ((await rpc('lad_list', { p_site: SITE })) || []).forEach(x => STATUS[x.month] = x); } catch (e) { } labelMonths(); }

/* ───────── images ───────── */
const mem = {};
const imgURL = id => !id ? '' : mem[id] ? mem[id] : id.startsWith('up:') ? '' : /^(data:|blob:|img\/|https?:)/.test(id) ? id : SB + '/storage/v1/object/public/' + BUCKET + '/' + id;
async function shrink(file, max = 1600, q = .84) {
  let bmp; try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }) } catch (e) { bmp = await createImageBitmap(file) } // หมุนตาม EXIF อัตโนมัติ
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height)); const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
  return { blob: await new Promise(res => c.toBlob(res, 'image/jpeg', q)), w: c.width, h: c.height };
}
async function uploadImg(blob) {
  const path = 'custom/' + SITE.slice(7) + '/' + curKey() + '/' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2)) + '.jpg';
  const r = await fetch(SB + '/storage/v1/object/' + BUCKET + '/' + path, { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'image/jpeg' }, body: blob });
  if (!r.ok) throw new Error('อัปโหลดไม่สำเร็จ (' + r.status + ')'); return path;
}
async function uploadMany(files, list, onEach, max) {
  const key = curKey(); const tmp = [];
  for (const f of files) { const id = 'up:' + Math.random().toString(36).slice(2); mem[id] = URL.createObjectURL(f); const p = { id, w: 3, h: 4 }; list.push(p); tmp.push([p, f]); }
  onEach(); let n = 0;
  for (const [p, f] of tmp) { setStatus(`กำลังอัปโหลดรูป ${++n}/${tmp.length}`);
    try { const s = await shrink(f, max || 1600); p.w = s.w; p.h = s.h; const id = await uploadImg(s.blob); mem[id] = URL.createObjectURL(s.blob); p.id = id; }
    catch (e) { list.splice(list.indexOf(p), 1); toast('อัปโหลดรูปไม่สำเร็จ: ' + e.message); }
    if (key === curKey()) onEach(); }
  markDirty();
}

/* ───────── chart ───────── */
function barChart(o) {
  const S = 2, c = document.createElement('canvas'); c.width = o.w * S; c.height = o.h * S; const g = c.getContext('2d'); g.scale(S, S);
  g.fillStyle = '#fff'; g.fillRect(0, 0, o.w, o.h); const F = "'Sarabun',sans-serif";
  const vals = o.vals.map(v => v == null ? null : +v); const lim = [o.alert, o.action].filter(v => v != null && v !== '');
  let max = Math.max(1, ...vals.filter(v => v != null), ...lim.map(Number)) * 1.15; const p = Math.pow(10, Math.floor(Math.log10(max))); max = Math.ceil(max / p) * p; const step = max / 5;
  const L = 40, R = o.w - 14, T = 30, B = o.h - 34;
  g.fillStyle = '#02472f'; g.font = `bold 12px ${F}`; g.textAlign = 'center'; g.fillText(o.title, o.w / 2, 18);
  g.font = `10px ${F}`;
  for (let v = 0; v <= max + 1e-9; v += step) { const y = B - (B - T) * v / max; g.strokeStyle = '#e4ebe7'; g.beginPath(); g.moveTo(L, y); g.lineTo(R, y); g.stroke(); g.fillStyle = '#667085'; g.textAlign = 'right'; g.fillText(Number.isInteger(step) ? String(Math.round(v)) : v.toFixed(1), L - 5, y + 3); }
  const n = o.labels.length, bw = (R - L) / n;
  o.labels.forEach((t, i) => { const x = L + bw * (i + .5); g.fillStyle = '#475467'; g.textAlign = 'center'; g.fillText(t, x, B + 14);
    const v = vals[i]; if (v == null) return; const h = (B - T) * v / max; g.fillStyle = i === o.hi ? '#e0531f' : '#2f7d5b'; g.fillRect(x - bw * .3, B - h, bw * .6, h);
    if (v > 0 || i === o.hi) { g.fillStyle = '#1d2433'; g.font = `bold 10px ${F}`; g.fillText(String(v), x, B - h - 4); g.font = `10px ${F}`; } });
  [[o.alert, '#f0a400', 'Alert'], [o.action, '#d92d20', 'Action']].forEach(([v, col, lab]) => { if (v == null || v === '') return; const y = B - (B - T) * v / max; g.strokeStyle = col; g.setLineDash([5, 3]); g.lineWidth = 1.5; g.beginPath(); g.moveTo(L, y); g.lineTo(R, y); g.stroke(); g.setLineDash([]); g.fillStyle = col; g.textAlign = 'right'; g.font = `bold 9.5px ${F}`; g.fillText(lab + ' ' + v, R, y - 3); g.font = `10px ${F}`; });
  g.strokeStyle = '#98a2b3'; g.lineWidth = 1; g.beginPath(); g.moveTo(L, B); g.lineTo(R, B); g.stroke();
  return c.toDataURL('image/png');
}

/* ───────── report page parts ───────── */
const LOGO = 'img/logo.png';
const REPORT_TITLE = 'รายงานการปฏิบัติงานกำจัดแมลงและสัตว์พาหะ';
function xHead(title) { return `<div class="xh"><img src="${LOGO}"><div class="xh-r"><b>บริษัท แอ๊ดวานซ์ กรุ๊ป เอเซีย จำกัด</b><span>Advance Group Asia Co.,Ltd.</span></div></div>
  <div class="xt"><div><b>${esc(title)}</b><span>${esc(C('client'))}</span></div><div class="xt-m">${esc(mName(curKey()))}</div></div>`; }
const xFoot = () => `<div class="xf"><span>บริษัท แอ๊ดวานซ์ กรุ๊ป เอเซีย จำกัด · โทร 02-704-5333 · www.advancegroupasia.com</span><span class="pno"></span></div>`;
const bHead = t => `<div class="xbh">${esc(t)}</div>`;
function pageCover(b, r) {
  const ct = (C('contracts') || []).filter(Boolean);
  return { o: 'P', cover: true, name: 'หน้าปก', html: `<div class="pg P xc">
  <div class="xc-top"></div><img class="xc-logo" src="${LOGO}">
  <div class="xc-kicker">SERVICE REPORT · รายงานประจำเดือน</div>
  <div class="xc-title">${nl(b.coverTitle || 'รายงานการปฏิบัติงาน\nกำจัดแมลงและสัตว์พาหะ')}</div>
  ${b.showPests !== false ? `<div class="xc-pests">${esc(C('pestsLine'))}</div>` : ''}<div class="xc-rule"></div>
  <div class="xc-card"><div class="xc-lab">จัดทำให้</div><div class="xc-client">${esc(C('client'))}</div>
  <table class="xc-meta">${b.showContract !== false && ct.length ? `<tr><td>เลขที่สัญญา</td><td>${esc(ct.join(', '))}</td></tr>` : ''}<tr><td>ประจำเดือน</td><td>${esc(mName(curKey()))}</td></tr>
  ${b.showDate !== false ? `<tr><td>วันที่ทำบริการ</td><td>${esc(dLong(r.svcDate))}</td></tr>` : ''}
  ${b.showPreparer !== false ? `<tr><td>จัดทำโดย</td><td>${esc(C('preparer'))}${C('preparerTitle') ? `<br><span>${esc(C('preparerTitle'))}</span>` : ''}</td></tr>` : ''}</table></div>
  <div class="xc-band"><div><b>Advance Integrated Pest Management</b><br>บริษัท แอ๊ดวานซ์ กรุ๊ป เอเซีย จำกัด · Advance Group Asia Co.,Ltd.<br>234/9 ถนนเสรีไทย แขวงคันนายาว เขตคันนายาว กรุงเทพมหานคร 10230</div><div class="xc-tel">02 704 5333<br><span>callcenter@advancegroupasia.com · www.advancegroupasia.com</span></div></div></div>` };
}
/* แต่ละบล็อกแบบ "ไหลต่อเนื่อง" คืนชิ้นส่วน (piece) ให้ตัวจัดหน้า; ชิ้นที่ k:'h' คือหัวข้อ (ไม่ให้ค้างท้ายหน้า) */
function piecesChem(b, r) {
  const rows = b.rows.filter(c => (c.name || '').trim()); const out = [{ k: 'h', h: bHead(b.title) }];
  if (b.showInfo !== false) { const ct = (C('contracts') || []).filter(Boolean);
    out.push({ h: `<div class="xi"><div><span>สถานที่ให้บริการ</span><b>${esc(C('client'))}</b></div>${b.showDate !== false ? `<div><span>วันที่ทำบริการ / Service Date</span><b>${esc(dLong(r.svcDate))}</b></div>` : ''}${ct.length ? `<div><span>เลขที่สัญญา</span><b>${esc(ct.join(', '))}</b></div>` : ''}<div><span>ผู้จัดทำรายงาน</span><b>${esc(C('preparer'))}</b></div></div>` }); }
  const grp = []; rows.forEach(c => { const g = grp[grp.length - 1]; if (g && g.p === (c.pest || '')) g.items.push(c); else grp.push({ p: c.pest || '', items: [c] }); });
  const A = b.showActive !== false, R = b.showRatio !== false, Mt = b.showMethod !== false, Nt = b.showNote !== false; const wide = [A, R, Mt, Nt].filter(Boolean).length >= 3;
  const hd = `<tr><th style="width:${wide ? 78 : 130}px">ชนิดของแมลง<br><small>Target Pest</small></th><th>ชื่อการค้าของสารเคมี<br><small>Trade Name</small></th>${A ? '<th style="width:128px">สารออกฤทธิ์<br><small>Active Ingredient</small></th>' : ''}${R ? '<th style="width:118px">อัตราส่วนผสม<br><small>Mix Ratio</small></th>' : ''}${Mt ? '<th style="width:106px">วิธีการ<br><small>Method</small></th>' : ''}${Nt ? `<th style="width:${wide ? 80 : 150}px">หมายเหตุ</th>` : ''}</tr>`;
  let chunk = [], n = 0; const flushT = () => { if (chunk.length) out.push({ h: `<table class="xct${wide ? ' sm' : ''}">${hd}${chunk.join('')}</table>` }); chunk = []; n = 0; };
  grp.forEach((g, gi) => { if (n + g.items.length > 14) flushT(); chunk.push(g.items.map((c, i) => `<tr class="${gi % 2 ? 'z' : ''}">${i === 0 ? `<td class="pc" rowspan="${g.items.length}">${nl(g.p.replace(/\s*\/\s*/g, '\n'))}</td>` : ''}<td><span class="ck ${c.used ? 'on' : ''}"></span>${esc(c.name)}</td>${A ? `<td>${esc(c.active)}</td>` : ''}${R ? `<td class="rt">${esc(c.ratio)}</td>` : ''}${Mt ? `<td>${esc(c.method)}</td>` : ''}${Nt ? `<td class="nt">${esc(c.note)}</td>` : ''}</tr>`).join('')); n += g.items.length; });
  flushT(); out.push({ h: `<div class="xlegend"><span class="ck on"></span> = สารเคมี/อุปกรณ์ที่ใช้ในการบริการครั้งนี้</div>` });
  return out;
}
const r1 = v => Math.round(v * 10) / 10;
function stTotalOf(b) { const t = sum(b.rows.map(r => sum(r.v))); return b.agg === 'avg' ? (b.rows.length ? r1(t / b.rows.length) : 0) : t; }
function yearKeys() { const ys = +C('yearStart') || 1; const fy = M >= ys ? Y : Y - 1; return Array.from({ length: 12 }, (_, i) => addMonths(mk(fy, ys), i)); }
function piecesStations(b) {
  const out = [{ k: 'h', h: bHead(b.title) }]; const cols = b.cols.length ? b.cols : ['จำนวน']; const multi = cols.length > 1; const f = b.showFound && b.found;
  const hd = `<tr><th style="width:34px">ที่</th><th>สถานที่ / ตำแหน่ง</th>${f ? `<th style="width:70px">${esc(b.found[0])}</th><th style="width:70px">${esc(b.found[1])}</th>` : ''}${cols.map(c => `<th style="width:${multi ? 66 : 92}px">${esc(c)}</th>`).join('')}${multi ? '<th style="width:60px">รวม</th>' : ''}${b.showRemark ? '<th style="width:120px">หมายเหตุ</th>' : ''}</tr>`;
  const row = (x, i) => { const t = sum(x.v); return `<tr class="${i % 2 ? 'z' : ''}${t > 0 ? ' hit' : ''}"><td class="c">${i + 1}</td><td>${esc(x.loc)}</td>${f ? `<td class="c">${t > 0 ? '✓' : ''}</td><td class="c">${t > 0 ? '' : '✓'}</td>` : ''}${x.v.map(v => `<td class="c">${v}</td>`).join('')}${multi ? `<td class="c b">${t}</td>` : ''}${b.showRemark ? `<td class="nt">${esc(x.rem)}</td>` : ''}</tr>`; };
  const tot = cols.map((_, j) => { const t = sum(b.rows.map(x => x.v[j])); return b.agg === 'avg' ? (b.rows.length ? r1(t / b.rows.length) : 0) : t; });
  const totRow = b.showTotal ? `<tr class="tot"><td colspan="${2 + (f ? 2 : 0)}">${b.agg === 'avg' ? 'เฉลี่ย' : 'รวม'} (พบ ${b.rows.filter(x => sum(x.v) > 0).length} จาก ${b.rows.length} จุด)</td>${tot.map(v => `<td class="c">${v}</td>`).join('')}${multi ? `<td class="c">${sum(tot)}</td>` : ''}${b.showRemark ? '<td></td>' : ''}</tr>` : '';
  for (let i = 0; i < b.rows.length; i += 22) { const part = b.rows.slice(i, i + 22).map((x, j) => row(x, i + j)).join(''); out.push({ h: `<table class="xct st">${hd}${part}${i + 22 >= b.rows.length ? totRow : ''}</table>` }); }
  if (!b.rows.length) out.push({ h: '<p class="xnote">— ยังไม่มีจุด —</p>' });
  if (b.chart) {
    const ks = yearKeys(); const vals = ks.map(k => { if (k > curKey()) return null; if (k === curKey()) return stTotalOf(b); const rr = reports[k]; if (!rr || rr._new) return null; const bb = upgrade(rr).blocks.find(x => x.id === b.id); return bb ? stTotalOf(bb) : null; });
    const img = barChart({ w: 680, h: 230, title: (b.chartTitle || 'จำนวนที่พบในแต่ละเดือน') + (b.unit ? ` (${b.unit})` : ''), labels: ks.map(mShort), vals, hi: ks.indexOf(curKey()), alert: b.alert, action: b.action });
    out.push({ h: `<div class="xchart"><img src="${img}" style="width:680px"></div>` });
  }
  if ((b.note || '').trim()) out.push({ h: `<div class="xnote"><b>หมายเหตุ</b> ${nl(b.note)}</div>` });
  return out;
}
function piecesSections(b) {
  const cl = esc(C('client')); const out = [{ k: 'h', h: bHead(b.title) }];
  const rk = n => RISK[+n] ? `<span class="rk ${RISK[+n].cls}">ความเสี่ยง${RISK[+n].label}</span>` : '';
  const withRisk = b.items.filter(s => RISK[+s.risk]);
  if (b.showRiskTable !== false && withRisk.length) out.push({ h: `<table class="xct xrk"><tr><th style="width:34px">ข้อ</th><th style="width:96px">สัตว์พาหะ</th><th style="width:170px">หัวข้อการตรวจ</th><th>ระดับความเสี่ยง · Risk Level</th><th style="width:150px">ความหมาย</th></tr>${b.items.map((s, i) => RISK[+s.risk] ? `<tr><td class="c">${i + 1}</td><td><b>${esc(s.pest || '-')}</b></td><td class="nt">${esc((KINDS[s.kind] || KINDS.area).label)}${s.area ? `<br><small>${esc(s.area)}</small>` : ''}</td><td><div class="rbar">${[1, 2, 3, 4].map(n => `<i class="${n <= +s.risk ? RISK[+s.risk].cls : ''}"></i>`).join('')}${rk(s.risk)}</div></td><td class="nt">${esc(RISK[+s.risk].desc)}</td></tr>` : '').join('')}</table><div class="xlegend">ระดับความเสี่ยง: ต่ำ = ไม่พบตัว/ร่องรอย · ปานกลาง = พบร่องรอยหรือพบเล็กน้อย · สูง = พบชัดเจนหลายจุด · สูงมาก = ระบาด/เสี่ยงปนเปื้อน</div>` });
  b.items.forEach((s, i) => {
    out.push({ k: 'h', h: `<div class="xs-t"><span class="no">${i + 1}</span><span style="flex:1">${esc(s.title)}</span>${b.showRisk !== false ? rk(s.risk) : ''}</div>` });
    if ((s.finding || '').trim()) out.push({ h: `<div class="xs-f"><span class="lab">ผลการตรวจสอบ</span><div>${nl(s.finding)}</div></div>` });
    const adv = (s.adv || []).filter(x => x.trim()), cli = (s.cli || []).filter(x => x.trim());
    if (adv.length || cli.length) out.push({ k: 'h', h: `<div class="xs-a">การปรับปรุงแก้ไข / ข้อเสนอแนะ</div>` });
    if (adv.length) { out.push({ k: 'h', h: `<div class="xs-by adv">โดย บริษัท แอ๊ดวานซ์ กรุ๊ป เอเซีย จำกัด</div>` }); adv.forEach(x => out.push({ h: `<div class="xs-li adv">${nl(x)}</div>` })); }
    if (cli.length) { out.push({ k: 'h', h: `<div class="xs-by cli">โดย ${cl}</div>` }); cli.forEach(x => out.push({ h: `<div class="xs-li cli">${nl(x)}</div>` })); }
    out.push({ k: 'gap', h: '<div class="xs-gap"></div>' });
  });
  return out;
}
function piecesText(b) { const out = []; if ((b.title || '').trim()) out.push({ k: 'h', h: bHead(b.title) }); (b.body || '').split(/\n\s*\n/).filter(s => s.trim()).forEach(p => out.push({ h: `<div class="xp-p">${nl(p.trim())}</div>` })); return out; }
function piecesSign(b) {
  const out = [];
  if (b.showTechs !== false && (b.techs || []).length) { out.push({ k: 'h', h: `<div class="xs-h" style="margin-top:8px">${esc(b.title)}</div>` }); out.push({ h: `<div class="xtech"><ol>${b.techs.map(t => `<li>${esc(t)}</li>`).join('')}</ol></div>` }); }
  if (b.showSign !== false) out.push({ h: `<div class="xsign"><div><div class="ln"></div>ผู้จัดทำรายงาน<br><b>${esc(C('preparer'))}</b><br>${esc(C('preparerTitle'))}</div><div><div class="ln"></div>ผู้รับรายงาน<br><b>${esc(C('client'))}</b><br>วันที่ ........ / ........ / ........</div></div>` });
  return out;
}
function pagesPhotos(b) {
  const per = +b.perPage || 9; const ncol = per === 4 ? 2 : 3; const ph = b.photos.filter(p => p.id && (!p.id.startsWith('up:') || mem[p.id])); const out = [];
  const W = 794 - 2 * 56, GAP = 12, CW = (W - (ncol - 1) * GAP) / ncol, nrow = Math.ceil(per / ncol), MAXH = Math.floor((1123 - 188 - 70 - (nrow - 1) * GAP) / nrow), MINH = Math.min(140, MAXH);
  for (let i = 0; i < ph.length; i += per) {
    const chunk = ph.slice(i, i + per); const rows = []; for (let j = 0; j < chunk.length; j += ncol) rows.push(chunk.slice(j, j + ncol));
    const html = rows.map((row, ri) => { const rh = Math.round(Math.max(MINH, Math.min(MAXH, Math.max(...row.map(p => CW * (p.h || 4) / (p.w || 3))))));
      return `<div class="xr" style="height:${rh}px">${row.map((p, k) => { const ar = (p.w || 3) / (p.h || 4); let w = CW, h = CW / ar; if (h > rh) { h = rh; w = rh * ar; }
        return `<div class="xcell" style="width:${CW}px;height:${rh}px"><div class="xim" style="width:${w}px;height:${h}px;background-image:url('${esc(imgURL(p.id))}')"><span>${i + ri * ncol + k + 1}</span></div></div>`; }).join('')}</div>`; }).join('');
    out.push({ o: 'P', name: b.title + ' หน้า ' + (out.length + 1), html: `<div class="pg P xp">${xHead(b.title)}<div class="xb xg">${html}</div>${xFoot()}</div>` });
  }
  return out;
}
/* หน้าแผนผัง/Layout: 1 รูปต่อหน้า รูปแนวนอน → หน้าแนวนอนอัตโนมัติ */
function pagesLayout(list, title, showTitle, showRev) {
  return (list || []).filter(x => x && x.id && (!x.id.startsWith('up:') || mem[x.id])).map((x, i, all) => {
    const L = (x.w || 4) > (x.h || 3); const Hh = L ? 794 : 1123; const st = showTitle !== false; const top = st ? 108 : 36; const cap = (x.cap || '').trim(); const cb = cap ? 30 : 0;
    const t = title + (all.length > 1 ? ` (${i + 1}/${all.length})` : ''); const rv = showRev !== false && (x.rev || x.eff) ? `<div class="xi-rev">Layout Rev.${x.rev || 1}${x.eff ? `<br><span>มีผลตั้งแต่ ${esc(mName(x.eff))}</span>` : ''}</div>` : '';
    const chg = showRev !== false && (x.note || '').trim() ? `<div class="xi-chg">ปรับปรุงล่าสุด: ${esc(x.note)}</div>` : '';
    return { o: L ? 'L' : 'P', name: t, html: `<div class="pg ${L ? 'L' : 'P'} xp">${st ? `<div class="xi-t"><img src="${LOGO}"><div><b>${esc(t)}</b><span>${esc(C('client'))} · ${esc(mName(curKey()))}</span></div>${rv}</div>` : rv}${chg}
    <div class="xi-img" style="top:${top}px;height:${Hh - top - 56 - cb}px;background-image:url('${esc(imgURL(x.id))}')"></div>${cap ? `<div class="xi-cap" style="top:${Hh - 56 - cb + 4}px">${esc(cap)}</div>` : ''}${xFoot()}</div>` };
  });
}
const pageImage = b => pagesLayout(b.layouts, b.title, b.showTitle, b.showRev);
/* ตัวจัดหน้า: วัดความสูงจริงของทุกชิ้น ไหลต่อเนื่องข้ามบล็อก ขึ้นหน้าใหม่เมื่อเต็ม หรือเมื่อบล็อกตั้ง "เริ่มหน้าใหม่" */
function flowPages(group) {
  const root = $('#measure'); root.innerHTML = `<div class="pg P xp"><div class="xb" style="position:static;display:flow-root;width:${794 - 2 * 56}px"></div></div>`; const body = root.querySelector('.xb');
  const hOf = h => { body.innerHTML = h; return body.getBoundingClientRect().height + 1; };
  const AVAIL = 1123 - 188 - 70; const pages = []; let curr = [], h = 0;
  const brk = () => { while (curr.length && curr[curr.length - 1].k === 'gap') curr.pop(); if (curr.length) pages.push(curr); curr = []; h = 0; };
  group.forEach(({ pieces, newPage }) => {
    if (newPage) brk();
    pieces.forEach(p => {
      const ph = hOf(p.h);
      if (h + ph > AVAIL && curr.length) { const carry = []; while (curr.length > 1 && curr[curr.length - 1].k === 'h' && carry.length < 4) carry.unshift(curr.pop()); brk(); curr = carry; h = carry.reduce((t, x) => t + hOf(x.h), 0); }
      if (p.k === 'gap' && !curr.length) return;
      curr.push(p); h += ph;
    });
  });
  brk(); root.innerHTML = '';
  return pages.map(p => { const t = REPORT_TITLE;
    return { o: 'P', name: [...new Set(p.map(x => x.bt).filter(Boolean))].join(' · ') || t, html: `<div class="pg P xp">${xHead(t)}<div class="xb">${p.map(x => x.h).join('')}</div>${xFoot()}</div>` }; });
}
function buildPages() {
  const r = cur(); const P = []; let flow = [];
  const flushFlow = () => { if (flow.length) P.push(...flowPages(flow)); flow = []; };
  vis(r).forEach(b => {
    if (b.type === 'cover') { flushFlow(); P.push(pageCover(b, r)); return; }
    if (b.type === 'photos') { flushFlow(); P.push(...pagesPhotos(b)); return; }
    if (b.type === 'image') { flushFlow(); P.push(...pageImage(b)); return; }
    const pieces = b.type === 'chem' ? piecesChem(b, r) : b.type === 'stations' ? piecesStations(b) : b.type === 'sections' ? piecesSections(b) : b.type === 'text' ? piecesText(b) : b.type === 'sign' ? piecesSign(b) : [];
    pieces.forEach(p => p.bt = b.title);
    if (pieces.length) flow.push({ pieces, newPage: !!b.newPage });
    if (b.type === 'stations' && b.showLayout !== false && (b.layouts || []).length) { flushFlow(); P.push(...pagesLayout(b.layouts, 'แผนผังตำแหน่ง · ' + b.title, true, b.showRev)); }
  });
  flushFlow();
  const N = P.filter(p => !p.cover).length; let n = 0; P.forEach(p => { if (!p.cover) p.html = p.html.replace('<span class="pno"></span>', `<span class="pno">หน้า ${++n} / ${N}</span>`); });
  return P;
}

/* ───────── UI ───────── */
const TABS = [['info', '1 ข้อมูลลูกค้า & วันบริการ'], ['layout', '2 โครงรายงาน'], ['fill', '3 กรอกข้อมูล'], ['out', '4 ตรวจ & ดาวน์โหลด PDF']];
function goTab(t) { document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x.dataset.t === t)); document.querySelectorAll('section.tab').forEach(s => s.classList.toggle('on', s.id === 't-' + t)); if (t === 'out') renderOut(); if (t === 'fill') renderFill(); if (t === 'layout') renderLayout(); window.scrollTo(0, 0); }
function navRow(t) { const i = TABS.findIndex(x => x[0] === t); const p = TABS[i - 1], n = TABS[i + 1]; return `<div class="row">${p ? `<button class="btn" data-go="${p[0]}">← ย้อนกลับ</button>` : ''}${n ? `<button class="btn pri" data-go="${n[0]}">ถัดไป: ${esc(n[1])} →</button>` : ''}</div>`; }
function bindNav(el) { el.querySelectorAll('[data-go]').forEach(b => b.onclick = () => goTab(b.dataset.go)); }
function renderInfo() {
  const r = cur(); const el = $('#t-info');
  el.innerHTML = `<div class="card"><h2>ข้อมูลลูกค้า <span class="hint">(ใช้กับทุกเดือนของลูกค้ารายนี้)</span></h2><div class="grid2">
  <label class="f">ชื่อลูกค้า<input data-c="client" value="${esc(C('client'))}"></label>
  <label class="f">เลขที่สัญญา (ถ้ามีหลายสัญญา คั่นด้วย ,)<input data-c="contracts" value="${esc((C('contracts') || []).join(', '))}"></label>
  <label class="f">ชื่อผู้จัดทำ<input data-c="preparer" value="${esc(C('preparer'))}"></label>
  <label class="f">ตำแหน่งผู้จัดทำ<input data-c="preparerTitle" value="${esc(C('preparerTitle'))}"></label>
  <div class="f" style="grid-column:1/-1">ชนิดสัตว์พาหะตามสัญญา <span class="hint">(ใช้กับตารางสารเคมี และหัวข้อสรุปผลของทุกแมลง)</span><div class="opts" id="cpests">${pestChoices().map(p => `<label class="opt"><input type="checkbox" data-cp="${esc(p)}" ${cpests().includes(p) ? 'checked' : ''}> ${esc(p)}</label>`).join('')}<input id="cpAdd" placeholder="+ ชนิดอื่น เช่น นก, ตัวเงินตัวทอง" style="width:220px"></div></div>
  <label class="f">บรรทัดชนิดสัตว์พาหะบนหน้าปก<input data-c="pestsLine" id="pestsLine" value="${esc(C('pestsLine'))}"></label>
  <label class="f">กราฟรายเดือนเริ่มนับปีที่เดือน<select data-c="yearStart">${TH_M.map((t, i) => `<option value="${i + 1}" ${+C('yearStart') === i + 1 ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div></div>
  <div class="card"><h2>การเข้าบริการ · ${esc(mName(curKey()))}</h2><div class="grid2"><label class="f">วันที่ทำบริการ<input type="date" id="svcDate" value="${esc(r.svcDate)}"></label></div><p class="hint" id="dh"></p>
  <p class="hint">การแสดง/ซ่อนวันที่ในหน้าปกและหน้าสารเคมี ตั้งได้ในแท็บ 2 "โครงรายงาน" ที่ตัวเลือกของบล็อกนั้น</p></div>${navRow('info')}`;
  el.querySelectorAll('[data-c]').forEach(e => { const f = () => { const k = e.dataset.c; cfg[k] = k === 'contracts' ? e.value.split(',').map(s => s.trim()).filter(Boolean) : k === 'yearStart' ? +e.value : e.value; if (k === 'client') $('#appTitle').textContent = 'รายงาน Custom · ' + e.value; cfgDirty(); }; e.oninput = f; e.onchange = f; });
  el.querySelectorAll('[data-cp]').forEach(e => e.onchange = () => { const all = pestChoices(); const sel = new Set(cpests()); e.checked ? sel.add(e.dataset.cp) : sel.delete(e.dataset.cp); setCPests(all.filter(p => sel.has(p))); });
  const ca = $('#cpAdd'); ca.onkeydown = ev => { if (ev.key !== 'Enter' || !ca.value.trim()) return; const p = ca.value.trim(); cfg.extraPests = [...new Set([...(cfg.extraPests || []), p])]; setCPests([...cpests(), p]); renderInfo(); };
  const d = $('#svcDate'); const dh = () => { $('#dh').innerHTML = r.svcDate && r.svcDate.slice(0, 7) !== curKey() ? '<b style="color:#d92d20">วันที่บริการไม่ตรงกับเดือนที่เลือก</b>' : ''; };
  d.oninput = () => { r.svcDate = d.value; markDirty(); dh(); }; dh();
  bindNav(el);
}
/* ── ชนิดสัตว์พาหะตามสัญญา ── */
const pestChoices = () => [...new Set([...PEST_LIST.map(x => x.p), ...(cfg.extraPests || []), ...(cfg.contractPests || [])])];
const cpests = () => C('contractPests') || [];
function setCPests(list) { const lineAuto = !cfg.pestsLine || cfg.pestsLine === cpests().join('/'); cfg.contractPests = list; if (lineAuto) { cfg.pestsLine = list.join('/'); const pl = $('#pestsLine'); if (pl) pl.value = cfg.pestsLine; } cfgDirty(); }
/* ── ตัวเลือกของแต่ละบล็อก (แท็บโครงรายงาน) ── */
const tog = (k, label, on) => `<label class="opt"><input type="checkbox" data-o="${k}" ${on ? 'checked' : ''}> ${esc(label)}</label>`;
function blockOptions(b) {
  if (b.type === 'cover') return `<label class="f">ชื่อรายงานบนหน้าปก (Enter = ขึ้นบรรทัดใหม่)<textarea data-t="coverTitle" rows="2">${esc(b.coverTitle || 'รายงานการปฏิบัติงาน\nกำจัดแมลงและสัตว์พาหะ')}</textarea></label><div class="opts">${tog('showPests', 'แสดงบรรทัดชนิดสัตว์พาหะ', b.showPests !== false)}${tog('showContract', 'แสดงเลขที่สัญญา', b.showContract !== false)}${tog('showDate', 'แสดงวันที่ทำบริการ', b.showDate !== false)}${tog('showPreparer', 'แสดงผู้จัดทำ', b.showPreparer !== false)}</div>`;
  if (b.type === 'chem') return `<div class="opts">${tog('showInfo', 'แสดงกล่องข้อมูลการบริการ', b.showInfo !== false)}${tog('showDate', 'แสดงวันที่ทำบริการ', b.showDate !== false)}${tog('showActive', 'แสดงคอลัมน์สารออกฤทธิ์', b.showActive !== false)}${tog('showRatio', 'แสดงคอลัมน์อัตราส่วนผสม', b.showRatio !== false)}${tog('showMethod', 'แสดงคอลัมน์วิธีการ', b.showMethod !== false)}${tog('showNote', 'แสดงคอลัมน์หมายเหตุ', b.showNote !== false)}${tog('newPage', 'เริ่มหน้าใหม่', b.newPage)}</div>`;
  if (b.type === 'sections') return `<div class="opts">${tog('showRiskTable', 'แสดงตารางสรุประดับความเสี่ยง', b.showRiskTable !== false)}${tog('showRisk', 'แสดงป้ายระดับความเสี่ยงที่หัวข้อ', b.showRisk !== false)}${tog('newPage', 'เริ่มหน้าใหม่', b.newPage)}</div>`;
  if (b.type === 'stations') return `<div class="grid2"><label class="f">คอลัมน์ตัวเลข (คั่นด้วย , เช่น แมลงวัน, แมลงหวี่, ยุง)<input data-t="colsTxt" value="${esc(b.cols.join(', '))}"></label>
    <label class="f">หน่วย (แสดงในกราฟ)<input data-t="unit" value="${esc(b.unit || '')}"></label>
    <label class="f">หัวคอลัมน์ พบ / ไม่พบ (คั่นด้วย ,)<input data-t="foundTxt" value="${esc((b.found || ['พบ', 'ไม่พบ']).join(', '))}"></label>
    <label class="f">หัวกราฟ<input data-t="chartTitle" value="${esc(b.chartTitle || '')}"></label>
    <label class="f">แถวสรุปและกราฟ<select data-t="agg"><option value="sum" ${b.agg !== 'avg' ? 'selected' : ''}>ผลรวม (เช่น จำนวนตัว / ก้อน)</option><option value="avg" ${b.agg === 'avg' ? 'selected' : ''}>ค่าเฉลี่ยต่อจุด (เช่น % การกินเหยื่อ)</option></select></label>
    <label class="f">เส้น Alert limit ในกราฟ (เว้นว่าง = ไม่แสดง)<input type="number" data-t="alert" value="${b.alert ?? ''}"></label><label class="f">เส้น Action limit ในกราฟ<input type="number" data-t="action" value="${b.action ?? ''}"></label></div>
    <div class="opts">${tog('showFound', 'แสดงคอลัมน์ พบ/ไม่พบ', b.showFound)}${tog('showRemark', 'แสดงคอลัมน์หมายเหตุ', b.showRemark)}${tog('showTotal', 'แสดงแถวรวม', b.showTotal)}${tog('chart', 'แสดงกราฟรายเดือน', b.chart)}${tog('showLayout', 'แสดงหน้าแผนผัง Layout ต่อท้ายตาราง', b.showLayout !== false)}${tog('showRev', 'แสดงเลขฉบับแก้ไข Layout (Rev.)', b.showRev !== false)}${tog('newPage', 'เริ่มหน้าใหม่', b.newPage)}</div>`;
  if (b.type === 'photos') return `<div class="opts"><label class="opt">จำนวนรูปต่อหน้า <select data-t="perPage">${[4, 6, 9].map(n => `<option ${+b.perPage === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>`;
  if (b.type === 'image') return `<div class="opts">${tog('showTitle', 'แสดงหัวข้อด้านบนรูป', b.showTitle !== false)}${tog('showRev', 'แสดงเลขฉบับแก้ไข (Rev.) และวันที่มีผล', b.showRev !== false)}</div>`;
  if (b.type === 'sign') return `<div class="opts">${tog('showTechs', 'แสดงรายชื่อผู้เข้าทำบริการ', b.showTechs !== false)}${tog('showSign', 'แสดงช่องลงนาม', b.showSign !== false)}${tog('newPage', 'เริ่มหน้าใหม่', b.newPage)}</div>`;
  return `<div class="opts">${tog('newPage', 'เริ่มหน้าใหม่', b.newPage)}</div>`;
}
function renderLayout() {
  const r = cur(); const el = $('#t-layout');
  el.innerHTML = `<div class="card"><div class="row"><h2 style="margin:0;flex:1">โครงรายงานเดือน ${esc(mName(curKey()))}</h2><span class="hint">แสดง ${vis(r).length} จาก ${r.blocks.length} บล็อก</span></div>
  <p class="hint">เรียงลำดับด้วย ▲ ▼ · ปุ่ม 👁 ซ่อน/แสดง (ซ่อนแล้วข้อมูลยังอยู่) · แก้ชื่อหัวข้อในช่องได้ · ⧉ ทำสำเนา · เดือนถัดไปใช้โครงนี้ต่อ (ตัวเลขและรูปเริ่มใหม่)</p>
  <div id="blist">${r.blocks.map((b, i) => `<div class="blk ${b.hidden ? 'hid' : ''}" data-i="${i}"><div class="blk-h"><span class="bi">${BLOCK_TYPES[b.type].icon}</span>
  <input class="bt" data-t="title" value="${esc(b.title)}" title="ชื่อหัวข้อในรายงาน"><span class="hint bty">${esc(BLOCK_TYPES[b.type].label)}</span>
  <button class="btn sm" data-a="up" ${i ? '' : 'disabled'}>▲</button><button class="btn sm" data-a="dn" ${i < r.blocks.length - 1 ? '' : 'disabled'}>▼</button>
  <button class="btn sm eye ${b.hidden ? 'off' : ''}" data-a="eye">${b.hidden ? '🚫 ซ่อนอยู่' : '👁 แสดง'}</button><button class="btn sm" data-a="dup" title="ทำสำเนาบล็อก">⧉</button><button class="btn sm del" data-a="del">ลบ</button></div>
  <div class="blk-o">${blockOptions(b)}</div></div>`).join('')}</div></div>
  <div class="card"><h2>+ เพิ่มบล็อก</h2><div class="lib">${Object.entries(BLOCK_TYPES).map(([k, t]) => `<button class="libb" data-add="${k}"><span>${t.icon}</span><b>${esc(t.label)}</b><small>${esc(k === 'stations' ? 'ตารางเปล่า กำหนดคอลัมน์เอง' : t.desc)}</small></button>`).join('')}</div>
  <h3 class="libh">ตารางสถานีสำเร็จรูป <span class="hint">(กดเพื่อเพิ่ม แก้ชื่อจุด/คอลัมน์ได้ภายหลัง)</span></h3><div class="lib">${Object.entries(STATION_TPL).map(([k, t]) => `<button class="libb" data-add="stations" data-tpl="${k}"><span>${t.icon}</span><b>${esc(t.label)}</b><small>${esc(t.desc)}</small></button>`).join('')}</div></div>
  <div class="card"><h2>เริ่มจากแบบฟอร์มตั้งต้น</h2><p class="hint">แทนที่โครงรายงานของเดือนนี้ทั้งหมดด้วยแบบที่เลือก (กดสองครั้งเพื่อยืนยัน) และใช้เป็นแบบเริ่มต้นของลูกค้ารายนี้</p>
  <div class="row">${Object.entries(PRESETS).map(([k, p]) => `<button class="btn" data-pre="${k}">${esc(p.label)}</button>`).join('')}</div></div>${navRow('layout')}`;
  el.querySelectorAll('.blk').forEach(box => { const i = +box.dataset.i, b = r.blocks[i];
    box.querySelectorAll('[data-a]').forEach(btn => btn.onclick = () => { const a = btn.dataset.a;
      if (a === 'up' || a === 'dn') { const j = i + (a === 'up' ? -1 : 1); [r.blocks[i], r.blocks[j]] = [r.blocks[j], r.blocks[i]]; }
      if (a === 'eye') b.hidden = !b.hidden;
      if (a === 'dup') { const c = clone(b); c.id = uid(); c.title += ' (สำเนา)'; if (c.photos) c.photos = []; r.blocks.splice(i + 1, 0, c); }
      if (a === 'del') { if (!btn.dataset.sure) { btn.dataset.sure = 1; btn.textContent = 'ยืนยันลบ'; return; } r.blocks.splice(i, 1); }
      markDirty(); renderLayout(); });
    box.querySelectorAll('[data-o]').forEach(c => c.onchange = () => { b[c.dataset.o] = c.checked; markDirty(); });
    box.querySelectorAll('[data-t]').forEach(e => { const f = () => { const k = e.dataset.t; const v = e.value;
      if (k === 'colsTxt') { const cols = v.split(',').map(s => s.trim()).filter(Boolean); if (!cols.length) return; b.cols = cols; b.rows.forEach(x => { x.v = cols.map((_, j) => x.v[j] || 0); }); }
      else if (k === 'foundTxt') { const fd = v.split(',').map(s => s.trim()); b.found = [fd[0] || 'พบ', fd[1] || 'ไม่พบ']; }
      else if (k === 'alert' || k === 'action') b[k] = v === '' ? null : +v; else if (k === 'perPage') b.perPage = +v; else b[k] = v;
      markDirty(); }; e.oninput = f; e.onchange = f; });
  });
  el.querySelectorAll('[data-add]').forEach(x => x.onclick = () => { const t = x.dataset.tpl && STATION_TPL[x.dataset.tpl]; r.blocks.push(t ? t.make({ newPage: true }) : newBlock(x.dataset.add)); markDirty(); renderLayout(); toast('เพิ่ม "' + (t ? t.label : BLOCK_TYPES[x.dataset.add].label) + '" แล้ว · กรอกข้อมูลในแท็บ 3'); });
  el.querySelectorAll('[data-pre]').forEach(x => x.onclick = () => { if (!x.dataset.sure) { el.querySelectorAll('[data-pre]').forEach(y => { if (y.dataset.sure) { delete y.dataset.sure; y.textContent = PRESETS[y.dataset.pre].label; } }); x.dataset.sure = 1; x.textContent = 'แทนที่โครงทั้งหมด? กดอีกครั้ง'; return; }
    r.blocks = PRESETS[x.dataset.pre].make(); cfg.preset = x.dataset.pre; cfgDirty(); markDirty(); renderLayout(); toast('ใช้แบบฟอร์มแล้ว'); });
  bindNav(el);
}
/* ── แท็บกรอกข้อมูล ── */
function numIn(attrs, v) { return `<input type="number" inputmode="numeric" min="0" step="1" ${attrs} value="${v}" class="num">`; }
function prevBlock(b) { const p = prevReport(curKey()); if (!p) return null; return upgrade(p).blocks.find(x => x.id === b.id) || null; }
function editorOf(b) {
  if (b.type === 'cover') return `<p class="hint">ข้อมูลหน้าปกมาจากแท็บ 1 (ชื่อลูกค้า เลขที่สัญญา ผู้จัดทำ วันที่) · ตัวเลือกการแสดงผลอยู่ในแท็บ 2</p>`;
  if (b.type === 'chem') { const pl = [...new Set([...cpests(), ...b.rows.map(c => c.pest).filter(Boolean)])]; const miss = cpests().filter(p => !b.rows.some(c => c.pest === p));
    return `<div class="row" style="margin-bottom:6px"><button class="btn sm" data-x="all">ติ๊กทั้งหมด</button><button class="btn sm" data-x="none">ไม่ติ๊กทั้งหมด</button>${miss.length ? `<button class="btn sm pri" data-x="fill">+ เพิ่มแถวให้แมลงในสัญญาที่ยังไม่มี (${esc(miss.join(', '))})</button>` : ''}<span class="hint">เลือกชื่อสารจากทะเบียน → สารออกฤทธิ์ อัตราส่วน และวิธีการเติมให้อัตโนมัติ (แก้ไขได้)</span></div>
    <div style="overflow-x:auto"><table class="ed chemed"><tr><th style="width:36px">ใช้</th><th style="width:110px">ชนิดแมลง</th><th style="min-width:200px">ชื่อการค้า (เลือกจากทะเบียน)</th><th>สารออกฤทธิ์</th><th style="width:150px">อัตราส่วนผสม</th><th style="width:130px">วิธีการ</th><th style="width:110px">หมายเหตุ</th><th style="width:120px"></th></tr>
    ${b.rows.map((c, j) => { const ms = masterOf(c.pest); const sel = ms.findIndex(m => m.name === c.name && m.method === c.method); const own = sel < 0;
      return `<tr class="${c.used ? '' : 'off'}"><td><input type="checkbox" data-u="${j}" ${c.used ? 'checked' : ''} style="width:20px;height:20px"></td>
      <td><select data-pest="${j}">${(pl.includes(c.pest) ? pl : [c.pest, ...pl]).map(p => `<option ${p === c.pest ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></td>
      <td><select data-ms="${j}"><option value="">— พิมพ์ชื่อเอง / อุปกรณ์ —</option>${ms.map((m, k) => `<option value="${m.i}" ${k === sel ? 'selected' : ''}>${esc(m.name)} · ${esc(m.method)}</option>`).join('')}</select>${own ? `<input type="text" data-k="name" data-j="${j}" value="${esc(c.name)}" placeholder="ชื่อสาร / อุปกรณ์" style="margin-top:4px">` : ''}</td>
      <td><input type="text" data-k="active" data-j="${j}" value="${esc(c.active)}"></td><td><input type="text" data-k="ratio" data-j="${j}" value="${esc(c.ratio)}"></td><td><input type="text" data-k="method" data-j="${j}" value="${esc(c.method)}"></td><td><input type="text" data-k="note" data-j="${j}" value="${esc(c.note)}"></td>
      <td><button class="btn sm" data-mv="-1" data-j="${j}">▲</button><button class="btn sm" data-mv="1" data-j="${j}">▼</button><button class="btn sm del" data-rm="${j}">ลบ</button></td></tr>`; }).join('')}</table></div>
    <div class="row" style="margin-top:8px"><select data-addp>${pl.map(p => `<option>${esc(p)}</option>`).join('')}</select><button class="btn sm" data-x="add">+ เพิ่มสารเคมีของแมลงนี้</button></div>`; }
  if (b.type === 'stations') { const p = prevBlock(b); const multi = b.cols.length > 1;
    return `<div class="stat" data-stat></div><div style="overflow-x:auto"><table class="ed"><tr><th style="width:40px">ที่</th><th>สถานที่ / ตำแหน่ง</th><th style="width:80px">เดือนก่อน</th>${b.cols.map(c => `<th style="width:92px">${esc(c)}</th>`).join('')}${multi ? '<th style="width:60px">รวม</th>' : ''}${b.showRemark ? '<th>หมายเหตุ</th>' : ''}<th style="width:132px"></th></tr>
    ${b.rows.map((x, j) => `<tr class="${sum(x.v) ? 'hitrow' : ''}"><td><b>${j + 1}</b></td><td><input type="text" data-loc="${j}" value="${esc(x.loc)}"></td><td class="hint">${p && p.rows[j] ? sum(p.rows[j].v) : ''}</td>${x.v.map((v, c) => `<td>${numIn(`data-j="${j}" data-c="${c}"`, v)}</td>`).join('')}${multi ? `<td data-tot="${j}"><b>${sum(x.v)}</b></td>` : ''}${b.showRemark ? `<td><input type="text" data-rem="${j}" value="${esc(x.rem)}"></td>` : ''}
    <td><button class="btn sm" data-mv="-1" data-j="${j}">▲</button><button class="btn sm" data-mv="1" data-j="${j}">▼</button><button class="btn sm del" data-rm="${j}">ลบ</button></td></tr>`).join('')}</table></div>
    <div class="row" style="margin-top:8px"><button class="btn sm" data-x="add">+ เพิ่มจุด</button><button class="btn sm" data-x="bulk">วางรายชื่อจุดหลายบรรทัด</button><button class="btn sm" data-x="zero">ล้างเป็น 0</button>${p ? '<button class="btn sm" data-x="copy">คัดลอกตัวเลขจากเดือนก่อน</button>' : ''}</div>
    <div class="bulk" style="display:none"><textarea rows="6" placeholder="วางรายชื่อจุด บรรทัดละ 1 จุด"></textarea><div class="row"><button class="btn sm pri" data-x="bulkok">ใช้รายชื่อนี้</button><span class="hint">แทนที่ชื่อจุดเดิมตามลำดับ และเพิ่มจุดใหม่ถ้ายาวกว่าเดิม</span></div></div>
    <label class="f" style="margin-top:10px">หมายเหตุท้ายตาราง<textarea data-t="note" rows="2">${esc(b.note || '')}</textarea></label>
    <h3 class="libh">แผนผังตำแหน่งจุดของตารางนี้ (Layout)</h3>${layoutEd(b, 'แนบ Layout ตำแหน่งจุด')}`; }
  if (b.type === 'sections') { const pl = [...new Set([...cpests(), ...b.items.map(s => s.pest).filter(Boolean)])]; const miss = cpests().filter(p => !b.items.some(s => s.pest === p));
    return `<div class="row" style="margin-bottom:8px">${miss.length ? `<button class="btn sm pri" data-x="fill">+ เพิ่มหัวข้อให้แมลงในสัญญาที่ยังไม่มี (${esc(miss.join(', '))})</button>` : '<span class="pill ok">มีหัวข้อครบทุกแมลงตามสัญญา</span>'}<span class="hint">เลือกชนิดสัตว์พาหะและระดับความเสี่ยง → ผลการตรวจและข้อเสนอแนะเติมให้ตามระดับ แก้ไขต่อได้</span></div>
    ${b.items.map((s, j) => `<div class="sec" data-s="${j}"><div class="row"><b>ข้อ ${j + 1}</b><input type="text" data-f="title" value="${esc(s.title)}" style="flex:1;border:1px solid var(--line);border-radius:6px;padding:7px 9px;font-weight:700">
    <button class="btn sm" data-smv="-1">▲</button><button class="btn sm" data-smv="1">▼</button><button class="btn sm del" data-sdel>ลบข้อนี้</button></div>
    <div class="row rkrow"><label>สัตว์พาหะ <select data-sp>${(s.pest && !pl.includes(s.pest) ? [s.pest, ...pl] : pl).map(p => `<option ${p === s.pest ? 'selected' : ''}>${esc(p)}</option>`).join('')}${s.pest ? '' : '<option selected value="">— เลือก —</option>'}</select></label>
    <label>หัวข้อการตรวจ <select data-sk>${kindsFor(s.pest).map(k => `<option value="${k.id}" ${k.id === (s.kind || 'area') ? 'selected' : ''}>${esc(k.label)}</option>`).join('')}</select></label>
    <label>พื้นที่ <input data-sa list="dlArea" value="${esc(s.area || 'ภายในอาคาร')}" style="width:170px"></label></div><div class="row rkrow"><span>ระดับความเสี่ยง</span>${[1, 2, 3, 4].map(n => `<button class="rkb ${RISK[n].cls} ${+s.risk === n ? 'on' : ''}" data-rk="${n}" title="${esc(RISK[n].desc)}">${RISK[n].label}</button>`).join('')}<span class="hint" data-rkh>${RISK[+s.risk] ? esc(RISK[+s.risk].desc) : 'ยังไม่ได้เลือกระดับ'}</span></div>
    <label class="f" style="margin-top:8px">ผลการตรวจสอบ<textarea data-f="finding" rows="3">${esc(s.finding)}</textarea></label>
    <div class="grid2" style="margin-top:8px"><label class="f">ข้อเสนอแนะ โดย บริษัท แอ๊ดวานซ์ กรุ๊ป เอเซีย จำกัด (บรรทัดละ 1 ข้อ)<textarea data-l="adv" rows="4">${esc((s.adv || []).join('\n'))}</textarea></label>
    <label class="f">ข้อเสนอแนะ โดย ${esc(C('client') || 'ลูกค้า')} (บรรทัดละ 1 ข้อ)<textarea data-l="cli" rows="4">${esc((s.cli || []).join('\n'))}</textarea></label></div></div>`).join('')}
    <datalist id="dlArea">${AREAS.map(a => `<option value="${esc(a)}">`).join('')}</datalist>
    <div class="row"><button class="btn sm" data-x="add">+ เพิ่มหัวข้อ</button><button class="btn sm" data-x="reset">สร้างใหม่ตามแมลงในสัญญา (ข้อความตั้งต้น)</button></div>`; }
  if (b.type === 'text') return `<label class="f">เนื้อหา (เว้นบรรทัดว่างเพื่อขึ้นย่อหน้าใหม่)<textarea data-t="body" rows="6">${esc(b.body || '')}</textarea></label>`;
  if (b.type === 'sign') return `<label class="f">รายชื่อผู้เข้าทำบริการ (บรรทัดละ 1 คน)<textarea data-techs rows="4">${esc((b.techs || []).join('\n'))}</textarea></label>`;
  if (b.type === 'photos') return `<div class="drop" data-drop>ลากรูปมาวางที่นี่ หรือ <u>กดเพื่อเลือกหลายรูปพร้อมกัน</u><br><span class="hint">${b.photos.length} รูป · ${Math.ceil(b.photos.length / (+b.perPage || 9)) || 0} หน้า (หน้าละ ${b.perPage || 9} รูป) · หมุนตามที่ถ่ายและจัดแนวตั้ง/นอนอัตโนมัติ</span></div>
    <div class="thumbs">${b.photos.map((p, j) => `<div class="th ${p.id.startsWith('up:') ? 'up' : ''}" style="width:${p.w >= p.h ? 128 : 96}px;height:${p.w >= p.h ? 96 : 128}px;background-image:url('${esc(imgURL(p.id))}')"><span class="idx">${j + 1}</span><div class="ctl"><button data-mv="-1" data-j="${j}">◀</button><button data-rm="${j}">✕</button><button data-mv="1" data-j="${j}">▶</button></div></div>`).join('')}</div>
    ${b.photos.length ? '<button class="btn sm del" data-x="clear">ลบรูปทั้งหมด</button>' : ''}`;
  if (b.type === 'image') return layoutEd(b, 'แนบแผนผัง / Layout / เอกสาร');
  return '';
}
function laterKeys(b) { return Object.keys(reports).filter(k => k > curKey() && !reports[k]._new && (upgrade(reports[k]).blocks || []).some(x => x.id === b.id)).sort(); }
function layoutEd(b, intro) {
  const L = b.layouts || [], H = b.layoutHist || [];
  const card = (x, j) => `<div class="lay-i"><div class="th ${x.id.startsWith('up:') ? 'up' : ''}" style="width:${x.w >= x.h ? 160 : 113}px;height:${x.w >= x.h ? 113 : 160}px;background-image:url('${esc(imgURL(x.id))}')"><span class="idx">${j + 1}</span><div class="ctl"><button data-lmv="-1" data-j="${j}">◀</button><button data-lrm="${j}">✕</button><button data-lmv="1" data-j="${j}">▶</button></div></div>
    <div class="lay-rev"><b>Rev.${x.rev || 1}</b> · มีผล ${esc(mShort(x.eff || curKey()))}</div>
    <input data-lcap="${j}" value="${esc(x.cap || '')}" placeholder="คำอธิบายใต้แผนผัง เช่น ชั้น 1">
    <button class="btn sm" data-lrep="${j}" title="อัปโหลดเลเอ้าใหม่แทนแผ่นนี้ เก็บแผ่นเดิมไว้ในประวัติ">🔄 เปลี่ยนเลเอ้าแผ่นนี้</button>
    ${(x.rev || 1) > 1 ? `<input data-lnote="${j}" value="${esc(x.note || '')}" placeholder="สิ่งที่ปรับเปลี่ยน เช่น เพิ่มจุดที่ 6">` : ''}</div>`;
  const later = laterKeys(b);
  return `<div class="lay"><div class="drop" data-ld>📎 ${intro} — ลากไฟล์มาวาง หรือ <u>กดเพื่อเลือก</u> (รูปภาพ หรือไฟล์ PDF หลายหน้าได้)<br><span class="hint">${L.length} แผ่น · 1 แผ่นต่อหน้า · แนวนอนเป็นหน้าแนวนอนอัตโนมัติ · ใช้ต่อในเดือนถัดไป · ถ้าหน้างานเปลี่ยน กด 🔄 เพื่อออกฉบับแก้ไขใหม่ (Rev.)</span></div>
  ${L.length ? `<div class="lays thumbs">${L.map(card).join('')}</div>` : ''}
  ${b._layChanged && later.length ? `<div class="lay-later">เดือนถัดไปที่บันทึกไว้แล้ว (${esc(later.map(mShort).join(', '))}) ยังใช้เลเอ้าชุดเดิม <button class="btn sm pri" data-lsync>ใช้เลเอ้าชุดนี้กับเดือนเหล่านั้นด้วย</button></div>` : ''}
  ${H.length ? `<details class="lay-h"><summary>ประวัติการปรับเปลี่ยนเลเอ้า (${H.length} ฉบับเดิม)</summary><table class="ed"><tr><th style="width:130px">แผ่นเดิม</th><th>ฉบับ</th><th>ช่วงที่ใช้</th><th>คำอธิบาย / การแก้ไข</th><th style="width:170px"></th></tr>
    ${H.map((x, k) => `<tr><td><div class="th" style="position:relative;width:${x.w >= x.h ? 120 : 85}px;height:${x.w >= x.h ? 85 : 120}px;background:#fff url('${esc(imgURL(x.id))}') center/contain no-repeat;border:1px solid var(--line)"></div></td><td><b>Rev.${x.rev || 1}</b></td><td>${esc(mShort(x.eff || ''))} – ${esc(mShort(x.until || ''))}</td><td>${esc(x.cap || '')}${x.note ? `<br><span class="hint">${esc(x.note)}</span>` : ''}</td>
    <td><button class="btn sm" data-lback="${k}">นำกลับมาใช้</button><button class="btn sm del" data-lhdel="${k}">ลบ</button></td></tr>`).join('')}</table></details>` : ''}</div>`;
}
function bindLayout(box, b, re) {
  const d = box.querySelector('[data-ld]'); if (!d) return; const fi = $('#fileIn'); b.layouts = b.layouts || [];
  const eff = curKey(); b.layoutHist = b.layoutHist || [];
  const take = async fs => { fs = await expandPdf(fs); fs = fs.filter(f => f.type.startsWith('image/')); if (!fs.length) return; const n0 = b.layouts.length; uploadMany(fs, b.layouts, () => { b.layouts.slice(n0).forEach(x => { if (!x.rev) { x.rev = 1; x.eff = eff; } }); b._layChanged = true; re(); }, 2600); };
  const pick = (multi, fn) => { fi.multiple = multi; fi.accept = 'image/*,application/pdf'; fi.onchange = async () => { const fs = [...fi.files]; fi.value = ''; fi.accept = 'image/*'; fn(fs); }; fi.click(); };
  d.onclick = () => pick(true, take);
  box.querySelectorAll('[data-lrep]').forEach(x => x.onclick = () => pick(false, async fs => { fs = (await expandPdf(fs.slice(0, 1))).filter(f => f.type.startsWith('image/')).slice(0, 1); if (!fs.length) return;
    const j = +x.dataset.lrep, old = b.layouts[j]; const tmp = []; x.textContent = 'กำลังอัปโหลด…';
    uploadMany(fs, tmp, () => { const nw = tmp[0]; if (!nw || nw.id.startsWith('up:')) return; const i = b.layouts.indexOf(old); if (i < 0) return;
      b.layoutHist.unshift(Object.assign({}, old, { until: eff, eff: old.eff || eff }));
      b.layouts[i] = { id: nw.id, w: nw.w, h: nw.h, cap: old.cap || '', rev: (old.rev || 1) + 1, eff, note: '' }; b._layChanged = true; markDirty(); re(); toast('ออกเลเอ้าฉบับแก้ไข Rev.' + b.layouts[i].rev + ' แล้ว · ใส่สิ่งที่ปรับเปลี่ยนได้ใต้รูป'); }, 2600); }));
  box.querySelectorAll('[data-lnote]').forEach(x => x.oninput = () => { b.layouts[+x.dataset.lnote].note = x.value; markDirty(); });
  box.querySelectorAll('[data-lback]').forEach(x => x.onclick = () => { const k = +x.dataset.lback, h = b.layoutHist[k]; const rev = Math.max(0, ...b.layouts.map(y => y.rev || 1), ...b.layoutHist.map(y => y.rev || 1)) + 1;
    b.layouts.push({ id: h.id, w: h.w, h: h.h, cap: h.cap || '', rev, eff, note: `นำเลเอ้า Rev.${h.rev || 1} กลับมาใช้` }); b._layChanged = true; markDirty(); re(); toast('นำกลับมาเป็นแผ่นที่ ' + b.layouts.length + ' (ลบแผ่นปัจจุบันที่ไม่ใช้ได้)'); });
  box.querySelectorAll('[data-lhdel]').forEach(x => x.onclick = () => { if (!x.dataset.sure) { x.dataset.sure = 1; x.textContent = 'ยืนยันลบ'; return; } b.layoutHist.splice(+x.dataset.lhdel, 1); markDirty(); re(); });
  const sy = box.querySelector('[data-lsync]'); if (sy) sy.onclick = () => { const ks = laterKeys(b); ks.forEach(k => { const bb = upgrade(reports[k]).blocks.find(y => y.id === b.id); if (bb) { bb.layouts = clone(b.layouts); bb.layoutHist = clone(b.layoutHist); pending.add(k); } }); delete b._layChanged; markDirty(); re(); toast('อัปเดตเลเอ้า ' + ks.length + ' เดือนแล้ว'); };
  d.ondragover = e => { e.preventDefault(); d.classList.add('ov'); }; d.ondragleave = () => d.classList.remove('ov'); d.ondrop = e => { e.preventDefault(); d.classList.remove('ov'); take([...e.dataTransfer.files]); };
  box.querySelectorAll('[data-lmv]').forEach(x => x.onclick = () => { const j = +x.dataset.j, k = j + +x.dataset.lmv; if (k < 0 || k >= b.layouts.length) return; [b.layouts[j], b.layouts[k]] = [b.layouts[k], b.layouts[j]]; markDirty(); re(); });
  box.querySelectorAll('[data-lrm]').forEach(x => x.onclick = () => { if (!x.dataset.sure) { x.dataset.sure = 1; x.textContent = '?'; return; } const o = b.layouts.splice(+x.dataset.lrm, 1)[0]; if (o && o.id && !o.id.startsWith('up:') && (o.eff || '') < eff) b.layoutHist.unshift(Object.assign({}, o, { until: eff, note: (o.note ? o.note + ' · ' : '') + 'ยกเลิกแผ่นนี้' })); b._layChanged = true; markDirty(); re(); });
  box.querySelectorAll('[data-lcap]').forEach(x => x.oninput = () => { b.layouts[+x.dataset.lcap].cap = x.value; markDirty(); });
}
/* PDF → รูปภาพทีละหน้า (โหลด pdf.js เมื่อใช้ครั้งแรก) */
let pdfjsP = null;
function loadPdfjs() { return pdfjsP || (pdfjsP = new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'lib/pdf.min.js'; s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js'; ok(window.pdfjsLib); }; s.onerror = () => { pdfjsP = null; no(new Error('โหลดตัวอ่าน PDF ไม่สำเร็จ')); }; document.head.appendChild(s); })); }
async function expandPdf(files) {
  const out = [];
  for (const f of files) {
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { out.push(f); continue; }
    try { setStatus('กำลังแปลง PDF…'); const lib = await loadPdfjs(); const doc = await lib.getDocument({ data: await f.arrayBuffer() }).promise; const n = Math.min(doc.numPages, 30);
      for (let i = 1; i <= n; i++) { setStatus(`กำลังแปลง PDF หน้า ${i}/${n}`); const pg = await doc.getPage(i); const v0 = pg.getViewport({ scale: 1 }); const sc = Math.min(3, 2600 / Math.max(v0.width, v0.height)); const v = pg.getViewport({ scale: sc });
        const cv = document.createElement('canvas'); cv.width = Math.round(v.width); cv.height = Math.round(v.height); const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
        await pg.render({ canvasContext: g, viewport: v }).promise; const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9)); out.push(new File([blob], f.name.replace(/\.pdf$/i, '') + '-p' + i + '.jpg', { type: 'image/jpeg' })); }
      if (doc.numPages > 30) toast('PDF มีมากกว่า 30 หน้า ใช้ 30 หน้าแรก'); }
    catch (e) { toast('อ่านไฟล์ PDF ไม่สำเร็จ: ' + e.message); }
  }
  return out;
}
const edHead = b => `<h2>${BLOCK_TYPES[b.type].icon} ${esc(b.title)} <span class="hint">· ${esc(BLOCK_TYPES[b.type].label)}</span></h2>`;
function renderFill() {
  const r = cur(); const el = $('#t-fill');
  const list = r.blocks.map((b, i) => ({ b, i })).filter(x => !x.b.hidden);
  el.innerHTML = `<p class="hint">กรอกตามลำดับบล็อกในรายงาน · บล็อกที่ซ่อนไว้จะไม่แสดงที่นี่ (เปิดได้ที่แท็บ 2)</p>
  ${list.map(({ b, i }) => `<div class="card fb" data-i="${i}">${edHead(b)}${editorOf(b)}</div>`).join('') || '<div class="card"><p class="hint">ยังไม่มีบล็อก — เพิ่มได้ที่แท็บ 2</p></div>'}${navRow('fill')}`;
  el.querySelectorAll('.fb').forEach(box => bindEditor(box, r.blocks[+box.dataset.i]));
  bindNav(el);
}
function bindEditor(box, b) {
  const re = () => { const y = window.scrollY; box.innerHTML = edHead(b) + editorOf(b); bindEditor(box, b); window.scrollTo(0, y); };
  const q = s => box.querySelectorAll(s);
  q('[data-t]').forEach(e => e.oninput = () => { b[e.dataset.t] = e.value; markDirty(); });
  if (b.type === 'chem') {
    q('[data-u]').forEach(e => e.onchange = () => { b.rows[+e.dataset.u].used = e.checked; e.closest('tr').classList.toggle('off', !e.checked); markDirty(); });
    q('input[data-k]').forEach(e => e.oninput = () => { b.rows[+e.dataset.j][e.dataset.k] = e.value; markDirty(); });
    q('[data-mv]').forEach(x => x.onclick = () => { const j = +x.dataset.j, k = j + +x.dataset.mv; if (k < 0 || k >= b.rows.length) return; [b.rows[j], b.rows[k]] = [b.rows[k], b.rows[j]]; markDirty(); re(); });
    q('[data-rm]').forEach(x => x.onclick = () => { if (!x.dataset.sure) { x.dataset.sure = 1; x.textContent = 'ยืนยัน'; return; } b.rows.splice(+x.dataset.rm, 1); markDirty(); re(); });
    const putAfter = (p, row) => { let k = -1; b.rows.forEach((c, i) => { if (c.pest === p) k = i; }); b.rows.splice(k < 0 ? b.rows.length : k + 1, 0, row); };
    const firstOf = p => { const m = masterOf(p)[0]; return m ? { pest: p, name: m.name, active: m.active, ratio: m.ratio, method: m.method, used: true, note: '' } : { pest: p, name: '', active: '', ratio: '', method: '', used: true, note: '' }; };
    q('[data-pest]').forEach(e => e.onchange = () => { const c = b.rows[+e.dataset.pest]; c.pest = e.value; if (!findMaster(c.pest, c.name)) Object.assign(c, firstOf(c.pest), { used: c.used, note: c.note }); markDirty(); re(); });
    q('[data-ms]').forEach(e => e.onchange = () => { const c = b.rows[+e.dataset.ms]; if (e.value === '') { c.name = ''; c.active = ''; c.ratio = ''; c.method = ''; } else { const m = CHEM_MASTER[+e.value]; c.name = m[1]; c.active = m[2]; c.ratio = m[3]; c.method = m[4]; } markDirty(); re(); });
    q('[data-x]').forEach(x => x.onclick = () => { const a = x.dataset.x; if (a === 'all' || a === 'none') b.rows.forEach(c => c.used = a === 'all');
      if (a === 'add') { const p = box.querySelector('[data-addp]').value; putAfter(p, firstOf(p)); }
      if (a === 'fill') cpests().filter(p => !b.rows.some(c => c.pest === p)).forEach(p => b.rows.push(firstOf(p)));
      markDirty(); re(); });
  }
  if (b.type === 'stations') {
    const upd = () => { const tot = stTotalOf(b); const hit = b.rows.filter(x => sum(x.v) > 0).length; const s = box.querySelector('[data-stat]'); if (s) s.innerHTML = `<span>พบ <b>${hit}</b> / ${b.rows.length} จุด</span><span>${b.agg === 'avg' ? 'เฉลี่ย' : 'รวม'} <b>${tot}</b> ${esc(b.unit || '')}</span>${b.action != null && tot >= b.action ? '<span class="pill r4">เกิน Action limit</span>' : b.alert != null && tot >= b.alert ? '<span class="pill r3">เกิน Alert limit</span>' : ''}`; };
    const ins = [...q('input.num')];
    ins.forEach((inp, n) => { inp.onfocus = () => inp.select();
      inp.oninput = () => { let v = inp.value === '' ? 0 : Math.round(+inp.value); if (isNaN(v) || v < 0) v = 0; if (b.max != null && v > b.max) { v = b.max; inp.value = v; } const x = b.rows[+inp.dataset.j]; x.v[+inp.dataset.c] = v; inp.closest('tr').classList.toggle('hitrow', sum(x.v) > 0); const t = box.querySelector(`[data-tot="${inp.dataset.j}"] b`); if (t) t.textContent = sum(x.v); upd(); markDirty(); };
      inp.onblur = () => { if (inp.value === '') inp.value = 0; };
      inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); (ins[n + 1] || inp).focus(); } }; });
    q('[data-loc]').forEach(e => e.oninput = () => { b.rows[+e.dataset.loc].loc = e.value; markDirty(); });
    q('[data-rem]').forEach(e => e.oninput = () => { b.rows[+e.dataset.rem].rem = e.value; markDirty(); });
    q('[data-mv]').forEach(x => x.onclick = () => { const j = +x.dataset.j, k = j + +x.dataset.mv; if (k < 0 || k >= b.rows.length) return; [b.rows[j], b.rows[k]] = [b.rows[k], b.rows[j]]; markDirty(); re(); });
    q('[data-rm]').forEach(x => x.onclick = () => { if (!x.dataset.sure) { x.dataset.sure = 1; x.textContent = 'ยืนยัน'; return; } b.rows.splice(+x.dataset.rm, 1); markDirty(); re(); });
    q('[data-x]').forEach(x => x.onclick = () => { const a = x.dataset.x;
      if (a === 'bulk') { const bx = box.querySelector('.bulk'); bx.style.display = bx.style.display === 'none' ? 'block' : 'none'; return; }
      if (a === 'bulkok') { const t = box.querySelector('.bulk textarea').value; lines(t).forEach((l, j) => { if (b.rows[j]) b.rows[j].loc = l; else b.rows.push({ loc: l, v: b.cols.map(() => 0), rem: '' }); }); }
      if (a === 'add') b.rows.push({ loc: 'จุดที่ ' + (b.rows.length + 1), v: b.cols.map(() => 0), rem: '' });
      if (a === 'zero') b.rows.forEach(r => r.v = r.v.map(() => 0));
      if (a === 'copy') { const p = prevBlock(b); if (p) b.rows.forEach((r, j) => { if (p.rows[j]) r.v = b.cols.map((_, c) => p.rows[j].v[c] || 0); }); }
      markDirty(); re(); });
    upd();
  }
  if (b.type === 'sections') {
    q('[data-s]').forEach(sb => { const j = +sb.dataset.s, s = b.items[j];
      sb.querySelectorAll('[data-f]').forEach(e => e.oninput = () => { s[e.dataset.f] = e.value; markDirty(); });
      sb.querySelectorAll('[data-l]').forEach(e => e.oninput = () => { s[e.dataset.l] = lines(e.value); markDirty(); });
      const autoTxt = () => { const a = adviceOf(s.pest, s.risk || 1, s.kind, s.area); return a.finding + a.adv.join() + a.cli.join(); };
      const edited = () => (s.finding || '') + (s.adv || []).join() + (s.cli || []).join() !== s._auto && ((s.finding || '').trim() || (s.adv || []).length);
      const apply = (keepTitle) => { const a = adviceOf(s.pest, s.risk || 1, s.kind, s.area); if (!keepTitle) s.title = a.title; s.finding = a.finding; s.adv = a.adv; s.cli = a.cli; s._auto = autoTxt(); markDirty(); re(); };
      const ask = (fn) => { if (!s.pest) { markDirty(); re(); return; } if (!edited()) return fn(); const bar = sb.querySelector('[data-rkh]'); bar.innerHTML = '<b style="color:#b54708">ข้อความถูกแก้ไขไว้ — </b><button class="btn sm pri" data-ok>แทนที่ด้วยข้อความตามระดับ</button> <button class="btn sm" data-no>คงข้อความเดิม</button>'; bar.querySelector('[data-ok]').onclick = fn; bar.querySelector('[data-no]').onclick = () => { markDirty(); re(); }; };
      const retitle = () => { s.title = titleOf(s.pest, s.kind, s.area); sb.querySelector('[data-f=title]').value = s.title; };
      sb.querySelector('[data-sp]').onchange = e => { s.pest = e.target.value; if (!kindsFor(s.pest).some(k => k.id === s.kind)) s.kind = 'area'; retitle(); ask(() => apply(false)); };
      sb.querySelector('[data-sk]').onchange = e => { s.kind = e.target.value; retitle(); ask(() => apply(false)); };
      const sa = sb.querySelector('[data-sa]'); sa.onchange = () => { s.area = sa.value.trim() || 'ภายในอาคาร'; retitle(); ask(() => apply(false)); };
      sb.querySelectorAll('[data-rk]').forEach(x => x.onclick = () => { s.risk = +x.dataset.rk; sb.querySelectorAll('[data-rk]').forEach(y => y.classList.toggle('on', y === x)); ask(() => apply(true)); });
      sb.querySelectorAll('[data-smv]').forEach(x => x.onclick = () => { const k = j + +x.dataset.smv; if (k < 0 || k >= b.items.length) return; [b.items[j], b.items[k]] = [b.items[k], b.items[j]]; markDirty(); re(); });
      const d = sb.querySelector('[data-sdel]'); d.onclick = () => { if (!d.dataset.sure) { d.dataset.sure = 1; d.textContent = 'กดอีกครั้งเพื่อลบ'; return; } b.items.splice(j, 1); markDirty(); re(); }; });
    const mk = p => { const o = mkSection(p, 1); o._auto = o.finding + o.adv.join() + o.cli.join(); return o; };
    q('[data-x]').forEach(x => x.onclick = () => { if (x.dataset.x === 'add') b.items.push({ title: 'สรุปผลการตรวจเช็ค … พื้นที่ภายในอาคาร', pest: '', risk: 0, kind: 'area', area: 'ภายในอาคาร', finding: '', adv: [], cli: [] });
      if (x.dataset.x === 'fill') cpests().filter(p => !b.items.some(s => s.pest === p)).forEach(p => b.items.push(mk(p)));
      if (x.dataset.x === 'reset') { if (!x.dataset.sure) { x.dataset.sure = 1; x.textContent = 'แทนที่ข้อความทั้งหมด? กดอีกครั้ง'; return; } b.items = cpests().map(mk); } markDirty(); re(); });
  }
  if (b.type === 'sign') { const t = box.querySelector('[data-techs]'); t.oninput = () => { b.techs = lines(t.value); markDirty(); }; }
  if (b.type === 'stations' || b.type === 'image') bindLayout(box, b, re);
  if (b.type === 'photos') {
    const fi = $('#fileIn'); const d = box.querySelector('[data-drop]');
    const take = fs => { fs = fs.filter(f => f.type.startsWith('image/')); if (!fs.length) return;
      uploadMany(fs, b.photos, re); };
    d.onclick = () => { fi.multiple = true; fi.onchange = () => { const fs = [...fi.files]; fi.value = ''; take(fs); }; fi.click(); };
    d.ondragover = e => { e.preventDefault(); d.classList.add('ov'); }; d.ondragleave = () => d.classList.remove('ov'); d.ondrop = e => { e.preventDefault(); d.classList.remove('ov'); take([...e.dataTransfer.files]); };
    q('[data-mv]').forEach(x => x.onclick = () => { const j = +x.dataset.j, k = j + +x.dataset.mv; if (k < 0 || k >= b.photos.length) return; [b.photos[j], b.photos[k]] = [b.photos[k], b.photos[j]]; markDirty(); re(); });
    q('[data-rm]').forEach(x => x.onclick = () => { b.photos.splice(+x.dataset.rm, 1); markDirty(); re(); });
    q('[data-x]').forEach(x => x.onclick = () => { if (!x.dataset.sure) { x.dataset.sure = 1; x.textContent = 'กดอีกครั้งเพื่อยืนยัน'; return; } b.photos = []; markDirty(); re(); });
  }
}
function issues() {
  const r = cur(); const out = []; const vb = vis(r);
  if (!C('client')) out.push(['bad', 'ยังไม่ได้ใส่ชื่อลูกค้า']);
  const needDate = vb.some(b => (b.type === 'cover' || (b.type === 'chem' && b.showInfo !== false)) && b.showDate !== false);
  if (!r.svcDate) out.push([needDate ? 'bad' : 'warn', 'ยังไม่ได้ใส่วันที่ทำบริการ']); else if (r.svcDate.slice(0, 7) !== curKey()) out.push(['bad', 'วันที่ทำบริการไม่อยู่ในเดือนที่เลือก']);
  if (!vb.length) out.push(['bad', 'ยังไม่มีบล็อกที่แสดงในรายงาน']);
  vb.forEach(b => {
    if (b.type === 'chem' && !b.rows.some(c => c.used)) out.push(['warn', `${b.title}: ยังไม่ได้ติ๊กสารเคมีที่ใช้`]);
    if (b.type === 'chem') { const m = cpests().filter(p => !b.rows.some(c => c.pest === p)); if (m.length) out.push(['warn', `${b.title}: ยังไม่มีสารเคมีของ ${m.join(', ')} (ตามสัญญา)`]); }
    if (b.type === 'sections') { const m = cpests().filter(p => !b.items.some(s => s.pest === p)); if (m.length) out.push(['warn', `${b.title}: ยังไม่มีหัวข้อสรุปผลของ ${m.join(', ')} (ตามสัญญา)`]);
      const nr = b.items.filter(s => !RISK[+s.risk]).length; if (nr) out.push(['warn', `${b.title}: ${nr} หัวข้อยังไม่ได้เลือกระดับความเสี่ยง`]); }
    if (b.type === 'sign' && b.showTechs !== false && !(b.techs || []).length) out.push(['bad', `${b.title}: ยังไม่ได้ใส่รายชื่อผู้เข้าทำบริการ`]);
    if (b.type === 'photos' && !b.photos.length) out.push(['warn', `${b.title}: ยังไม่มีรูป (บล็อกนี้จะไม่ขึ้นในรายงาน)`]);
    if (b.type === 'image' && !(b.layouts || []).length) out.push(['warn', `${b.title}: ยังไม่ได้ใส่รูป (บล็อกนี้จะไม่ขึ้นในรายงาน)`]);
    if (b.type === 'stations' && b.action != null && stTotalOf(b) >= b.action) out.push(['warn', `${b.title}: ยอดรวม ${stTotalOf(b)} เกิน Action limit (${b.action})`]);
  });
  if (JSON.stringify(r).includes('"up:')) out.push(['bad', 'รูปยังอัปโหลดไม่เสร็จ']);
  if (!out.length) out.push(['ok', 'ครบถ้วน พร้อมดาวน์โหลด']); return out;
}
function renderOut() {
  const el = $('#t-out');
  el.innerHTML = `<div class="card"><h2>ตรวจก่อนดาวน์โหลด</h2><ul class="checks">${issues().map(([c, t]) => `<li class="${c}">${c === 'ok' ? '✓' : c === 'warn' ? '!' : '•'} ${esc(t)}</li>`).join('')}</ul></div>
  <div class="card"><h2>ดาวน์โหลด PDF</h2><div class="row"><button class="btn pri" id="btnPdf">ดาวน์โหลด PDF ทั้งเล่ม</button><span class="hint" id="pdfInfo"></span></div><div class="prog" id="prog" style="display:none"><i></i></div><p class="hint" id="pdfMsg"></p></div>
  <div class="card"><div class="row"><h2 style="margin:0;flex:1">ตัวอย่างทุกหน้า</h2><button class="btn sm" id="btnPreview">สร้างตัวอย่าง</button></div><div id="preview"><p class="hint">กด "สร้างตัวอย่าง" เพื่อดูทุกหน้า</p></div></div>
  <div class="card danger"><h2>ลบรายงาน</h2><p class="hint">ลบรายงานเดือน ${esc(mName(curKey()))} ของ ${esc(C('client'))} ออกจากระบบ (ลบแล้วกู้คืนไม่ได้)</p><button class="btn del" id="btnDelRep">ลบรายงานเดือนนี้</button></div>`;
  $('#btnPreview').onclick = renderPreview; $('#btnPdf').onclick = downloadPdf;
  const dr = $('#btnDelRep'); dr.onclick = async () => {
    if (!dr.dataset.sure) { dr.dataset.sure = 1; dr.textContent = 'ยืนยันลบรายงานเดือน ' + mName(curKey()) + ' — กดอีกครั้ง'; setTimeout(() => { if (dr.isConnected) { delete dr.dataset.sure; dr.textContent = 'ลบรายงานเดือนนี้'; } }, 5000); return; }
    dr.disabled = true; const k = curKey(); pending.delete(k); clearTimeout(saveTimer);
    try { await rpc('lad_custom_delete_report', { p_site: SITE, p_month: k }); delete reports[k]; delete STATUS[k]; toast('ลบรายงานเดือน ' + mName(k) + ' แล้ว'); renderAll(); goTab('info'); setStatus('ลบแล้ว'); }
    catch (e) { toast('ลบไม่สำเร็จ: ' + e.message); dr.disabled = false; } };
}
function renderPreview() {
  const pages = buildPages(); const box = $('#preview'); const sc = Math.min(1, (box.clientWidth || 900) / 1180) * 0.7;
  box.innerHTML = pages.map(p => { const w = p.o === 'L' ? 1123 : 794, h = p.o === 'L' ? 794 : 1123; return `<div class="pvlab">${esc(p.name)}</div><div class="pvw" style="width:${w * sc}px;height:${h * sc}px">${p.html.replace('class="pg ', `style="transform:scale(${sc})" class="pg `)}</div>`; }).join('');
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
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => rej(new Error('โหลดรูปไม่ได้')); i.src = src; }); }
async function waitImgs(el) {
  await Promise.all([...el.querySelectorAll('img')].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  const bgs = [...el.querySelectorAll('[style*="background-image"]')].map(d => (d.style.backgroundImage.match(/url\("?(.*?)"?\)/) || [])[1]).filter(Boolean);
  await Promise.all(bgs.map(s => loadImg(s).catch(() => 0)));
}
async function makePdf(onProg) {
  const { jsPDF } = window.jspdf; await document.fonts.ready; const pages = buildPages(); const root = $('#exportRoot'); const fcss = await getFontCSS(); let pdf = null;
  for (let i = 0; i < pages.length; i++) { const o = pages[i].o === 'L' ? 'landscape' : 'portrait';
    if (!pdf) pdf = new jsPDF({ orientation: o, unit: 'mm', format: 'a4', compress: true }); else pdf.addPage('a4', o);
    root.innerHTML = pages[i].html; const el = root.firstElementChild; await waitImgs(el);
    const url = await htmlToImage.toJpeg(el, { quality: .9, pixelRatio: 1.8, backgroundColor: '#ffffff', fontEmbedCSS: fcss, cacheBust: false });
    pdf.addImage(url, 'JPEG', 0, 0, o === 'landscape' ? 297 : 210, o === 'landscape' ? 210 : 297, undefined, 'FAST'); onProg && onProg((i + 1) / pages.length, i + 1, pages.length); await new Promise(r => setTimeout(r, 0)); }
  root.innerHTML = ''; return pdf.output('blob');
}
async function downloadPdf() {
  const b = $('#btnPdf'); b.disabled = true; $('#prog').style.display = 'block'; const bar = $('#prog i');
  try { await flush(); const blob = await makePdf((f, i, n) => { bar.style.width = (f * 100) + '%'; $('#pdfMsg').textContent = `กำลังสร้างหน้า ${i}/${n}`; });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `รายงานการปฏิบัติงาน ${C('client')} เดือน${mName(curKey())}.pdf`; a.textContent = 'ถ้าไฟล์ไม่ดาวน์โหลดเอง กดที่นี่';
    $('#pdfMsg').innerHTML = 'ดาวน์โหลดแล้ว ✓ (' + (blob.size / 1048576).toFixed(1) + ' MB) · '; $('#pdfMsg').appendChild(a); a.click();
  } catch (e) { console.error(e); $('#pdfMsg').textContent = 'สร้าง PDF ไม่สำเร็จ: ' + (e.message || e); }
  b.disabled = false;
}
window.__buildPages = buildPages; window.__makePdf = makePdf;

/* ───────── customer list ───────── */
async function showList() {
  document.body.classList.add('listmode'); $('#appTitle').textContent = 'รายงานฉบับ Custom · เลือกลูกค้า'; setStatus('');
  const box = $('#list'); box.innerHTML = '<p class="hint">กำลังโหลด…</p>';
  let L = []; try { L = await rpc('lad_custom_list') || []; } catch (e) { box.innerHTML = '<p class="hint">โหลดรายชื่อไม่สำเร็จ</p>'; return; }
  box.innerHTML = `<div class="card"><h2>ลูกค้าที่ใช้รายงานฉบับ Custom</h2><div class="clist">${L.map(c => `<div class="ctile"><a href="#c=${esc(c.id)}"><b>${esc(c.name)}</b><span class="hint">${c.last ? 'รายงานล่าสุด: ' + esc(mName(c.last)) : 'ยังไม่มีรายงาน'}</span></a><button class="btn sm del" data-delc="${esc(c.id)}" data-n="${esc(c.name)}">ลบลูกค้า</button></div>`).join('') || '<p class="hint">ยังไม่มีลูกค้า</p>'}</div></div>
  <div class="card"><h2>เพิ่มลูกค้าใหม่</h2><div class="grid2"><label class="f">ชื่อบริษัทลูกค้า<input id="newName" placeholder="เช่น บริษัท ตัวอย่าง จำกัด"></label>
  <label class="f">รูปแบบรายงานเริ่มต้น<select id="newPreset">${Object.entries(PRESETS).map(([k, p]) => `<option value="${k}">${esc(p.label)}</option>`).join('')}</select></label></div>
  <div class="row" style="margin-top:10px"><button class="btn pri" id="btnNew">+ เพิ่มลูกค้า</button><span class="hint">เพิ่ม ซ่อน เรียงบล็อกได้ภายหลังในแท็บ "โครงรายงาน"</span></div></div>`;
  const go = async () => { const n = $('#newName').value.trim(); if (!n) { toast('ใส่ชื่อลูกค้าก่อน'); return; } try { const id = await rpc('lad_custom_create', { p_name: n }); await rpc('lad_save_config', { p_site: id, p_config: { client: n, preset: $('#newPreset').value } }); location.hash = 'c=' + id; } catch (e) { toast(e.message); } };
  $('#btnNew').onclick = go; $('#newName').onkeydown = e => { if (e.key === 'Enter') go(); };
  box.querySelectorAll('[data-delc]').forEach(b => b.onclick = async () => {
    if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'ลบลูกค้าและรายงานทั้งหมด? กดอีกครั้ง'; setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = 'ลบลูกค้า'; } }, 5000); return; }
    b.disabled = true; try { await rpc('lad_custom_delete', { p_site: b.dataset.delc }); toast('ลบ ' + b.dataset.n + ' แล้ว'); showList(); } catch (e) { toast('ลบไม่สำเร็จ: ' + e.message); b.disabled = false; } });
}
/* ───────── boot ───────── */
function buildSelectors() {
  const ys = $('#selYear'); ys.innerHTML = ''; for (let y = 2026; y <= 2029; y++) ys.add(new Option(y + 543, y)); ys.value = Y;
  const ms = $('#selMonth'); ms.innerHTML = ''; TH_M.forEach((t, i) => ms.add(new Option(t, i + 1))); ms.value = M;
  const fresh = () => Object.keys(reports).forEach(k => { if (reports[k]._new && !pending.has(k)) delete reports[k]; }); /* เดือนที่ยังไม่แตะ → สร้างใหม่จากเดือนล่าสุด */
  ys.onchange = async () => { await flush(); fresh(); Y = +ys.value; renderAll(); }; ms.onchange = async () => { await flush(); fresh(); M = +ms.value; renderAll(); };
  labelMonths();
}
function labelMonths() { const ms = $('#selMonth'); if (!ms) return; [...ms.options].forEach((o, i) => { const k = mk(Y, i + 1); const x = reports[k]; o.textContent = TH_M[i] + (STATUS[k] || (x && !x._new) ? ' · มีข้อมูล' : ''); }); }
function renderAll() { $('#selYear').value = Y; $('#selMonth').value = M; renderInfo(); renderLayout(); renderFill(); renderOut(); labelMonths(); }
async function openSite(id) {
  await flush(); SITE = id; document.body.classList.remove('listmode'); setStatus('กำลังโหลด…');
  Object.keys(reports).forEach(k => delete reports[k]);
  try { const b = await rpc('lad_bootstrap', { p_site: id }); cfg = b.config || {}; const o = await rpc('lad_year', { p_site: id, p_from: '2025-01', p_to: '2029-12' }) || {}; Object.entries(o).forEach(([k, v]) => reports[k] = v); }
  catch (e) { toast('ไม่พบลูกค้ารายนี้'); location.hash = ''; return; }
  $('#appTitle').textContent = 'รายงาน Custom · ' + (cfg.client || '');
  const now = new Date(); Y = now.getFullYear(); M = now.getMonth() + 1;
  const ks = Object.keys(reports).sort(); const last = ks[ks.length - 1];
  if (last && !reports[mk(Y, M)]) { const nx = addMonths(last, 1); if (nx < mk(Y, M)) [Y, M] = nx.split('-').map(Number); }
  buildSelectors(); renderAll(); goTab('info'); await loadStatus(); setStatus('บันทึกอัตโนมัติ');
}
async function route() { const id = siteFromHash(); if (id) await openSite(id); else { await flush(); SITE = null; showList(); } }
(function boot() {
  $('#tabs').innerHTML = TABS.map(([k, t], i) => `<button data-t="${k}" class="${i ? '' : 'on'}">${esc(t)}</button>`).join('');
  $('#tabs').querySelectorAll('button').forEach(b => b.onclick = () => goTab(b.dataset.t));
  $('main').insertAdjacentHTML('beforeend', TABS.map(([k], i) => `<section class="tab ${i ? '' : 'on'}" id="t-${k}"></section>`).join(''));
  $('#btnList').onclick = () => { location.hash = ''; };
  window.addEventListener('hashchange', route); route();
})();
window.addEventListener('beforeunload', () => { if (pending.size) flush(); });
