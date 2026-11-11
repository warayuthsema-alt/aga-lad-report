/* ค่าตั้งต้นของ "รายงานฉบับ Custom" — คลังบล็อก (block library) และแบบฟอร์มตั้งต้น (presets) */
"use strict";
/* ── ทะเบียนสารเคมี: ค้นหา/เติมสารออกฤทธิ์ อัตราส่วน วิธีการ ── */
const masterGroup = p => { const x = PEST_LIST.find(o => o.p === p); return x ? x.m : p; };
const normName = s => String(s || '').replace(/[\s.]/g, '').replace(/[๊็]/g, '').replace(/ี/g, 'ี').toLowerCase();
function masterOf(p) { const g = masterGroup(p); return CHEM_MASTER.map((r, i) => ({ i, pest: r[0], name: r[1], active: r[2], ratio: r[3], method: r[4] })).filter(r => r.pest === g); }
function findMaster(p, name, method) {
  const n = normName(name); if (!n) return null; const all = CHEM_MASTER.map(r => ({ pest: r[0], name: r[1], active: r[2], ratio: r[3], method: r[4] }));
  const g = (p || '').split('/').map(s => masterGroup(s.trim()));
  const hit = all.filter(r => { const m = normName(r.name); return m === n || (n.length > 3 && (m.includes(n) || n.includes(m))); });
  return hit.find(r => g.includes(r.pest) && (!method || r.method === method)) || hit.find(r => g.includes(r.pest)) || hit[0] || null;
}
function chemRow(p, name, method) { const m = findMaster(p, name, method) || {}; return { pest: p, name: m.name || name, active: m.active || '', ratio: m.ratio || '', method: m.method || '', used: true, note: '' }; }
const CUSTOM_DEF = {
  client: '', contracts: [], preparer: 'นางสาว พรไพลิน ไคร้ชม', preparerTitle: 'หัวหน้างานสาขาลาดพร้าว',
  pestsLine: 'ปลวก/มด/แมลงสาบ/หนู/ยุง/แมลงหวี่/แมลงวัน', yearStart: 1,
  techs: ['นาย ธนพนธ์ จิตอาจ', 'นาย ชีวา จันทร์ดา', 'นาย สิทธิศักดิ์ คำอ้าย', 'นาย ธนพงษ์ มณีประกร'],
  contractPests: ['ปลวก', 'มด', 'แมลงสาบ', 'หนู', 'ยุง', 'แมลงหวี่', 'แมลงวัน'],
  chem: [
    chemRow('ปลวก', 'แม็กซ์นั่ม โปร'), chemRow('มด', 'พรีแม็กซ์ 250 อีซี'), chemRow('แมลงสาบ', 'พรีแม็กซ์ 250 อีซี'), chemRow('แมลงสาบ', 'เซกีลร่า'),
    { pest: 'แมลงสาบ', name: 'บ้านแมลงสาบ (อุปกรณ์เฝ้าระวัง)', active: '-', ratio: '-', method: 'วางอุปกรณ์', used: true, note: '' },
    chemRow('หนู', 'โบมาดิโอการ์ด'), { pest: 'หนู', name: 'กระดานกาวดักหนู', active: '-', ratio: '-', method: 'วางอุปกรณ์', used: true, note: '' },
    chemRow('ยุง', 'เฟนโดน่า 10 เอสซี')
  ],
  sections: [mkSection('ปลวก', 1), mkSection('มด', 1), mkSection('แมลงสาบ', 3, 'crst'), mkSection('หนู', 2, 'glue'), mkSection('ยุง', 1)],
  photoTitle: 'รูปภาพการเข้าทำบริการตรวจเช็คและสเปรย์เคมี'
};

