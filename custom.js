/* รายงานฉบับ Custom — ลูกค้าหลายราย (lad_sites id 'custom-…'), รายงานรายเดือนใน lad_reports */
"use strict";
const SB = 'https://zhdigumxkjfvrkkmqqpk.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoZGlndW14a2pmdnJra21xcXBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMjI2NjcsImV4cCI6MjA5Nzc5ODY2N30.NJpFFXX_KYGgICo3WNaevMxjXc0EB9X7rOzOhWXiIK0';
const BUCKET = 'pest-reports';
const TH_M = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const PER_PAGE = 9;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nl = s => esc(s).replace(/\n/g, '<br>');
const pad = n => String(n).padStart(2, '0');
const mk = (y, m) => y + '-' + pad(m);
const clone = o => JSON.parse(JSON.stringify(o));
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('on'), 2400); }
function setStatus(t) { $('#status').textContent = t; }
async function rpc(fn, args) {
  const r = await fetch(SB + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}) });
  const t = await r.text(); if (!r.ok) { let m = t; try { m = JSON.parse(t).message } catch (e) { } throw new Error(m); } return t ? JSON.parse(t) : null;
}
const dLong = iso => { if (!iso) return '……………'; const [y, m, d] = iso.split('-').map(Number); return d + ' ' + TH_M[m - 1] + ' ' + (y + 543); };
const mName = k => { const [y, m] = k.split('-').map(Number); return TH_M[m - 1] + ' ' + (y + 543); };

/* ───────── state ───────── */
let SITE = null, cfg = {}, Y, M; const reports = {}; let STATUS = {};
const curKey = () => mk(Y, M);
const siteFromHash = () => (location.hash.match(/c=(custom-[a-z0-9]+)/) || [])[1] || null;

function prevReport(k) { const ks = Object.keys(reports).filter(x => x < k && !reports[x]._new).sort(); return ks.length ? reports[ks[ks.length - 1]] : null; }
function blank(k) {
  const p = prevReport(k);
  return { svcDate: '', showDate: !(p && p.showDate === false), techs: clone((p && p.techs) || CUSTOM_DEF.techs), chem: clone((p && p.chem) || CUSTOM_DEF.chem).map(c => ({ ...c, used: c.used !== false })),
    sections: clone((p && p.sections) || CUSTOM_DEF.sections), photos: [] };
}
function cur() { const k = curKey(); if (!reports[k]) { reports[k] = blank(k); reports[k]._new = true; } const r = reports[k];
  r.techs = r.techs || []; r.chem = r.chem || []; r.sections = r.sections || []; r.photos = r.photos || []; return r; }
const C = k => cfg[k] ?? CUSTOM_DEF[k];

