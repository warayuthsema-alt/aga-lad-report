/* ค่าตั้งต้นของลูกค้าแต่ละราย (แก้ไขเพิ่มเติมได้ที่แท็บ "ตั้งค่า" ในหน้าแต่ละลูกค้า — ค่าที่บันทึกจะเก็บใน Supabase และทับค่าในไฟล์นี้) */
"use strict";
const EN_GUIDE_ADV = '1. If the pest is at normal levels.\n   1.1 Implementation for the plan of prevention the pest.\n2. If the pest is moderate.\n   2.1 Implementation for the plan of prevention the pest.\n   2.2 explore the problems encountered by the team leader.\n3. In the case of pest and disease.\n   3.1 explore the problem further by the Supervisor/Operation manager';
const EN_GUIDE_CLIENT = '1.Always,should be survey in the area.\n2.Environmental Improvement such as cleaning ,sealed waste storage,waste disposal.\n3.Close entrance tightly; do not left door or plastic curtain open to prevent insects come to the area; and fix any crack, hole or damaged area to prevent insects come to the building.';
const QC_SITES = {
/* ───────────────────────── บ.ดิ อีลิท ไบโอเทค ───────────────────────── */
elite: {
  lang: 'th', title: 'รายงานประจำเดือน บ.ดิ อีลิท ไบโอเทค',
  client: 'บริษัท ดิ อีลิท ไบโอเทค จำกัด', contracts: ['CT26-0017071'],
  preparer: 'นางสาว พรไพลิน ไคร้ชม', preparerTitle: 'หัวหน้างานสาขาลาดพร้าว',
  yearStart: 7, svcTime: '15.00',
  techs: ['นาย ศักดิ์ชาย สุขขา', 'นาย ศิโรจน์ พิทักษ์คูสุวรรณ', 'นาย วีระชัย อักษร'],
  bait: { st: ['รอบอาคาร จุดที่ 1','รอบอาคาร จุดที่ 2','รอบอาคาร จุดที่ 3','รอบอาคาร จุดที่ 4','รอบอาคาร จุดที่ 5','รอบอาคาร จุดที่ 6','โรงจอดรถ จุดที่ 7','โรงจอดรถ จุดที่ 8','ศาลพระภูมิ จุดที่ 9','ห้องขยะ จุดที่ 10'], cap: 5 },
  glue: { st: ['ใต้บันได จุดที่ 1','ลานโหลด จุดที่ 1','พื้นที่ว่างภายในอาคาร','หน้าห้องน้ำ','ห้องแต่งตัว','พื้นที่วางสินค้าสำเร็จรูป','ห้องเก็บรักษาเครื่องสำอาง จุดที่ 1','ห้องเก็บรักษาเครื่องสำอาง จุดที่ 2','ห้องเก็บรักษาเครื่องสำอาง จุดที่ 3','ลานโหลด จุดที่ 2'] },
  ilt: { st: ['หน้าโกดัง','หน้าทางเข้าไลน์ผลิต','หน้าห้องสินค้าสำเร็จรูป','หน้าห้องน้ำ'], sp: ['แมลงวัน','แมลงหวี่','ยุง','แมลงอื่น'], onoff: true },
  notes: { bait: 'เน้นการสเปรย์เคมีบริเวณซอกมุม เน้นย้ำพนักงานทำความสะอาดให้ทั่วถึง', glue: 'ตรวจเช็คจำนวนหนูในรอบบริการถัดไป', ilt: 'ตรวจเช็คจำนวนแมลงในรอบบริการถัดไป' },
  layouts: [{ key: 'L1', label: 'แผนผังตำแหน่งจุดวางกับดัก', src: 'img/elite-layout.jpg' }],
  blocks: ['cover', 'bait', 'glue', 'ilt', 'layout'],
  hist: { '2026-07': { bait: 10, glue: 0, ilt: 4242 }, '2026-08': { bait: 10, glue: 0, ilt: 2099 }, '2026-09': { bait: 20, glue: 0, ilt: 716 } }
},
/* ───────────────────────── Baxter ───────────────────────── */
baxter: {
  lang: 'en', title: 'Monthly Report · Baxter International',
  client: 'Baxter International (Thailand) Co.,Ltd.', client2: 'Baxter Healthcare (Thailand) Co.,Ltd.Head Office',
  contracts: ['CT26-0019980'], preparer: 'Pornpailin Khraichom', preparerTitle: 'Service Supervisor', preparerTH: 'นางสาว พรไพลิน ไคร้ชม',
  yearStart: 1,
  ilt: { st: ['Entrance of office area','Work shop','Product line area','Wait decon-tamination area','Decontamination holding'],
         sp: ['(Mosquitoes) (Midges)','(Pomace Flies, Drain Flies)','(Flies)','(Other)'], spShort: ['Mosquitoes','Pomace Flies','Flies','Other'],
         spLegend: ['Mosquitoes, Midges','Pomace Flies, Drain Flies','Flies','Other'],
         alert: [73,73,73,73,73], action: [87,87,87,87,87], siteAlert: 73, siteAction: 87, showNoteCol: true },
  cr: { st: ['Cockroach Station 1','Cockroach Station 2','Cockroach Station 3','Cockroach Station 4','Cockroach Station 5','Cockroach Station 6','Cockroach Station 7','Cockroach Station 8','Cockroach Station 9','Cockroach Station 10'] },
  guideAdv: EN_GUIDE_ADV, guideClient: EN_GUIDE_CLIENT, clientGuideName: 'Baxter Healthcare (Thailand) Co.,Ltd.Head Office',
  yearTotals: { '2024': [37,53,46,39,67,42,44,54,67,45,45,28], '2025': [13,33,22,23,63,58,52,49,39,39,35,26] },
  limitRemark: 'The chart above shows the results from the monthly inspection of all insects.\nAlert limit Refers to the insect infestation limit derived from the insect count results in 2021-2023 divided by the number of months. (Mean) plus two times the standard deviation.\n**If the inspection result is equal to / above the outbreak limit (Alert limit) Considered the surveillance situation\nAction limit Refers to the insect infestation limit derived from the insect count results in 2021-2023 divided by the number of months. (Mean) plus three times the standard deviation.\n**If the inspection result is equal to / above the outbreak limit (Action limit) Considered the surveillance situation',
  layouts: [{ key: 'L1', label: 'Location Plan for Pest control', src: 'img/baxter-layout.jpg' }],
  blocks: ['cover', 'iltTable', 'crCharts', 'iltCharts', 'iltSummary', 'layout'],
  hist: {"2026-01":{"iltSp":[[1,10,0,0],[2,0,0,0],[0,5,0,0],[0,2,0,0],[2,1,0,0]],"iltTot":25,"cr":[0,0,0,0,0,0,0,0,0,0]},"2026-02":{"iltSp":[[3,9,0,0],[4,2,0,0],[0,3,0,0],[0,1,0,0],[1,5,0,0]],"iltTot":28,"cr":[0,0,0,0,0,0,0,0,0,0]},"2026-03":{"iltSp":[[2,12,1,0],[0,5,0,0],[0,9,0,0],[0,0,1,0],[2,7,2,0]],"iltTot":41,"cr":[0,0,0,0,0,0,0,0,0,0]},"2026-04":{"iltSp":[[7,15,1,0],[0,9,0,0],[0,7,0,0],[0,3,0,0],[1,6,4,0]],"iltTot":50,"cr":[0,0,0,0,0,0,0,0,0,0]},"2026-05":{"iltSp":[[4,10,2,0],[1,6,0,0],[0,4,0,0],[0,2,0,0],[2,7,2,0]],"iltTot":48,"cr":[0,0,0,0,0,0,0,0,0,0]},"2026-06":{"iltSp":[[2,7,4,0],[2,4,0,0],[6,0,0,0],[0,5,0,0],[4,11,4,0]],"iltTot":49,"cr":[0,0,0,0,0,0,0,0,0,0]},"2026-07":{"iltSp":[[4,8,1,0],[3,5,1,0],[0,2,0,0],[2,7,0,0],[1,6,1,0]],"iltTot":40,"cr":[0,0,0,0,0,0,0,0,0,0]},"2026-08":{"iltSp":[[9,8,0,0],[4,3,1,0],[0,4,0,0],[3,1,0,0],[2,3,1,0]],"iltTot":39,"cr":[0,0,0,0,0,0,0,0,0,0]},"2026-09":{"iltSp":[[1,7,0,0],[3,5,0,0],[0,3,0,0],[0,8,0,0],[0,9,0,0]],"iltTot":36,"cr":[0,0,0,0,0,0,0,0,0,0]}}
},
/* ───────────────────────── Vantive ───────────────────────── */
vantive: {
  lang: 'en', title: 'Monthly Report · Vantive Healthcare',
  client: 'Vantive Healthcare (Thailand) Co., Ltd.', contracts: ['CT26-0004089', 'CT26-0004092'],
  preparer: 'Pornpailin Khraichom', preparerTitle: 'Service Supervisor', preparerTH: 'นางสาว พรไพลิน ไคร้ชม',
  yearStart: 1,
  ilt: { st: ['Entrance of office area','Work shop','Product delivery','Front cleaning area','Pantry','Spare part','Storage area'],
         sp: ['(Mosquitoes)','(Pomace Flies,Drain Flies)','(Flies)','(Other)'], spShort: ['Mosquitos','Pomace Flies,Drain Flies','Flies','Other'],
         alert: [26,12,7,16,25,10,14], action: [52,24,14,31,50,20,27],
         checks: ['Cleaning', 'Conducted lighting inspection', 'Replace the insect sticky trap.'] },
  cr: { st: Array.from({ length: 17 }, (_, i) => 'Crawling insects Station ' + (i + 1)), limit: 1, start: { 15: '2026-04', 16: '2026-04' } },
  guideAdv: EN_GUIDE_ADV, guideClient: EN_GUIDE_CLIENT, clientGuideName: 'Vantive Healthcare (Thailand) Co., Ltd.',
  flyGuide: '1. Keep workspaces and office exterior clean. Proper pest control management begins with keeping the office area clean at all time. Your office can achieve this by imposing rules on proper waste management, food handling, and regular cleaning.\n2. Find sources of water in area. Pest control management often includes finding possible sources of food and habitation of the pests. Most of these pests such as rodents and cockroaches thrive in warm, moist, and dark areas of the office that often don’t get noticed such as plumbing areas, fountains or ponds, bathrooms, kitchens, and others. You should clean your space regularly.\n3. Assign areas for eating, Create proper waste management and Practice proper hygiene and sanitation.\n4. Check Deliveries and Shipments.\n5. Always close the office entrance door after entering the office. Do not leave the door open.',
  layouts: [{ key: 'L1', label: 'Location Plan 3rd Floor', src: 'img/vantive-layout-3f.jpg' }, { key: 'L2', label: 'Location Plan 2nd Floor', src: 'img/vantive-layout-2f.jpg' }],
  blocks: ['cover', 'crTable', 'crSummary', 'iltTable', 'iltStation', 'flyRisk', 'layout'],
  hist: {"2026-01":{"iltSt":[34,15,10,7,22,5,7],"cr":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,null,null]},"2026-02":{"iltSt":[26,17,9,18,16,11,3],"cr":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,null,null]},"2026-03":{"iltSt":[24,11,7,5,21,4,7],"cr":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,null,null]},"2026-04":{"iltSt":[4,10,3,2,6,11,13],"cr":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},"2026-05":{"iltSt":[13,4,2,3,16,8,9],"cr":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},"2026-06":{"iltSt":[13,8,4,3,7,8,10],"cr":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},"2026-07":{"iltSt":[6,3,3,3,11,7,13],"cr":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},"2026-08":{"iltSt":[16,5,4,3,5,9,3],"cr":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},"2026-09":{"iltSt":[12,8,5,4,11,5,4],"cr":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]}}
}
};
