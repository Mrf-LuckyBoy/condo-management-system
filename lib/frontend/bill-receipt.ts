import type { Billing } from '@/lib/frontend/billing'
import type { MeterLog, Room } from '@/lib/frontend/condo-management'

// Match the printed receipt template supplied by the user.
// Charge mapping (documented so it can be adjusted from one place):
//   ค่าน้ำ                     ← bill.water
//   ค่าขยะ                     ← bill.trashMaintain
//   ค่ารักษามิเตอร์             ← bill.meterMaintain
//   ค่าสาธารณูปโภคประจำเดือน   ← bill.electricity + bill.maintain
//   รวมทั้งสิ้น                 ← sum of everything above

const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
]

const TZ = 'Asia/Bangkok'

function escapeHtml(v: unknown): string {
  const s = v == null ? '' : String(v)
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtBaht(v: number | null | undefined): string {
  if (v == null || v === 0) return '0'
  return v % 1 === 0 ? String(v) : v.toFixed(2)
}

// Extract YYYY / MM / DD in Bangkok time from an ISO string.
function bangkokParts(iso: string): { y: string; m: string; d: string } | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: 'numeric',
  }).formatToParts(d)
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970'
  const m = parts.find((p) => p.type === 'month')?.value ?? '01'
  const dd = parts.find((p) => p.type === 'day')?.value ?? '01'
  return { y, m, d: dd.padStart(2, '0') }
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const p = bangkokParts(iso)
  return p ? `${p.d}-${p.m}-${p.y}` : ''
}

// Thai month + Buddhist Era (พ.ศ. = CE + 543).
function fmtThaiMonth(iso: string | null | undefined): string {
  if (!iso) return ''
  const p = bangkokParts(iso)
  if (!p) return ''
  const monthIdx = Number(p.m) - 1
  const monthName = THAI_MONTHS[monthIdx] ?? p.m
  const beYear = Number(p.y) + 543
  return `${monthName} ${beYear}`
}

export type ReceiptData = {
  bill: Billing
  room: Room | null
  buildingName: string
  // Latest meter log, if any — gives us both previous and current readings for water.
  latestMeterLog: MeterLog | null
  // Optional second-latest log; its createdAt is used as the "previous read date".
  previousMeterLog: MeterLog | null
}

const RECEIPT_STYLES = `
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    color: #000;
    background: #fff;
    font-family: "Sarabun", "TH Sarabun New", "Tahoma", "Segoe UI", sans-serif;
    font-size: 14px;
    line-height: 1.35;
  }
  .receipt {
    padding: 4mm 4mm;
    max-width: 200mm;
    margin: 0 auto;
  }
  /* Print-all pairs two receipts per printed page; single-print has no pair
     wrapper so it just renders one receipt on one page. */
  .receipt-pair {
    page-break-after: always;
    break-after: page;
  }
  .receipt-pair:last-of-type {
    page-break-after: auto;
    break-after: auto;
  }
  .receipt-pair .receipt + .receipt {
    margin-top: 4mm;
    padding-top: 4mm;
    border-top: 1px dashed #999;
  }
  .receipt__title {
    text-align: center;
    font-size: 20px;
    font-weight: 700;
    margin-bottom: 6px;
  }
  .receipt__meta {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 14px;
    padding: 0 8px;
    margin-bottom: 12px;
  }
  .receipt__meta-mid {
    font-size: 16px;
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 4px;
  }
  .receipt__info {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 16px;
    margin-bottom: 10px;
    font-size: 13px;
  }
  .receipt__info-slot {
    border-bottom: 1px dotted #333;
    display: inline-block;
    min-width: 120px;
    padding: 0 6px;
  }
  table.bill {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  table.bill th,
  table.bill td {
    border: 1px solid #000;
    padding: 4px 6px;
    text-align: center;
    vertical-align: middle;
  }
  table.bill th { font-weight: 700; background: #f7f7f7; }
  table.bill td.num { text-align: right; padding-right: 8px; font-variant-numeric: tabular-nums; }
  table.bill td.label { text-align: left; padding-left: 10px; }
  table.bill tr.total td { font-weight: 700; }
  .signatures {
    display: flex;
    justify-content: space-around;
    margin-top: 18px;
    padding: 0 14mm;
    gap: 16px;
  }
  .signature { text-align: center; font-size: 12px; flex: 1; }
  .signature__line {
    border-bottom: 1px dotted #000;
    height: 20px;
    margin-bottom: 3px;
  }
  .note {
    margin-top: 10px;
    font-size: 11px;
    color: #333;
    padding: 0 8px;
  }
  @media print {
    html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`

