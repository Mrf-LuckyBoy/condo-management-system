import type { ReceiptData } from './bill-receipt'

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function baht(value: number | null | undefined): string {
  const amount = value ?? 0
  return amount % 1 === 0 ? String(amount) : amount.toFixed(2)
}

function dateParts(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  return Object.fromEntries(parts.map((part) => [part.type, part.value])) as Record<string, string>
}

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

export function renderApartmentReceiptBody(data: ReceiptData): string {
  const { bill, room, latestMeterLog } = data
  const currentDate = dateParts(bill.createdAt)
  const monthEndDay = currentDate
    ? new Date(Number(currentDate.year), Number(currentDate.month), 0).getDate()
    : ''
  const month = currentDate
    ? `${THAI_MONTHS[Number(currentDate.month) - 1]} พ.ศ. ${Number(currentDate.year) + 543}`
    : ''
  const roomNumber = room?.roomNumber == null ? '' : String(room.roomNumber)
  const rent = room?.rentPrice ?? 0
  const water = bill.water ?? 0
  const electricity = bill.electricity ?? 0
  const total = rent + water + electricity
  const waterRate = data.setting?.waterPerUnit ?? 0
  const electricityRate = data.setting?.electricityPerUnit ?? 0
  const waterUnits = latestMeterLog?.oldWaterUnit != null && latestMeterLog.newWaterUnit != null
    ? Math.max(0, latestMeterLog.newWaterUnit - latestMeterLog.oldWaterUnit)
    : null
  const electricityUnits = latestMeterLog?.oldElectricityUnit != null && latestMeterLog.newElectricityUnit != null
    ? Math.max(0, latestMeterLog.newElectricityUnit - latestMeterLog.oldElectricityUnit)
    : null

  return `<main class="apartment-bill page">
    <header><h1>ใบแจ้งหนี้</h1></header>
    <section>
      <h2>${escapeHtml(data.buildingName || 'เศรษฐกิจแมนชั่น')}</h2>
      <div class="apartment-bill__meta">
        <span><strong>ห้อง</strong> ${escapeHtml(roomNumber)}</span>
        <span><strong>วันที่</strong> ${escapeHtml(monthEndDay)}</span>
        <span><strong>เดือน</strong> ${escapeHtml(month)}</span>
        <span><strong>เลขที่</strong> ${escapeHtml(String(bill.id).padStart(3, '0'))}</span>
      </div>
      <h2>รายการที่ต้องชำระ</h2>
      <p>มีผู้เช่า</p>
      <p>ค่าเช่าห้อง ${baht(rent)} บาท</p>
      <p>ค่าน้ำ ${baht(water)} บาท (จำนวน ${waterUnits ?? 0} หน่วย, ครั้งหลัง ${escapeHtml(latestMeterLog?.newWaterUnit ?? '')} ครั้งก่อน ${escapeHtml(latestMeterLog?.oldWaterUnit ?? '')} หน่วยละ ${baht(waterRate)} บาท)</p>
      <p>ค่าไฟ ${baht(electricity)} บาท (จำนวน ${electricityUnits ?? 0} หน่วย, ครั้งหลัง ${escapeHtml(latestMeterLog?.newElectricityUnit ?? '')} ครั้งก่อน ${escapeHtml(latestMeterLog?.oldElectricityUnit ?? '')} หน่วยละ ${baht(electricityRate)} บาท)</p>
      <h2>รวมเงิน ${baht(total)} บาท</h2>
    </section>
    <section class="apartment-bill__payment">
      <h2><u>กำหนดชำระเงินวันที่ 1-10 ของทุกเดือน</u></h2>
      <p>หมายเหตุ ขอแจ้งให้ท่านผู้เช่าชำระค่าเช่าภายในกำหนดวันของทุกเดือน ถ้าเกินกำหนดทางแมนชั่นมีความจำเป็นที่จะต้องงดจ่ายน้ำและไฟฟ้า เพื่อให้เป็นไปตามข้อตกลงของทางแมนชั่นจึงแจ้งมาเพื่อทราบโดยทั่วกัน ขอขอบคุณล่วงหน้า<br />(กรุณาขอรับใบเสร็จจากผู้รับเงินทุกครั้งเพื่อเป็นหลักฐาน)</p>
    </section>
    <footer><h2>ใบแจ้งหนี้นี้ไม่ใช่ใบเสร็จ</h2></footer>
  </main>`
}