/* ───── คลังบล็อก: ชนิดหน้าที่เลือกใส่ในรายงานได้ ───── */
const BLOCK_TYPES = {
  cover:    { label: 'หน้าปก', icon: '📘', desc: 'ชื่อรายงาน ลูกค้า เลขที่สัญญา เดือน ผู้จัดทำ' },
  chem:     { label: 'ตารางการใช้สารเคมี', icon: '🧪', desc: 'รายชื่อสารเคมี ติ๊กตัวที่ใช้ หมายเหตุ' },
  stations: { label: 'ตารางผลตรวจสถานี/จุดวางอุปกรณ์', icon: '📊', desc: 'เช่น เหยื่อพิษ กาวดักหนู บ้านแมลงสาบ เครื่องดักแมลง พร้อมกราฟรายเดือน' },
  sections: { label: 'สรุปผลการตรวจ & ข้อเสนอแนะ', icon: '📝', desc: 'หัวข้อผลการตรวจ ข้อเสนอแนะโดยบริษัทและโดยลูกค้า' },
  text:     { label: 'ข้อความอิสระ', icon: '✏️', desc: 'หัวข้อ + เนื้อหา เช่น หมายเหตุ แผนงาน ขอบเขตงาน' },
  photos:   { label: 'รูปภาพการทำบริการ', icon: '🖼️', desc: 'หน้าละ 4 / 6 / 9 รูป จัดแนวตั้ง-นอนอัตโนมัติ' },
  image:    { label: 'แนบ Layout / แผนผัง', icon: '🗺️', desc: 'รูปหรือไฟล์ PDF หลายแผ่น 1 แผ่นต่อหน้า พร้อมคำอธิบาย' },
  sign:     { label: 'รายชื่อผู้ทำบริการ & ลงนาม', icon: '✍️', desc: 'รายชื่อช่าง ช่องเซ็นผู้จัดทำ / ผู้รับรายงาน' }
};
const uid = () => 'b' + Math.random().toString(36).slice(2, 9);
function newBlock(type, extra) {
  const b = { id: uid(), type, title: BLOCK_TYPES[type].label, hidden: false, newPage: false };
  if (type === 'cover') Object.assign(b, { title: 'หน้าปก', showContract: true, showDate: true, showPreparer: true, showPests: true });
  if (type === 'chem') Object.assign(b, { title: 'รายงานการใช้สารเคมี · Chemicals Used Report', rows: JSON.parse(JSON.stringify(CUSTOM_DEF.chem)), showNote: true, showActive: true, showRatio: true, showMethod: true, newPage: true });
  if (type === 'stations') Object.assign(b, { title: 'รายงานการวางกล่องเหยื่อพิษกำจัดหนู', unit: 'ก้อน', cols: ['จำนวน (ก้อน)'], found: ['กัดแทะเหยื่อ', 'ไม่กัดแทะเหยื่อ'], showFound: true, showRemark: true, showTotal: true,
    chart: true, chartTitle: 'จำนวนที่พบในแต่ละเดือน', layouts: [], showLayout: true, alert: null, action: null, note: '', rows: Array.from({ length: 5 }, (_, i) => ({ loc: 'จุดที่ ' + (i + 1), v: [0], rem: '' })) });
  if (type === 'sections') Object.assign(b, { title: 'สรุปผลการตรวจสอบและข้อเสนอแนะ', items: JSON.parse(JSON.stringify(CUSTOM_DEF.sections)), showRisk: true, showRiskTable: true, newPage: true });
  if (type === 'text') Object.assign(b, { title: 'หมายเหตุ', body: '' });
  if (type === 'photos') Object.assign(b, { title: CUSTOM_DEF.photoTitle, perPage: 9, photos: [] });
  if (type === 'image') Object.assign(b, { title: 'แผนผังตำแหน่งจุดวางอุปกรณ์', layouts: [], showTitle: true });
  if (type === 'sign') Object.assign(b, { title: 'รายชื่อผู้เข้าทำบริการ', techs: [...CUSTOM_DEF.techs], showTechs: true, showSign: true });
  return Object.assign(b, extra || {});
}
const ST = (title, unit, cols, found, locs, extra) => newBlock('stations', Object.assign({ title, unit, cols, found, showFound: !!found, rows: locs.map(l => ({ loc: l, v: cols.map(() => 0), rem: '' })) }, extra || {}));
/* ───── แบบตารางสถานีสำเร็จรูป (เก็บเป็นข้อมูล เพื่อให้สร้าง/แก้แบบใหม่เองได้) ─────
   key, icon, label, desc, unit, cols[], found [พบ, ไม่พบ] | null, n จุด, prefix ชื่อจุด, locs[] (ถ้ากำหนดชื่อจุดเอง),
   agg 'sum' | 'avg', max, alert, action, chartTitle, showRemark */
