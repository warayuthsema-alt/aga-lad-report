/**
 * ระบบปักหมุดลูกค้าจาก QR — Google Apps Script (ฝั่งเก็บข้อมูล)
 * วางโค้ดนี้ใน Extensions > Apps Script ของ Google Sheet แล้ว Deploy เป็น Web App
 */
const SHEET_NAME = 'Locations';
const TOKEN = 'aga-af660219';   // เปลี่ยนเป็นรหัสของตัวเอง แล้วใส่ค่าเดียวกันในหน้า "ตั้งค่า" ของเว็บ

const HEADERS = ['id','created_at','updated_at','code','name','team','addr','contact','phone',
  'lat','lng','maps_url','pin_source','qr_raw','scan_lat','scan_lng','scan_acc','dist_m','note','by'];

function doGet(e) {
  return json({ ok: true, msg: 'QR Location API พร้อมใช้งาน' });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (TOKEN && body.token !== TOKEN) return json({ ok: false, error: 'รหัสผ่านระบบ (token) ไม่ถูกต้อง' });
    switch (body.action) {
      case 'list':    return json({ ok: true, rows: listRows() });
      case 'save':    return json(saveRow(body.row || {}));
      case 'delete':  return json(deleteRow(body.id));
      case 'resolve': return json(resolveUrl(body.url));
      default:        return json({ ok: false, error: 'ไม่รู้จักคำสั่ง ' + body.action });
    }
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) });
  }
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function sheet() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#00463c').setFontColor('#ffffff');
    sh.getRange('J:K').setNumberFormat('0.0000000');
  }
  return sh;
}

function now() {
  return Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm');
}

function listRows() {
  const sh = sheet();
  const n = sh.getLastRow();
  if (n < 2) return [];
  const vals = sh.getRange(2, 1, n - 1, HEADERS.length).getDisplayValues();
  return vals.filter(r => r[0]).map(r => {
    const o = {};
    HEADERS.forEach((h, i) => o[h] = r[i]);
    o.lat = o.lat === '' ? '' : Number(o.lat);
    o.lng = o.lng === '' ? '' : Number(o.lng);
    return o;
  });
}

function saveRow(row) {
  if (!row.name) return { ok: false, error: 'ไม่มีชื่อลูกค้า' };
  const lat = Number(row.lat), lng = Number(row.lng);
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return { ok: false, error: 'พิกัดไม่ถูกต้อง' };

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet();
    const n = sh.getLastRow();
    const ids = n > 1 ? sh.getRange(2, 1, n - 1, 1).getValues().map(r => String(r[0])) : [];
    let idx = row.id ? ids.indexOf(String(row.id)) : -1;
    // ไม่มี id แต่รหัสลูกค้าซ้ำ → อัปเดตแถวเดิม
    if (idx < 0 && row.code) {
      const codes = n > 1 ? sh.getRange(2, 4, n - 1, 1).getValues().map(r => String(r[0]).trim().toLowerCase()) : [];
      idx = codes.indexOf(String(row.code).trim().toLowerCase());
    }
    const t = now();
    if (idx >= 0) {
      const r = idx + 2;
      const old = sh.getRange(r, 1, 1, HEADERS.length).getValues()[0];
      const rec = HEADERS.map((h, i) => {
        if (h === 'id' || h === 'created_at') return old[i];
        if (h === 'updated_at') return t;
        return row[h] !== undefined && row[h] !== null && row[h] !== '' ? clean(row[h]) : old[i];
      });
      sh.getRange(r, 1, 1, HEADERS.length).setValues([rec]);
      return { ok: true, updated: true, id: old[0] };
    }
    const id = Utilities.getUuid().slice(0, 8);
    const rec = HEADERS.map(h => h === 'id' ? id : h === 'created_at' || h === 'updated_at' ? t : clean(row[h]));
    sh.appendRow(rec);
    return { ok: true, updated: false, id };
  } finally {
    lock.releaseLock();
  }
}

// กันสูตรถูกฝังมากับข้อมูล (ขึ้นต้นด้วย = + - @)
function clean(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'number') return v;
  const s = String(v).slice(0, 2000);
  return /^[=+@]/.test(s) || /^-[^\d]/.test(s) ? "'" + s : s;
}