let saveTimer = null, saving = false; const pending = new Set();
function markDirty() { const k = curKey(); pending.add(k); if (reports[k]) delete reports[k]._new; setStatus('ยังไม่บันทึก…'); clearTimeout(saveTimer); saveTimer = setTimeout(flush, 900); }
async function flush() {
  if (saving) { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 600); return; }
  saving = true;
  try { for (const k of [...pending]) { pending.delete(k); const r = clone(reports[k]); delete r._new; r.updatedAt = new Date().toISOString();
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

/* ───────── report pages ───────── */
const LOGO = 'img/logo.png';
function pageCover(r) {
  const ct = (C('contracts') || []).filter(Boolean);
  return { o: 'P', cover: true, name: 'หน้าปก', html: `<div class="pg P xc">
  <div class="xc-top"></div><img class="xc-logo" src="${LOGO}">
  <div class="xc-kicker">SERVICE REPORT · รายงานประจำเดือน</div>
  <div class="xc-title">รายงานการปฏิบัติงาน<br>กำจัดแมลงและสัตว์พาหะ</div>
  <div class="xc-pests">${esc(C('pestsLine'))}</div><div class="xc-rule"></div>
  <div class="xc-card"><div class="xc-lab">จัดทำให้</div><div class="xc-client">${esc(C('client'))}</div>
  <table class="xc-meta">${ct.length ? `<tr><td>เลขที่สัญญา</td><td>${esc(ct.join(', '))}</td></tr>` : ''}<tr><td>ประจำเดือน</td><td>${esc(mName(curKey()))}</td></tr>${r.showDate !== false ? `<tr><td>วันที่ทำบริการ</td><td>${esc(dLong(r.svcDate))}</td></tr>` : ''}<tr><td>จัดทำโดย</td><td>${esc(C('preparer'))}${C('preparerTitle') ? `<br><span>${esc(C('preparerTitle'))}</span>` : ''}</td></tr></table></div>
  <div class="xc-band"><div><b>Advance Integrated Pest Management</b><br>บริษัท แอ๊ดวานซ์ กรุ๊ป เอเซีย จำกัด · Advance Group Asia Co.,Ltd.<br>234/9 ถนนเสรีไทย แขวงคันนายาว เขตคันนายาว กรุงเทพมหานคร 10230</div><div class="xc-tel">02 704 5333<br><span>callcenter@advancegroupasia.com · www.advancegroupasia.com</span></div></div></div>` };
}
function xHead(title) { return `<div class="xh"><img src="${LOGO}"><div class="xh-r"><b>บริษัท แอ๊ดวานซ์ กรุ๊ป เอเซีย จำกัด</b><span>Advance Group Asia Co.,Ltd.</span></div></div>
  <div class="xt"><div><b>${esc(title)}</b><span>${esc(C('client'))}</span></div><div class="xt-m">${esc(mName(curKey()))}</div></div>`; }
const xFoot = () => `<div class="xf"><span>บริษัท แอ๊ดวานซ์ กรุ๊ป เอเซีย จำกัด · โทร 02-704-5333 · www.advancegroupasia.com</span><span class="pno"></span></div>`;
function pageChem(r) {
  const rows = r.chem.filter(c => (c.name || '').trim());
  const grp = []; rows.forEach(c => { const g = grp[grp.length - 1]; if (g && g.p === (c.pest || '')) g.items.push(c); else grp.push({ p: c.pest || '', items: [c] }); });
  const body = grp.map((g, gi) => g.items.map((c, i) => `<tr class="${gi % 2 ? 'z' : ''}">${i === 0 ? `<td class="pc" rowspan="${g.items.length}">${nl(g.p.replace(/\s*\/\s*/g, '\n'))}</td>` : ''}<td><span class="ck ${c.used ? 'on' : ''}"></span>${esc(c.name)}</td><td class="nt">${esc(c.note)}</td></tr>`).join('')).join('');
  const ct = (C('contracts') || []).filter(Boolean);
  return { o: 'P', name: 'รายงานการใช้สารเคมี', html: `<div class="pg P xp">${xHead('รายงานการใช้สารเคมี · Chemicals Used Report')}<div class="xb">
  <div class="xi"><div><span>สถานที่ให้บริการ</span><b>${esc(C('client'))}</b></div>${r.showDate !== false ? `<div><span>วันที่ทำบริการ / Service Date</span><b>${esc(dLong(r.svcDate))}</b></div>` : ''}
  ${ct.length ? `<div><span>เลขที่สัญญา</span><b>${esc(ct.join(', '))}</b></div>` : ''}<div><span>ผู้จัดทำรายงาน</span><b>${esc(C('preparer'))}</b></div></div>
  <table class="xct"><tr><th style="width:150px">ชนิดของแมลง</th><th>ชื่อการค้าของสารเคมี<br><small>Trade Name of Chemicals</small></th><th style="width:170px">หมายเหตุ</th></tr>${body}</table>
  <div class="xlegend"><span class="ck on"></span> = สารเคมี/อุปกรณ์ที่ใช้ในการบริการครั้งนี้</div>
  <div class="xtech"><div class="xs-h">รายชื่อผู้เข้าทำบริการ</div><ol>${r.techs.map(t => `<li>${esc(t)}</li>`).join('')}</ol></div>
  <div class="xsign"><div><div class="ln"></div>ผู้จัดทำรายงาน<br><b>${esc(C('preparer'))}</b><br>${esc(C('preparerTitle'))}</div><div><div class="ln"></div>ผู้รับรายงาน<br><b>${esc(C('client'))}</b><br>วันที่ ........ / ........ / ........</div></div>
  </div>${xFoot()}</div>` };
}
function sectionBlocks(r) {
  const cl = esc(C('client')); const out = [];
  r.sections.forEach((s, i) => {
    out.push(`<div class="xs-t"><span class="no">${i + 1}</span>${esc(s.title)}</div><div class="xs-f"><span class="lab">ผลการตรวจสอบ</span><div>${nl(s.finding)}</div></div>`);
    out.push(`<div class="xs-a">การปรับปรุงแก้ไข / ข้อเสนอแนะ</div><div class="xs-by adv">โดย บริษัท แอ๊ดวานซ์ กรุ๊ป เอเซีย จำกัด</div>`);
    (s.adv || []).filter(x => x.trim()).forEach(x => out.push(`<div class="xs-li adv">${nl(x)}</div>`));
    if ((s.cli || []).some(x => x.trim())) { out.push(`<div class="xs-by cli">โดย ${cl}</div>`); s.cli.filter(x => x.trim()).forEach(x => out.push(`<div class="xs-li cli">${nl(x)}</div>`)); }
    out.push('<div class="xs-gap"></div>');
  });
  return out;
}
function pagesSummary(r) {
  /* จัดหน้าอัตโนมัติ: วัดความสูงจริงของแต่ละย่อหน้า แล้วขึ้นหน้าใหม่เมื่อเต็ม (ไม่ให้หัวข้อค้างท้ายหน้า) */
  const blocks = sectionBlocks(r); if (!blocks.length) return [];
  const root = $('#measure'); root.innerHTML = `<div class="pg P xp"><div class="xb" style="position:static;width:${794 - 2 * 56}px"></div></div>`; const body = root.querySelector('.xb');
  const hOf = b => { body.innerHTML = b; return body.getBoundingClientRect().height + 1; };
  const AVAIL = 1123 - 188 - 70; const isHead = b => !/xs-li|xs-gap/.test(b);
  const pages = []; let curr = [], h = 0;
  for (const b of blocks) {
    const bh = hOf(b);
    if (h + bh > AVAIL && curr.length) {
      const carry = []; while (curr.length > 1 && isHead(curr[curr.length - 1]) && carry.length < 4) carry.unshift(curr.pop());
      while (curr.length && /xs-gap/.test(curr[curr.length - 1])) curr.pop();
      pages.push(curr); curr = carry; h = carry.reduce((t, x) => t + hOf(x), 0);
    }
    if (/xs-gap/.test(b) && !curr.length) continue;
    curr.push(b); h += bh;
  }
  if (curr.length) pages.push(curr);
  root.innerHTML = '';
  return pages.map((p, i) => ({ o: 'P', name: 'สรุปผลการตรวจ หน้า ' + (i + 1), html: `<div class="pg P xp">${xHead('สรุปผลการตรวจสอบและข้อเสนอแนะ')}<div class="xb">${p.join('')}</div>${xFoot()}</div>` }));
}
function pagesPhotos(r) {
  const ph = r.photos.filter(p => p.id && (!p.id.startsWith('up:') || mem[p.id])); const out = [];
  const W = 794 - 2 * 56, GAP = 12, CW = (W - 2 * GAP) / 3, MAXH = 262, MINH = 140;
  for (let i = 0; i < ph.length; i += PER_PAGE) {
    const chunk = ph.slice(i, i + PER_PAGE); const rows = [];
    for (let j = 0; j < chunk.length; j += 3) rows.push(chunk.slice(j, j + 3));
    const html = rows.map(row => { const rh = Math.round(Math.max(MINH, Math.min(MAXH, Math.max(...row.map(p => CW * (p.h || 4) / (p.w || 3))))));
      return `<div class="xr" style="height:${rh}px">${row.map((p, k) => { const ar = (p.w || 3) / (p.h || 4); let w = CW, h = CW / ar; if (h > rh) { h = rh; w = rh * ar; }
        const n = i + rows.indexOf(row) * 3 + k + 1;
        return `<div class="xcell" style="width:${CW}px;height:${rh}px"><div class="xim" style="width:${w}px;height:${h}px;background-image:url('${esc(imgURL(p.id))}')"><span>${n}</span></div></div>`; }).join('')}</div>`; }).join('');
    out.push({ o: 'P', name: 'รูปภาพ หน้า ' + (out.length + 1), html: `<div class="pg P xp">${xHead(C('photoTitle'))}<div class="xb xg">${html}</div>${xFoot()}</div>` });
  }
  return out;
}
function buildPages() {
  const r = cur(); const P = [pageCover(r), pageChem(r), ...pagesSummary(r), ...pagesPhotos(r)];
  const N = P.length - 1; P.forEach((p, i) => { if (i) p.html = p.html.replace('<span class="pno"></span>', `<span class="pno">หน้า ${i} / ${N}</span>`); });
  return P;
}

/* ───────── UI ───────── */
const TABS = [['info', '1 ข้อมูลลูกค้า & วันบริการ'], ['chem', '2 สารเคมี'], ['sec', '3 ผลการตรวจ & คำแนะนำ'], ['photo', '4 รูปภาพ'], ['out', '5 ตรวจ & ดาวน์โหลด PDF']];
function goTab(t) { document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x.dataset.t === t)); document.querySelectorAll('section.tab').forEach(s => s.classList.toggle('on', s.id === 't-' + t)); if (t === 'out') renderOut(); window.scrollTo(0, 0); }
function navRow(t) { const i = TABS.findIndex(x => x[0] === t); const p = TABS[i - 1], n = TABS[i + 1]; return `<div class="row">${p ? `<button class="btn" data-go="${p[0]}">← ย้อนกลับ</button>` : ''}${n ? `<button class="btn pri" data-go="${n[0]}">ถัดไป: ${esc(n[1])} →</button>` : ''}</div>`; }
function bindNav(el) { el.querySelectorAll('[data-go]').forEach(b => b.onclick = () => goTab(b.dataset.go)); }
const lines = v => v.split('\n').map(s => s.trim()).filter(Boolean);
function renderInfo() {
  const r = cur(); const el = $('#t-info');
  el.innerHTML = `<div class="card"><h2>ข้อมูลลูกค้า <span class="hint">(ใช้กับทุกเดือนของลูกค้ารายนี้)</span></h2><div class="grid2">
  <label class="f">ชื่อลูกค้า<input data-c="client" value="${esc(C('client'))}"></label>
  <label class="f">เลขที่สัญญา (ถ้ามีหลายสัญญา คั่นด้วย ,)<input data-c="contracts" value="${esc((C('contracts') || []).join(', '))}"></label>
  <label class="f">ชื่อผู้จัดทำ<input data-c="preparer" value="${esc(C('preparer'))}"></label>
  <label class="f">ตำแหน่งผู้จัดทำ<input data-c="preparerTitle" value="${esc(C('preparerTitle'))}"></label>
  <label class="f" style="grid-column:1/-1">บรรทัดชนิดสัตว์พาหะบนหน้าปก<input data-c="pestsLine" value="${esc(C('pestsLine'))}"></label></div></div>
  <div class="card"><h2>การเข้าบริการ · ${esc(mName(curKey()))}</h2><div class="grid2"><label class="f">วันที่ทำบริการ<input type="date" id="svcDate" value="${esc(r.svcDate)}"></label><label class="tg"><input type="checkbox" id="showDate" ${r.showDate !== false ? 'checked' : ''}> แสดงวันที่ทำบริการในรายงาน <span class="hint">(หน้าปก และหน้ารายงานการใช้สารเคมี)</span></label></div><p class="hint" id="dh"></p>
  <label class="f" style="margin-top:10px">รายชื่อผู้เข้าทำบริการ (บรรทัดละ 1 คน)<textarea id="techs" rows="5">${esc(r.techs.join('\n'))}</textarea></label></div>${navRow('info')}`;
  el.querySelectorAll('[data-c]').forEach(e => e.oninput = () => { const k = e.dataset.c; cfg[k] = k === 'contracts' ? e.value.split(',').map(s => s.trim()).filter(Boolean) : e.value; if (k === 'client') { $('#appTitle').textContent = 'รายงาน Custom · ' + e.value; } cfgDirty(); });
  const d = $('#svcDate'); const dh = () => { $('#dh').innerHTML = r.svcDate && r.svcDate.slice(0, 7) !== curKey() ? '<b style="color:#d92d20">วันที่บริการไม่ตรงกับเดือนที่เลือก</b>' : ''; };
  d.oninput = () => { r.svcDate = d.value; markDirty(); dh(); }; dh();
  $('#showDate').onchange = e => { r.showDate = e.target.checked; markDirty(); };
  $('#techs').oninput = e => { r.techs = lines(e.target.value); markDirty(); };
  bindNav(el);
}
function renderChem() {
  const r = cur(); const el = $('#t-chem');
  el.innerHTML = `<div class="card"><div class="row"><h2 style="margin:0;flex:1">รายชื่อสารเคมี (CHEMICALS USED REPORT)</h2><button class="btn sm" id="chAll">ติ๊กทั้งหมด</button><button class="btn sm" id="chNone">ไม่ติ๊กทั้งหมด</button></div>
  <p class="hint">ติ๊ก ✓ = ใช้ในรอบนี้ · ชนิดแมลงที่ติดกันและพิมพ์เหมือนกันจะรวมเป็นช่องเดียวในรายงาน (ใช้ " / " ขึ้นบรรทัดใหม่ เช่น มด / แมลงสาบ) · รายการนี้จะถูกคัดลอกไปเดือนถัดไปให้อัตโนมัติ</p>
  <table class="ed"><tr><th style="width:44px">ใช้</th><th style="width:180px">ชนิดของแมลง</th><th>ชื่อการค้าของสารเคมี</th><th>หมายเหตุ</th><th style="width:140px"></th></tr>
  ${r.chem.map((c, i) => `<tr class="${c.used ? '' : 'off'}"><td><input type="checkbox" data-u="${i}" ${c.used ? 'checked' : ''} style="width:20px;height:20px"></td><td><input type="text" data-k="pest" data-i="${i}" value="${esc(c.pest)}"></td><td><input type="text" data-k="name" data-i="${i}" value="${esc(c.name)}"></td><td><input type="text" data-k="note" data-i="${i}" value="${esc(c.note)}"></td>
  <td><button class="btn sm" data-mv="-1" data-i="${i}">▲</button><button class="btn sm" data-mv="1" data-i="${i}">▼</button><button class="btn sm" data-del="${i}">ลบ</button></td></tr>`).join('')}</table>
  <button class="btn sm" id="chAdd" style="margin-top:8px">+ เพิ่มสารเคมี</button></div>${navRow('chem')}`;
  el.querySelectorAll('[data-u]').forEach(e => e.onchange = () => { r.chem[+e.dataset.u].used = e.checked; e.closest('tr').classList.toggle('off', !e.checked); markDirty(); });
  el.querySelectorAll('input[data-k]').forEach(e => e.oninput = () => { r.chem[+e.dataset.i][e.dataset.k] = e.value; markDirty(); });
  el.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => { const i = +b.dataset.i, j = i + +b.dataset.mv; if (j < 0 || j >= r.chem.length) return; [r.chem[i], r.chem[j]] = [r.chem[j], r.chem[i]]; markDirty(); renderChem(); });
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'ยืนยัน'; b.classList.add('pri'); return; } r.chem.splice(+b.dataset.del, 1); markDirty(); renderChem(); });
  $('#chAdd').onclick = () => { const last = r.chem[r.chem.length - 1]; r.chem.push({ pest: last ? last.pest : '', name: '', used: true, note: '' }); markDirty(); renderChem(); el.querySelectorAll('input[data-k="name"]')[r.chem.length - 1]?.focus(); };
  $('#chAll').onclick = () => { r.chem.forEach(c => c.used = true); markDirty(); renderChem(); };
  $('#chNone').onclick = () => { r.chem.forEach(c => c.used = false); markDirty(); renderChem(); };
  bindNav(el);
}
function renderSec() {
  const r = cur(); const el = $('#t-sec'); const cl = C('client') || 'ลูกค้า';
  el.innerHTML = `<p class="hint">แต่ละหัวข้อคือ 1 ข้อในหน้าสรุปผล · ข้อเสนอแนะพิมพ์บรรทัดละ 1 ข้อ · ระบบจัดหน้าให้อัตโนมัติ · เดือนถัดไปจะคัดลอกข้อความของเดือนนี้ไปให้แก้ต่อ</p>
  ${r.sections.map((s, i) => `<div class="card" data-s="${i}"><div class="row"><b style="font-size:16px">ข้อ ${i + 1}</b><input type="text" data-f="title" value="${esc(s.title)}" style="flex:1;border:1px solid var(--line);border-radius:6px;padding:7px 9px;font-weight:700">
  <button class="btn sm" data-mv="-1">▲</button><button class="btn sm" data-mv="1">▼</button><button class="btn sm" data-del>ลบข้อนี้</button></div>
  <label class="f" style="margin-top:8px">ผลการตรวจสอบ<textarea data-f="finding" rows="3">${esc(s.finding)}</textarea></label>
  <div class="grid2" style="margin-top:8px"><label class="f">ข้อเสนอแนะ โดย บริษัท แอ๊ดวานซ์ กรุ๊ป เอเชีย จำกัด<textarea data-l="adv" rows="5">${esc((s.adv || []).join('\n'))}</textarea></label>
  <label class="f">ข้อเสนอแนะ โดย ${esc(cl)}<textarea data-l="cli" rows="5">${esc((s.cli || []).join('\n'))}</textarea></label></div></div>`).join('')}
  <div class="row" style="margin-bottom:14px"><button class="btn" id="secAdd">+ เพิ่มหัวข้อ</button><button class="btn sm" id="secReset">ใช้ข้อความตั้งต้น</button></div>${navRow('sec')}`;
  el.querySelectorAll('[data-s]').forEach(box => { const i = +box.dataset.s, s = r.sections[i];
    box.querySelectorAll('[data-f]').forEach(e => e.oninput = () => { s[e.dataset.f] = e.value; markDirty(); });
    box.querySelectorAll('[data-l]').forEach(e => e.oninput = () => { s[e.dataset.l] = lines(e.value); markDirty(); });
    box.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => { const j = i + +b.dataset.mv; if (j < 0 || j >= r.sections.length) return; [r.sections[i], r.sections[j]] = [r.sections[j], r.sections[i]]; markDirty(); renderSec(); });
    const d = box.querySelector('[data-del]'); d.onclick = () => { if (!d.dataset.sure) { d.dataset.sure = 1; d.textContent = 'กดอีกครั้งเพื่อลบ'; d.classList.add('pri'); return; } r.sections.splice(i, 1); markDirty(); renderSec(); };
  });
  $('#secAdd').onclick = () => { r.sections.push({ title: 'สรุปผลการตรวจเช็ค … พื้นที่ภายในอาคาร', finding: '', adv: [], cli: [] }); markDirty(); renderSec(); };
  const rs = $('#secReset'); rs.onclick = () => { if (!rs.dataset.sure) { rs.dataset.sure = 1; rs.textContent = 'แทนที่ข้อความทั้งหมดของเดือนนี้? กดอีกครั้ง'; return; } r.sections = clone(CUSTOM_DEF.sections); markDirty(); renderSec(); };
  bindNav(el);
}
function renderPhotos() {
  const r = cur(); const el = $('#t-photo'); const n = r.photos.length;
  el.innerHTML = `<div class="card"><div class="row"><h2 style="margin:0;flex:1">รูปภาพการเข้าทำบริการ <span class="hint">${n} รูป · ${Math.ceil(n / PER_PAGE) || 0} หน้า (หน้าละ ${PER_PAGE} รูป)</span></h2>${n ? '<button class="btn sm" id="phClear">ลบทั้งหมด</button>' : ''}</div>
  <label class="f" style="margin-bottom:10px">หัวข้อหน้ารูป<input id="phTitle" value="${esc(C('photoTitle'))}"></label>
  <div class="drop" id="drop">ลากรูปมาวางที่นี่ หรือ <u>กดเพื่อเลือกหลายรูปพร้อมกัน</u><br><span class="hint">ระบบหมุนรูปตามที่ถ่ายจริงและจัดแนวตั้ง/แนวนอนให้อัตโนมัติ · ◀ ▶ เลื่อนลำดับ · ✕ ลบ</span></div>
  <div class="thumbs">${r.photos.map((p, i) => `<div class="th ${p.id.startsWith('up:') ? 'up' : ''}" style="width:${p.w >= p.h ? 128 : 96}px;height:${p.w >= p.h ? 96 : 128}px;background-image:url('${esc(imgURL(p.id))}')"><span class="idx">${i + 1}</span><div class="ctl"><button data-mv="-1" data-i="${i}">◀</button><button data-del="${i}">✕</button><button data-mv="1" data-i="${i}">▶</button></div></div>`).join('')}</div></div>${navRow('photo')}`;
  const d = $('#drop');
  const fi = $('#fileIn'); fi.onchange = () => { const fs = [...fi.files]; fi.value = ''; addPhotos(fs); };
  d.onclick = () => fi.click();
  d.ondragover = e => { e.preventDefault(); d.classList.add('ov'); }; d.ondragleave = () => d.classList.remove('ov');
  d.ondrop = e => { e.preventDefault(); d.classList.remove('ov'); addPhotos([...e.dataTransfer.files].filter(f => f.type.startsWith('image/'))); };
  el.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => { const i = +b.dataset.i, j = i + +b.dataset.mv; if (j < 0 || j >= r.photos.length) return; [r.photos[i], r.photos[j]] = [r.photos[j], r.photos[i]]; markDirty(); renderPhotos(); });
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { r.photos.splice(+b.dataset.del, 1); markDirty(); renderPhotos(); });
  const cl = $('#phClear'); if (cl) cl.onclick = () => { if (!cl.dataset.sure) { cl.dataset.sure = 1; cl.textContent = 'กดอีกครั้งเพื่อยืนยัน'; return; } r.photos = []; markDirty(); renderPhotos(); };
  $('#phTitle').oninput = e => { cfg.photoTitle = e.target.value; cfgDirty(); };
  bindNav(el);
}
async function addPhotos(files) {
  if (!files.length) return; const r = cur(); const key = curKey(); const tmp = [];
  for (const f of files) { const id = 'up:' + Math.random().toString(36).slice(2); mem[id] = URL.createObjectURL(f); const p = { id, w: 3, h: 4 }; r.photos.push(p); tmp.push([p, f]); }
  renderPhotos(); let n = 0;
  for (const [p, f] of tmp) { setStatus(`กำลังอัปโหลดรูป ${++n}/${tmp.length}`);
    try { const s = await shrink(f); p.w = s.w; p.h = s.h; const id = await uploadImg(s.blob); mem[id] = URL.createObjectURL(s.blob); p.id = id; }
    catch (e) { const l = reports[key].photos; l.splice(l.indexOf(p), 1); toast('อัปโหลดรูปไม่สำเร็จ: ' + e.message); }
    if (key === curKey()) renderPhotos(); }
  markDirty();
}
function issues() {
  const r = cur(); const out = [];
  if (!C('client')) out.push(['bad', 'ยังไม่ได้ใส่ชื่อลูกค้า']);
  if (!r.svcDate) out.push([r.showDate !== false ? 'bad' : 'warn', 'ยังไม่ได้ใส่วันที่ทำบริการ' + (r.showDate !== false ? '' : ' (ตั้งค่าไม่แสดงในรายงาน)')]); else if (r.svcDate.slice(0, 7) !== curKey()) out.push(['bad', 'วันที่ทำบริการไม่อยู่ในเดือนที่เลือก']);
  if (!r.techs.length) out.push(['bad', 'ยังไม่ได้ใส่รายชื่อผู้เข้าทำบริการ']);
  if (!r.chem.some(c => c.used)) out.push(['warn', 'ยังไม่ได้ติ๊กสารเคมีที่ใช้']);
  if (!r.photos.length) out.push(['warn', 'ยังไม่มีรูปภาพ']);
  if (r.photos.some(p => p.id.startsWith('up:'))) out.push(['bad', 'รูปยังอัปโหลดไม่เสร็จ']);
  if (!out.length) out.push(['ok', 'ครบถ้วน พร้อมดาวน์โหลด']); return out;
}
function renderOut() {
  const el = $('#t-out');
  el.innerHTML = `<div class="card"><h2>ตรวจก่อนดาวน์โหลด</h2><ul class="checks">${issues().map(([c, t]) => `<li class="${c}">${c === 'ok' ? '✓' : c === 'warn' ? '!' : '•'} ${esc(t)}</li>`).join('')}</ul></div>
  <div class="card"><h2>ดาวน์โหลด PDF</h2><div class="row"><button class="btn pri" id="btnPdf">ดาวน์โหลด PDF ทั้งเล่ม</button><span class="hint" id="pdfInfo"></span></div><div class="prog" id="prog" style="display:none"><i></i></div><p class="hint" id="pdfMsg"></p></div>
  <div class="card danger"><h2>ลบรายงาน</h2><p class="hint">ลบรายงานเดือน ${esc(mName(curKey()))} ของ ${esc(C('client'))} ออกจากระบบ (ลบแล้วกู้คืนไม่ได้)</p><button class="btn del" id="btnDelRep">ลบรายงานเดือนนี้</button></div>
  <div class="card"><div class="row"><h2 style="margin:0;flex:1">ตัวอย่างทุกหน้า</h2><button class="btn sm" id="btnPreview">สร้างตัวอย่าง</button></div><div id="preview"><p class="hint">กด "สร้างตัวอย่าง" เพื่อดูทุกหน้า</p></div></div>`;
  $('#btnPreview').onclick = renderPreview; $('#btnPdf').onclick = downloadPdf;
  const dr = $('#btnDelRep'); dr.onclick = async () => {
    if (!dr.dataset.sure) { dr.dataset.sure = 1; dr.textContent = 'ยืนยันลบรายงานเดือน ' + mName(curKey()) + ' — กดอีกครั้ง'; setTimeout(() => { if (dr.isConnected) { delete dr.dataset.sure; dr.textContent = 'ลบรายงานเดือนนี้'; } }, 5000); return; }
    dr.disabled = true; const k = curKey(); pending.delete(k); clearTimeout(saveTimer);
    try { await rpc('lad_custom_delete_report', { p_site: SITE, p_month: k }); delete reports[k]; delete STATUS[k]; toast('ลบรายงานเดือน ' + mName(k) + ' แล้ว'); renderAll(); goTab('info'); setStatus('ลบแล้ว'); }
    catch (e) { toast('ลบไม่สำเร็จ: ' + e.message); dr.disabled = false; } };
}
function renderPreview() {
  const pages = buildPages(); const box = $('#preview'); const sc = Math.min(1, (box.clientWidth || 900) / 900) * 0.7;
  box.innerHTML = pages.map((p, i) => `<div class="pvlab">หน้า ${i + 1} · ${esc(p.name)}</div><div class="pvw" style="width:${794 * sc}px;height:${1123 * sc}px">${p.html.replace('class="pg ', `style="transform:scale(${sc})" class="pg `)}</div>`).join('');
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
  const { jsPDF } = window.jspdf; await document.fonts.ready; const pages = buildPages(); const root = $('#exportRoot'); const fcss = await getFontCSS();
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  for (let i = 0; i < pages.length; i++) { if (i) pdf.addPage('a4', 'portrait'); root.innerHTML = pages[i].html; const el = root.firstElementChild; await waitImgs(el);
    const url = await htmlToImage.toJpeg(el, { quality: .9, pixelRatio: 1.8, backgroundColor: '#ffffff', fontEmbedCSS: fcss, cacheBust: false });
    pdf.addImage(url, 'JPEG', 0, 0, 210, 297, undefined, 'FAST'); onProg && onProg((i + 1) / pages.length, i + 1, pages.length); await new Promise(r => setTimeout(r, 0)); }
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
  <div class="card"><h2>เพิ่มลูกค้าใหม่</h2><div class="row"><input id="newName" placeholder="ชื่อบริษัทลูกค้า เช่น บริษัท ตัวอย่าง จำกัด" style="flex:1;border:1px solid var(--line);border-radius:6px;padding:8px 10px"><button class="btn pri" id="btnNew">+ เพิ่มลูกค้า</button></div>
  <p class="hint">ลูกค้าใหม่จะได้รายชื่อสารเคมีและข้อความสรุปตั้งต้นตามรายงานตัวอย่าง แล้วแก้ได้ทั้งหมด</p></div>`;
  const go = async () => { const n = $('#newName').value.trim(); if (!n) { toast('ใส่ชื่อลูกค้าก่อน'); return; } try { const id = await rpc('lad_custom_create', { p_name: n }); location.hash = 'c=' + id; } catch (e) { toast(e.message); } };
  $('#btnNew').onclick = go;
  box.querySelectorAll('[data-delc]').forEach(b => b.onclick = async () => {
    if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'ลบลูกค้าและรายงานทั้งหมด? กดอีกครั้ง'; setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = 'ลบลูกค้า'; } }, 5000); return; }
    b.disabled = true; try { await rpc('lad_custom_delete', { p_site: b.dataset.delc }); toast('ลบ ' + b.dataset.n + ' แล้ว'); showList(); } catch (e) { toast('ลบไม่สำเร็จ: ' + e.message); b.disabled = false; } }); $('#newName').onkeydown = e => { if (e.key === 'Enter') go(); };
}
/* ───────── boot ───────── */
function buildSelectors() {
  const ys = $('#selYear'); ys.innerHTML = ''; for (let y = 2026; y <= 2029; y++) ys.add(new Option(y + 543, y)); ys.value = Y;
  const ms = $('#selMonth'); ms.innerHTML = ''; TH_M.forEach((t, i) => ms.add(new Option(t, i + 1))); ms.value = M;
  ys.onchange = async () => { await flush(); Y = +ys.value; renderAll(); }; ms.onchange = async () => { await flush(); M = +ms.value; renderAll(); };
  labelMonths();
}
function labelMonths() { const ms = $('#selMonth'); if (!ms) return; [...ms.options].forEach((o, i) => { const k = mk(Y, i + 1); const x = reports[k]; o.textContent = TH_M[i] + (STATUS[k] || (x && !x._new) ? ' · มีข้อมูล' : ''); }); }
function renderAll() { $('#selYear').value = Y; $('#selMonth').value = M; renderInfo(); renderChem(); renderSec(); renderPhotos(); renderOut(); labelMonths(); }
async function openSite(id) {
  await flush(); SITE = id; document.body.classList.remove('listmode'); setStatus('กำลังโหลด…');
  Object.keys(reports).forEach(k => delete reports[k]);
  try { const b = await rpc('lad_bootstrap', { p_site: id }); cfg = b.config || {}; const o = await rpc('lad_year', { p_site: id, p_from: '2025-01', p_to: '2029-12' }) || {}; Object.entries(o).forEach(([k, v]) => reports[k] = v); }
  catch (e) { toast('ไม่พบลูกค้ารายนี้'); location.hash = ''; return; }
  $('#appTitle').textContent = 'รายงาน Custom · ' + (cfg.client || '');
  const now = new Date(); Y = now.getFullYear(); M = now.getMonth() + 1;
  const ks = Object.keys(reports).sort(); const last = ks[ks.length - 1];
  if (last && !reports[mk(Y, M)]) { const [ly, lm] = last.split('-').map(Number); const nx = lm === 12 ? mk(ly + 1, 1) : mk(ly, lm + 1); if (nx < mk(Y, M)) [Y, M] = nx.split('-').map(Number); }
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
