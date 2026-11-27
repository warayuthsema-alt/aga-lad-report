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

/* ---------- ตามลิงก์จาก QR (ลิงก์ย่อ / เว็บสร้าง QR / หน้ากลาง) จนเจอพิกัด ---------- */
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
const MAP_LINK = /(?:https?:)?\/\/(?:www\.|maps\.)?(?:google\.[a-z.]+\/maps[^\s"'<>\\]*|maps\.google\.[a-z.]+[^\s"'<>\\]*|maps\.app\.goo\.gl\/[\w-]+|goo\.gl\/maps\/[\w-]+|maps\.apple\.com\/[^\s"'<>\\]*|(?:www\.)?waze\.com\/ul[^\s"'<>\\]*|share\.google\/[\w-]+)|geo:-?\d[^\s"'<>]*/gi;

const IS_MAP = new RegExp(MAP_LINK.source, 'i');
function isGoogle(host) { return /(^|\.)google\.[a-z.]+$|^maps\.app\.goo\.gl$|^goo\.gl$/i.test(host); }
function hostOf(u) { return ((u.match(/^https?:\/\/([^\/?#:]+)/i) || [])[1] || '').toLowerCase(); }
function absUrl(loc, base) {
  loc = loc.trim();
  if (/^https?:/i.test(loc) || /^geo:/i.test(loc)) return loc;
  if (loc.indexOf('//') === 0) return 'https:' + loc;
  const origin = (base.match(/^https?:\/\/[^\/?#]+/i) || [''])[0];
  if (loc.charAt(0) === '/') return origin + loc;
  return base.replace(/[^\/]*([?#].*)?$/, '') + loc;
}
function unescapeHtml(t) {
  return t.replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\\//g, '/')
    .replace(/&amp;/g, '&').replace(/&#x2F;|&#47;/gi, '/').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

/** อ่านหน้าเว็บ: หาลิงก์แผนที่, redirect แบบ meta/JS และพิกัดที่ฝังอยู่ */
function scanHtml(html, base, host) {
  const t = unescapeHtml(html);
  const out = { coords: null, links: [], name: '' };
  const og = t.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || t.match(/<title[^>]*>([^<]{2,120})<\/title>/i);
  if (og) out.name = og[1].split(' · ')[0].split(' - Google')[0].trim();
  if (isGoogle(host)) {
    const m = t.match(/center=(-?\d+\.\d+)%2C(-?\d+\.\d+)/) || t.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/) || t.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (m && valid(+m[1], +m[2])) out.coords = { lat: +m[1], lng: +m[2] };
  }
  (t.match(MAP_LINK) || []).forEach(l => out.links.push(absUrl(l, base)));
  const redir = [
    /<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["'][^"']*url=([^"'>]+)/i,
    /(?:window\.|document\.|top\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/i,
    /location\.(?:replace|assign)\(\s*["']([^"']+)["']/i,
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i
  ];
  redir.forEach(r => { const m = t.match(r); if (m) out.links.push(absUrl(m[1], base)); });
  return out;
}

function resolveUrl(url) {
  if (!url || !/^https?:\/\//i.test(url)) return { ok: false, error: 'ลิงก์ไม่ถูกต้อง' };
  const queue = [url], seen = {};
  let name = '', last = url;
  for (let hop = 0; hop < 10 && queue.length; hop++) {
    const u = queue.shift();
    if (seen[u]) { hop--; continue; }
    seen[u] = 1; last = u;
    const c = parseCoords(u);
    if (c) return { ok: true, url: u, lat: c.lat, lng: c.lng, name: placeName(u) || name, hops: hop };
    if (!/^https?:/i.test(u)) continue;
    let res;
    try {
      res = UrlFetchApp.fetch(u, { followRedirects: false, muteHttpExceptions: true, validateHttpsCertificates: false,
        headers: { 'User-Agent': UA, 'Accept-Language': 'th,en;q=0.8' } });
    } catch (e) { continue; }
    const h = res.getAllHeaders();
    const loc = h.Location || h.location;
    if (loc) { queue.unshift(absUrl(String(loc), u)); continue; }
    const ct = String(h['Content-Type'] || h['content-type'] || '');
    if (ct && !/html|text|json/i.test(ct)) continue;
    const host = hostOf(u);
    const s = scanHtml(res.getContentText().slice(0, 600000), u, host);
    if (s.name && !name && !isGoogle(host)) name = s.name;
    if (s.coords) return { ok: true, url: u, lat: s.coords.lat, lng: s.coords.lng, name: placeName(u) || s.name || name, hops: hop };
    // ลิงก์แผนที่ก่อน แล้วค่อย redirect อื่น
    const mapsFirst = s.links.filter(l => !seen[l]).sort((a, b) => (IS_MAP.test(b) ? 1 : 0) - (IS_MAP.test(a) ? 1 : 0));
    for (let i = mapsFirst.length - 1; i >= 0; i--) queue.unshift(mapsFirst[i]);
  }
  return { ok: true, url: last, lat: null, lng: null, name: placeName(last) || name };
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
    new RegExp('[?&](?:q|query|ll|sll|center|destination|daddr|saddr|cbll|coordinates|location)=(?:loc:)?\\s*' + N + '\\s*,\\s*\\+?' + N, 'i'),
    new RegExp('[?&](?:lat|latitude)=\\s*' + N + '&(?:lng|lon|long|longitude)=\\s*' + N, 'i'),
    new RegExp('geo[:;][^\\d-]{0,24}?' + N + '\\s*[,;]\\s*' + N, 'i'),
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