const BUILTIN_TPL = [
  { key: 'bait', icon: '🐀', label: 'รายงานการวางกล่องเหยื่อพิษกำจัดหนู', desc: 'จำนวนเหยื่อที่ถูกกัดแทะ (ก้อน) รายกล่อง', unit: 'ก้อน', cols: ['จำนวนที่ถูกกัดแทะ (ก้อน)'], found: ['กัดแทะเหยื่อ', 'ไม่กัดแทะเหยื่อ'], n: 5, prefix: 'กล่องเหยื่อที่ ', chartTitle: 'จำนวนเหยื่อพิษที่ถูกกัดแทะในแต่ละเดือน' },
  { key: 'glue', icon: '🪤', label: 'รายงานการติดกล่องกาวดักหนู', desc: 'จำนวนหนูที่ติดกล่องกาว (ตัว) รายกล่อง', unit: 'ตัว', cols: ['จำนวนหนูที่ติด (ตัว)'], found: ['ติด', 'ไม่ติด'], n: 5, prefix: 'กล่องกาวที่ ', chartTitle: 'จำนวนหนูที่ติดกล่องกาวในแต่ละเดือน' },
  { key: 'crst', icon: '🪳', label: 'รายงานการติดบ้านแมลงสาบ', desc: 'จำนวนแมลงสาบที่ติดบ้านแมลงสาบ แยกชนิด (ตัว)', unit: 'ตัว', cols: ['แมลงสาบอเมริกัน', 'แมลงสาบเยอรมัน'], found: ['พบ', 'ไม่พบ'], n: 5, prefix: 'บ้านแมลงสาบที่ ', chartTitle: 'จำนวนแมลงสาบที่ติดบ้านแมลงสาบในแต่ละเดือน' },
  { key: 'ilt', icon: '🪰', label: 'รายงานการติดแมลงของแผ่นกาว (เครื่องดักแมลง)', desc: 'จำนวนแมลงบนแผ่นกาวแยกชนิด รายเครื่อง พร้อม Alert/Action limit', unit: 'ตัว', cols: ['แมลงวัน', 'แมลงหวี่', 'ยุง', 'ผีเสื้อกลางคืน', 'แมลงอื่น ๆ'], found: null, n: 3, prefix: 'เครื่องดักแมลงที่ ', showRemark: false, chartTitle: 'จำนวนแมลงที่ติดแผ่นกาวในแต่ละเดือน' },
  { key: 'ttb', icon: '🐜', label: 'รายงานการกินเหยื่อกำจัดปลวก', desc: 'เปอร์เซ็นต์การกินเหยื่อรายสถานี (0–100%) กราฟเป็นค่าเฉลี่ย', unit: '%', cols: ['การกินเหยื่อ (%)'], found: ['พบปลวก', 'ไม่พบปลวก'], n: 5, prefix: 'สถานีเหยื่อปลวกที่ ', agg: 'avg', max: 100, chartTitle: 'ค่าเฉลี่ยการกินเหยื่อปลวกในแต่ละเดือน' },
  { key: 'gecko', icon: '🦎', label: 'รายงานการตรวจเช็คสถานีจิ้งจก', desc: 'จำนวนจิ้งจกที่ติดกาวดักจิ้งจก (ตัว) รายสถานี', unit: 'ตัว', cols: ['จำนวนจิ้งจกที่ติด (ตัว)'], found: ['พบ', 'ไม่พบ'], n: 5, prefix: 'สถานีจิ้งจกที่ ', chartTitle: 'จำนวนจิ้งจกที่ติดสถานีในแต่ละเดือน' }
];
let USER_TPL = [];   /* แบบที่ผู้ใช้สร้างเอง (โหลดจากฐานข้อมูล lib-custom ใช้ร่วมทุกลูกค้า) */
const allTpl = () => [...BUILTIN_TPL, ...USER_TPL];
const tplOf = k => allTpl().find(t => t.key === k);
function tplMake(t, x) {
  const locs = (t.locs && t.locs.length) ? t.locs : Array.from({ length: Math.max(1, +t.n || 1) }, (_, i) => (t.prefix || 'จุดที่ ') + (i + 1));
  const ex = { tpl: t.key, chartTitle: t.chartTitle || ('จำนวนที่พบในแต่ละเดือน') };
  if (t.agg === 'avg') ex.agg = 'avg'; if (t.max != null && t.max !== '') ex.max = +t.max; if (t.showRemark === false) ex.showRemark = false;
  if (t.alert != null && t.alert !== '') ex.alert = +t.alert; if (t.action != null && t.action !== '') ex.action = +t.action;
  return ST(t.title || t.label, t.unit || '', [...t.cols], t.found ? [...t.found] : null, locs, Object.assign(ex, x));
}
const STATION_TPL = new Proxy({}, { get: (_, k) => { const t = tplOf(k); return t && Object.assign({}, t, { make: x => tplMake(t, x) }); }, ownKeys: () => allTpl().map(t => t.key), getOwnPropertyDescriptor: (_, k) => tplOf(k) ? { enumerable: true, configurable: true } : undefined });
const PRESETS = {
  standard: { label: 'มาตรฐาน (สารเคมี + สรุปผล + รูป)', make: () => [newBlock('cover'), newBlock('chem'), newBlock('sign', { newPage: false }), newBlock('sections'), newBlock('photos')] },
  stations: { label: 'ตารางสถานีครบชุด (เหยื่อพิษ / กล่องกาว / บ้านแมลงสาบ / แผ่นกาว / เหยื่อปลวก + แผนผัง)', make: () => [newBlock('cover'),
    ...['bait', 'glue', 'crst', 'ilt', 'ttb'].map(k => STATION_TPL[k].make({ newPage: true })), newBlock('sign'), newBlock('image', { newPage: true })] },
  cockroach: { label: 'บ้านแมลงสาบ + สรุปผล + รูป', make: () => [newBlock('cover'), newBlock('chem'),
    STATION_TPL.crst.make({ newPage: true }),
    newBlock('sections'), newBlock('photos', { perPage: 6 })] },
  blank: { label: 'เริ่มจากหน้าเปล่า (มีแค่หน้าปก)', make: () => [newBlock('cover')] }
};