function deleteRow(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet();
    const n = sh.getLastRow();
    if (n < 2) return { ok: false, error: 'ไม่พบข้อมูล' };
    const ids = sh.getRange(2, 1, n - 1, 1).getValues().map(r => String(r[0]));
    const idx = ids.indexOf(String(id));
    if (idx < 0) return { ok: false, error: 'ไม่พบข้อมูล' };
    sh.deleteRow(idx + 2);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- เปิดลิงก์สั้น maps.app.goo.gl เพื่ออ่านพิกัด ---------- */
function resolveUrl(url) {
  if (!url || !/^https?:\/\//i.test(url)) return { ok: false, error: 'ลิงก์ไม่ถูกต้อง' };
  const allowed = /^(maps\.app\.goo\.gl|goo\.gl|g\.co|share\.google|(www\.|maps\.)?google\.[a-z.]+)$/i;
  let u = url, name = '';
  for (let i = 0; i < 6; i++) {
    const host = (u.match(/^https?:\/\/([^\/?#]+)/i) || [])[1] || '';
    if (!allowed.test(host)) break;
    const c = parseCoords(u);
    if (c) return { ok: true, url: u, lat: c.lat, lng: c.lng, name: placeName(u) };
    const res = UrlFetchApp.fetch(u, { followRedirects: false, muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' } });
    const h = res.getAllHeaders();
    const loc = h.Location || h.location;
    if (loc) {
      u = /^https?:/i.test(loc) ? loc : 'https://' + host + (loc.charAt(0) === '/' ? '' : '/') + loc;
      continue;
    }
    // ไม่มี redirect แล้ว → ลองหาในเนื้อหาหน้า
    const html = res.getContentText().slice(0, 300000);
    const m = html.match(/center=(-?\d+\.\d+)%2C(-?\d+\.\d+)/) || html.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/)
      || html.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    const t = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/);
    if (t) name = t[1].split(' · ')[0];
    if (m && valid(+m[1], +m[2])) return { ok: true, url: u, lat: +m[1], lng: +m[2], name: placeName(u) || name };
    break;
  }
  return { ok: true, url: u, lat: null, lng: null, name: placeName(u) || name };
}

/* ---------- แกะพิกัด (ตรรกะเดียวกับหน้าเว็บ) ---------- */
function valid(lat, lng) {
  return isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}
function dms(d, m, s, h) { let v = +d + (+m || 0) / 60 + (+s || 0) / 3600; if (/[SW]/i.test(h)) v = -v; return v; }
function parseCoords(input) {
  if (!input) return null;
  let t = String(input).trim();
  for (let i = 0; i < 2; i++) { try { t = decodeURIComponent(t.replace(/\+/g, ' ')); } catch (e) {} }
  const N = '(-?\\d{1,3}\\.\\d+)';
  const pats = [
    new RegExp('!3d' + N + '!4d' + N),
    new RegExp('[?&](?:q|query|ll|sll|center|destination|daddr|saddr|cbll)=(?:loc:)?\\s*' + N + '\\s*,\\s*\\+?' + N),
    new RegExp('geo:' + N + '\\s*,\\s*' + N),
    new RegExp('/search/' + N + '\\s*,\\s*\\+?' + N),
    new RegExp('/place/' + N + '\\s*,\\s*\\+?' + N),
    new RegExp('@' + N + ',' + N),
    new RegExp('^' + N + '\\s*[,\\s]\\s*' + N + '$')
  ];
  const d = t.match(/(\d{1,3})°\s*(\d{1,2})['′]\s*([\d.]+)?["″]?\s*([NS])[\s,]+(\d{1,3})°\s*(\d{1,2})['′]\s*([\d.]+)?["″]?\s*([EW])/i);
  if (d) { const a = dms(d[1], d[2], d[3], d[4]), b = dms(d[5], d[6], d[7], d[8]); if (valid(a, b)) return { lat: a, lng: b }; }
  for (const p of pats) { const m = t.match(p); if (m) { const a = +m[1], b = +m[2]; if (valid(a, b)) return { lat: a, lng: b }; } }
  const any = t.match(/(-?\d{1,2}\.\d{4,})\s*,\s*\+?(-?\d{1,3}\.\d{4,})/);
  if (any) { const a = +any[1], b = +any[2]; if (valid(a, b)) return { lat: a, lng: b }; }
  return null;
}
function placeName(input) {
  const m = String(input || '').match(/\/maps\/place\/([^\/@?]+)/);
  if (!m) return '';
  try { const n = decodeURIComponent(m[1].replace(/\+/g, ' ')); return /^-?\d/.test(n) ? '' : n; } catch (e) { return ''; }
}

/** รันฟังก์ชันนี้ 1 ครั้งใน editor เพื่อสร้างชีตและกดอนุญาตสิทธิ์ */
function setup() {
  sheet();
  UrlFetchApp.fetch('https://www.google.com', { muteHttpExceptions: true });
  Logger.log('พร้อมใช้งาน: ชีต ' + SHEET_NAME);
}
