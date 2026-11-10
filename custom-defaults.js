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
  image:    { label: 'รูปเต็มหน้า (แผนผัง / Layout)', icon: '🗺️', desc: 'แผนผังจุดวางอุปกรณ์ เอกสารสแกน 1 รูปต่อหน้า' },
  sign:     { label: 'รายชื่อผู้ทำบริการ & ลงนาม', icon: '✍️', desc: 'รายชื่อช่าง ช่องเซ็นผู้จัดทำ / ผู้รับรายงาน' }
};
const uid = () => 'b' + Math.random().toString(36).slice(2, 9);
function newBlock(type, extra) {
  const b = { id: uid(), type, title: BLOCK_TYPES[type].label, hidden: false, newPage: false };
  if (type === 'cover') Object.assign(b, { title: 'หน้าปก', showContract: true, showDate: true, showPreparer: true, showPests: true });
  if (type === 'chem') Object.assign(b, { title: 'รายงานการใช้สารเคมี · Chemicals Used Report', rows: JSON.parse(JSON.stringify(CUSTOM_DEF.chem)), showNote: true, showActive: true, showRatio: true, showMethod: true, newPage: true });
  if (type === 'stations') Object.assign(b, { title: 'รายงานการวางกล่องเหยื่อพิษกำจัดหนู', unit: 'ก้อน', cols: ['จำนวน (ก้อน)'], found: ['กัดแทะเหยื่อ', 'ไม่กัดแทะเหยื่อ'], showFound: true, showRemark: true, showTotal: true,
    chart: true, chartTitle: 'จำนวนที่พบในแต่ละเดือน', alert: null, action: null, note: '', rows: Array.from({ length: 5 }, (_, i) => ({ loc: 'จุดที่ ' + (i + 1), v: [0], rem: '' })) });
  if (type === 'sections') Object.assign(b, { title: 'สรุปผลการตรวจสอบและข้อเสนอแนะ', items: JSON.parse(JSON.stringify(CUSTOM_DEF.sections)), showRisk: true, showRiskTable: true, newPage: true });
  if (type === 'text') Object.assign(b, { title: 'หมายเหตุ', body: '' });
  if (type === 'photos') Object.assign(b, { title: CUSTOM_DEF.photoTitle, perPage: 9, photos: [] });
  if (type === 'image') Object.assign(b, { title: 'แผนผังตำแหน่งจุดวางอุปกรณ์', img: null, showTitle: true });
  if (type === 'sign') Object.assign(b, { title: 'รายชื่อผู้เข้าทำบริการ', techs: [...CUSTOM_DEF.techs], showTechs: true, showSign: true });
  return Object.assign(b, extra || {});
}
const ST = (title, unit, cols, found, locs, extra) => newBlock('stations', Object.assign({ title, unit, cols, found, showFound: !!found, rows: locs.map(l => ({ loc: l, v: cols.map(() => 0), rem: '' })) }, extra || {}));
const PRESETS = {
  standard: { label: 'มาตรฐาน (สารเคมี + สรุปผล + รูป)', make: () => [newBlock('cover'), newBlock('chem'), newBlock('sign', { newPage: false }), newBlock('sections'), newBlock('photos')] },
  stations: { label: 'ตารางสถานี (เหยื่อพิษ / กาว / เครื่องดักแมลง + แผนผัง)', make: () => [newBlock('cover'),
    ST('รายงานการวางกล่องเหยื่อพิษกำจัดหนู', 'ก้อน', ['จำนวน (ก้อน)'], ['กัดแทะเหยื่อ', 'ไม่กัดแทะเหยื่อ'], ['รอบอาคาร จุดที่ 1', 'รอบอาคาร จุดที่ 2', 'รอบอาคาร จุดที่ 3', 'รอบอาคาร จุดที่ 4', 'รอบอาคาร จุดที่ 5'], { newPage: true, chartTitle: 'จำนวนเหยื่อพิษที่ถูกกัดแทะในแต่ละเดือน' }),
    ST('รายงานการวางกล่องกาวดักหนู', 'ตัว', ['จำนวน (ตัว)'], ['ติด', 'ไม่ติด'], ['จุดที่ 1', 'จุดที่ 2', 'จุดที่ 3', 'จุดที่ 4', 'จุดที่ 5'], { newPage: true, chartTitle: 'จำนวนหนูในแต่ละเดือน' }),
    ST('รายงานการตรวจเช็คเครื่องดักแมลง', 'ตัว', ['แมลงวัน', 'แมลงหวี่', 'ยุง', 'แมลงอื่น'], null, ['เครื่องที่ 1', 'เครื่องที่ 2', 'เครื่องที่ 3'], { newPage: true, showRemark: false, chartTitle: 'จำนวนแมลงในแต่ละเดือน' }),
    newBlock('sign'), newBlock('image', { newPage: true })] },
  cockroach: { label: 'บ้านแมลงสาบ + สรุปผล + รูป', make: () => [newBlock('cover'), newBlock('chem'),
    ST('รายงานการตรวจเช็คบ้านแมลงสาบ', 'ตัว', ['จำนวนที่พบ (ตัว)'], ['พบ', 'ไม่พบ'], ['จุดที่ 1', 'จุดที่ 2', 'จุดที่ 3', 'จุดที่ 4', 'จุดที่ 5'], { newPage: true, chartTitle: 'จำนวนแมลงสาบในแต่ละเดือน' }),
    newBlock('sections'), newBlock('photos', { perPage: 6 })] },
  blank: { label: 'เริ่มจากหน้าเปล่า (มีแค่หน้าปก)', make: () => [newBlock('cover')] }
};
