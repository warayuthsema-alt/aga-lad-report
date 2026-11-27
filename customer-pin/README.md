# ระบบปักหมุดลูกค้าจาก QR

สแกน QR ที่หน้างาน (ลิงก์ Google Maps หรือพิกัด) → ปักหมุดอัตโนมัติ → บันทึกลง Google Sheet

## ไฟล์
- `index.html` หน้าเว็บสำหรับมือถือ วางบน GitHub Pages
- `Code.gs` ส่วนเก็บข้อมูลใน Google Sheet (Apps Script)

## ติดตั้ง (ประมาณ 10 นาที)

### 1. Google Sheet + Apps Script
1. สร้าง Google Sheet ใหม่ เช่น "ตำแหน่งลูกค้า"
2. ไปที่ Extensions > Apps Script แล้ววางโค้ดจาก `Code.gs` ทั้งไฟล์
3. แก้บรรทัด `const TOKEN = 'aga-af660219';` ให้เป็นรหัสของคุณเอง
4. เลือกฟังก์ชัน `setup` แล้วกด Run 1 ครั้ง และกดอนุญาตสิทธิ์ ระบบจะสร้างชีต `Locations` ให้
5. กด Deploy > New deployment > เลือก Web app
   - Execute as: **Me**
   - Who has access: **Anyone**
6. คัดลอก URL ที่ลงท้ายด้วย `/exec`

> ถ้าแก้โค้ด `Code.gs` ภายหลัง ให้ไปที่ Deploy > Manage deployments > Edit > Version: New version ไม่อย่างนั้นโค้ดใหม่จะไม่มีผล

### 2. หน้าเว็บบน GitHub Pages
1. อัปโหลด `index.html` ขึ้น repo (จะสร้าง repo ใหม่ เช่น `aga-customer-pin` หรือใส่ในโฟลเดอร์ของ repo `aga-lad-report` ก็ได้)
2. เปิดหน้าเว็บบนมือถือ แล้วกด **ตั้งค่า** จากนั้นใส่ URL `/exec`, TOKEN และชื่อผู้บันทึก
   (หรือใส่ค่าใน `DEFAULT_URL` / `DEFAULT_TOKEN` ด้านบนสคริปต์ของ `index.html` เลย ช่างจะได้ไม่ต้องตั้งค่าเอง)

ต้องเปิดผ่าน https (GitHub Pages เป็น https อยู่แล้ว) เพราะกล้องและ GPS ทำงานเฉพาะบน https

## วิธีใช้หน้างาน
1. แท็บ **สแกน QR** → เปิดกล้องสแกน (หรือถ่ายรูป QR / วางลิงก์)
2. ระบบแกะพิกัดจาก QR แล้วปักหมุด และอ่าน GPS มือถือมาเทียบให้ ถ้าห่างกันเกิน 300 ม. จะขึ้นเตือนว่า QR อาจไม่ใช่ของร้านนี้
3. ลากหมุดเพื่อปรับได้ หรือแตะบนแผนที่ หรือกด "ใช้ GPS มือถือตอนนี้"
4. กรอกข้อมูลลูกค้าแล้วกดบันทึก ถ้ารหัสลูกค้าซ้ำ ระบบจะแก้ไขข้อมูลในแถวเดิม ไม่สร้างแถวใหม่
5. แท็บ **แผนที่ลูกค้า** → ดูหมุดทั้งหมด ค้นหา เรียงตามระยะใกล้ฉัน กดนำทาง และส่งออก CSV

## QR ที่อ่านได้
- `https://www.google.com/maps/place/...` (ใช้พิกัดจริงของสถานที่ `!3d…!4d…` ก่อนพิกัดกลางจอ `@`)
- `https://maps.google.com/?q=lat,lng`, `…/maps/search/?api=1&query=…`
- ลิงก์สั้น `maps.app.goo.gl/…` (ส่งให้ Apps Script เปิดลิงก์และอ่านพิกัดให้)
- QR จากเว็บสร้าง QR อื่น ๆ (qr-code-generator, me-qr, QR Code Monkey, bit.ly, tinyurl ฯลฯ) — ระบบตามลิงก์ redirect ได้สูงสุด 10 ทอด และอ่านหน้ากลางเพื่อหาปุ่ม/ลิงก์ Google Maps, Apple Maps, Waze, meta refresh หรือ JavaScript redirect
- vCard / MECARD ที่มี `GEO:lat;lng`, ลิงก์ที่มี `?lat=…&lng=…`, Waze `?ll=…`, Apple Maps `?ll=…`
- `geo:lat,lng`, ข้อความ `13.7563, 100.5018` หรือแบบองศา `13°48'58.6"N 100°33'39.4"E`
- ถ้า QR ไม่มีพิกัด ระบบยังเก็บข้อความใน QR ไว้ แล้วให้ปักหมุดด้วย GPS แทน

## ความสามารถเพิ่มเติม
- **ไม่มีสัญญาณ:** ระบบเก็บรายการไว้ในเครื่องก่อน แล้วส่งให้อัตโนมัติเมื่อกลับมาออนไลน์
- **เปิดด้วยลิงก์:** `index.html?u=<ลิงก์แผนที่>` จะปักหมุดให้ทันทีที่เปิดหน้า
- **คอลัมน์ในชีต:** id, created_at, updated_at, code, name, team, addr, contact, phone, lat, lng, maps_url, pin_source, qr_raw, scan_lat, scan_lng, scan_acc, dist_m, note, by