function renderReceiptBody(data: ReceiptData): string {
  // buildingName kept on the type but not rendered — the receipt header is a
  // fixed juristic-person string per the printed template.
  const { bill, room, latestMeterLog, previousMeterLog } = data

  // Water meter readings — prefer the meter log for old/new pair, fall back to the room.
  const currentReading =
    latestMeterLog?.newWaterUnit ?? room?.waterUnit ?? null
  const previousReading = latestMeterLog?.oldWaterUnit ?? null
  const currentDate = fmtDate(latestMeterLog?.createdAt ?? bill.createdAt)
  const previousDate = fmtDate(previousMeterLog?.createdAt ?? null)
  const unitsUsed =
    currentReading != null && previousReading != null
      ? Math.max(0, currentReading - previousReading)
      : ''

  const water = bill.water ?? 0
  const trash = bill.trashMaintain ?? 0
  const meter = bill.meterMaintain ?? 0
  const subtotal = water + trash + meter

  const monthlyUtility = (bill.electricity ?? 0) + (bill.maintain ?? 0)
  const grandTotal = subtotal + monthlyUtility

  const monthLabel = fmtThaiMonth(bill.createdAt)
  const receiptNo = String(bill.id).padStart(3, '0')
  // Building prefix "80/" per the juristic-person's numbering scheme.
  const roomNo = room?.roomNumber != null ? `80/${room.roomNumber}` : ''

  return `
  <div class="receipt">
    <div class="receipt__title">นิติบุคคลอาคารชุด เศรษฐกิจซิตี้</div>

    <div class="receipt__meta">
      <span>เล่มที่ 001</span>
      <span class="receipt__meta-mid">ใบเสร็จค่าน้ำ</span>
      <span>เลขที่ ${escapeHtml(receiptNo)}</span>
    </div>

    <div class="receipt__info">
      <div>ชื่อ <span class="receipt__info-slot">&nbsp;</span></div>
      <div>ห้องชุดเลขที่ <span class="receipt__info-slot">${escapeHtml(roomNo)}</span></div>
      <div>มิเตอร์หมายเลข <span class="receipt__info-slot">&nbsp;</span></div>
      <div>ทะเบียนเลขที่ <span class="receipt__info-slot">&nbsp;</span></div>
    </div>

    <table class="bill">
      <thead>
        <tr>
          <th colspan="2">จดครั้งนี้</th>
          <th colspan="2">จดครั้งก่อน</th>
          <th>จำนวน</th>
          <th>จำนวนเงิน</th>
          <th rowspan="2">ค่าขยะ</th>
          <th rowspan="2">ค่ารักษามิเตอร์</th>
          <th rowspan="2">รวมเป็นเงิน</th>
        </tr>
        <tr>
          <th>วัน-เดือน-ปี</th>
          <th>เลขมิเตอร์</th>
          <th>วัน-เดือน-ปี</th>
          <th>เลขมิเตอร์</th>
          <th>หน่วยที่ใช้</th>
          <th>ค่าน้ำ</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(currentDate)}</td>
          <td>${escapeHtml(currentReading ?? '')}</td>
          <td>${escapeHtml(previousDate)}</td>
          <td>${escapeHtml(previousReading ?? '')}</td>
          <td>${escapeHtml(unitsUsed)}</td>
          <td class="num">${fmtBaht(water)}</td>
          <td class="num">${fmtBaht(trash)}</td>
          <td class="num">${fmtBaht(meter)}</td>
          <td class="num">${fmtBaht(subtotal)}</td>
        </tr>
        <tr>
          <td class="label" colspan="8">
            ค่าสาธารณูปโภคประจำเดือน ${escapeHtml(monthLabel)}
          </td>
          <td class="num">${fmtBaht(monthlyUtility)}</td>
        </tr>
        <tr class="total">
          <td colspan="8" style="text-align:right; padding-right:12px;">รวมทั้งสิ้น</td>
          <td class="num">${fmtBaht(grandTotal)}</td>
        </tr>
      </tbody>
    </table>

    <div class="signatures">
      <div class="signature">
        <div class="signature__line"></div>
        <div>ผู้บัญชี</div>
      </div>
      <div class="signature">
        <div class="signature__line"></div>
        <div>ผู้จัดการโครงการ</div>
      </div>
      <div class="signature">
        <div class="signature__line"></div>
        <div>พนักงานเก็บเงิน</div>
      </div>
    </div>

    <div class="note">
      หมายเหตุ. ใบเสร็จนี้จะสมบูรณ์ ต้องมีลายมือชื่อครบทั้ง 3 คน
    </div>
  </div>`
}

function wrapReceiptDoc(bodyHtml: string, title: string): string {
  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>${RECEIPT_STYLES}</style>
</head>
<body>${bodyHtml}</body>
</html>`
}

export function buildReceiptHtml(data: ReceiptData): string {
  const receiptNo = String(data.bill.id).padStart(3, '0')
  return wrapReceiptDoc(renderReceiptBody(data), `ใบเสร็จ #${receiptNo}`)
}

// Combined document containing every receipt, two per printed page.
// The .receipt-pair wrapper controls the page-break boundary.
export function buildReceiptsHtml(items: ReceiptData[], title: string): string {
  const pairs: string[] = []
  for (let i = 0; i < items.length; i += 2) {
    const first = renderReceiptBody(items[i])
    const second = i + 1 < items.length ? renderReceiptBody(items[i + 1]) : ''
    pairs.push(`<div class="receipt-pair">${first}${second}</div>`)
  }
  return wrapReceiptDoc(pairs.join('\n'), title)
}

// Renders the given HTML in a hidden iframe and pops the browser print dialog.
// User can save-as-PDF from that dialog (Electron/Chromium behave the same).
export function printReceiptHtml(html: string): void {
  const iframe = document.createElement('iframe')
  iframe.style.cssText =
    'position:fixed; right:0; bottom:0; width:0; height:0; border:0; visibility:hidden;'
  iframe.srcdoc = html

  iframe.onload = () => {
    const win = iframe.contentWindow
    if (!win) {
      iframe.remove()
      return
    }
    // Some browsers unfocus the iframe when print closes; ensure it's focused first.
    win.focus()
    win.print()
    // Clean up after the dialog is dismissed. Fallback timeout in case afterprint doesn't fire.
    win.addEventListener('afterprint', () => iframe.remove(), { once: true })
    setTimeout(() => {
      if (document.body.contains(iframe)) iframe.remove()
    }, 60_000)
  }

  document.body.appendChild(iframe)
}
