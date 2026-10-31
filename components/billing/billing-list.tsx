'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Combobox from '@/components/ui/combobox'
import BillingForm from '@/components/billing/billing-form'
import BillingEditDialog from '@/components/billing/billing-edit-dialog'
import BillingPayDialog from '@/components/billing/billing-pay-dialog'
import {
  fetchBuildings,
  fetchRoom,
  fetchRooms,
  fetchRoomMeterLogs,
  type DropdownItem,
} from '@/lib/frontend/condo-management'
import { listBillings, type Billing } from '@/lib/frontend/billing'
import {
  buildReceiptHtml,
  buildReceiptsHtml,
  printReceiptHtml,
  type ReceiptData,
} from '@/lib/frontend/bill-receipt'

// Display is Bangkok time (UTC+7); backend stores/filters in UTC.
const DISPLAY_TZ = 'Asia/Bangkok'

// "Current month" is the month the user sees in their local (UTC+7) calendar.
function currentMonthValue(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DISPLAY_TZ,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970'
  const m = parts.find((p) => p.type === 'month')?.value ?? '01'
  return `${y}-${m}`
}

function formatBaht(v: number | null): string {
  if (v == null) return '—'
  return `฿${v.toFixed(2)}`
}

// Base maintenance + trash + meter — the three "service" charges collapse into
// a single table column since none of them is meaningful on its own.
function serviceCharge(b: Billing): number {
  return (b.maintain ?? 0) + (b.trashMaintain ?? 0) + (b.meterMaintain ?? 0)
}

function billingTotal(b: Billing): number {
  return (b.electricity ?? 0) + (b.water ?? 0) + serviceCharge(b)
}

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

const THAI_MONTHS_SHORT = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
]

// Single-field month picker styled to look like the old <input type="month">,
// but with Thai labels. Value/onChange stay as "YYYY-MM" in CE — display uses
// Buddhist Era (พ.ศ. = CE + 543) which is standard in Thai UIs.
type MonthPickerProps = { value: string; onChange: (next: string) => void }
function MonthPicker({ value, onChange }: MonthPickerProps) {
  const [yStr, mStr] = value.split('-')
  const yearCE = Number(yStr)
  const month = Number(mStr)

  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(yearCE)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Reset the popup's view year to the current selection each time it opens.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Preserve the original UI's prop-driven form reset/loading lifecycle.
    if (open) setViewYear(yearCE)
  }, [open, yearCE])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function pick(m: number) {
    const mm = String(m).padStart(2, '0')
    onChange(`${viewYear}-${mm}`)
    setOpen(false)
  }

  const displayText = `${THAI_MONTHS[month - 1] ?? ''} พ.ศ. ${yearCE + 543}`

  return (
    <div className="month-picker" ref={wrapRef}>
      <button
        type="button"
        className="month-picker__trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {displayText}
      </button>
      {open && (
        <div className="month-picker__popup" role="dialog">
          <div className="month-picker__nav">
            <button
              type="button"
              className="month-picker__nav-btn"
              onClick={() => setViewYear((y) => y - 1)}
              aria-label="ปีก่อนหน้า"
            >
              ‹
            </button>
            <span className="month-picker__nav-year">พ.ศ. {viewYear + 543}</span>
            <button
              type="button"
              className="month-picker__nav-btn"
              onClick={() => setViewYear((y) => y + 1)}
              aria-label="ปีถัดไป"
            >
              ›
            </button>
          </div>
          <div className="month-picker__grid">
            {THAI_MONTHS_SHORT.map((name, i) => {
              const m = i + 1
              const isSelected = viewYear === yearCE && m === month
              return (
                <button
                  key={m}
                  type="button"
                  className={
                    'month-picker__month' + (isSelected ? ' month-picker__month--selected' : '')
                  }
                  onClick={() => pick(m)}
                >
                  {name}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function BillingList() {
  const [buildings, setBuildings] = useState<DropdownItem[]>([])
  const [buildingsError, setBuildingsError] = useState<string | null>(null)
  const [selectedBuilding, setSelectedBuilding] = useState<DropdownItem | null>(null)
  const [buildingResetSignal] = useState(0)

  const [month, setMonth] = useState<string>(currentMonthValue())

  const [rooms, setRooms] = useState<DropdownItem[]>([])
  const [billings, setBillings] = useState<Billing[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingBilling, setEditingBilling] = useState<Billing | null>(null)
  const [payingBilling, setPayingBilling] = useState<Billing | null>(null)
  const [printingBillId, setPrintingBillId] = useState<number | null>(null)
  const [printingAll, setPrintingAll] = useState(false)

  useEffect(() => {
    fetchBuildings()
      .then(setBuildings)
      .catch((err: Error) => setBuildingsError(err.message))
  }, [])

  // Load rooms for label lookup. Scoped to selected building when set, otherwise all rooms.
  useEffect(() => {
    fetchRooms(selectedBuilding ? Number(selectedBuilding.id) : undefined)
      .then(setRooms)
      .catch(() => setRooms([]))
  }, [selectedBuilding])

  const roomLabelById = useMemo(() => {
    const map = new Map<number, string>()
    for (const r of rooms) map.set(Number(r.id), r.label)
    return map
  }, [rooms])

  const loadBillings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listBillings({
        buildingId: selectedBuilding ? Number(selectedBuilding.id) : undefined,
        // Backend expands YYYY-MM-DD into the whole UTC month.
        date: month ? `${month}-01` : undefined,
        page: 1,
        pageSize: 100,
      })
      setBillings(res.data)
      setTotal(res.total)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      setBillings([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [selectedBuilding, month])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Preserve the original UI's prop-driven form reset/loading lifecycle.
    loadBillings()
  }, [loadBillings])

  async function gatherReceiptData(bill: Billing): Promise<ReceiptData> {
    const room = await fetchRoom(bill.roomId).catch(() => null)
    const meterLogsRes = room
      ? await fetchRoomMeterLogs(room.id, { pageSize: 2 }).catch(() => null)
      : null
    const [latestMeterLog = null, previousMeterLog = null] = meterLogsRes?.data ?? []
    const buildingName =
      (room && buildings.find((b) => Number(b.id) === room.buildingId)?.label) ?? ''
    return { bill, room, buildingName, latestMeterLog, previousMeterLog }
  }

  async function handlePrint(bill: Billing) {
    setPrintingBillId(bill.id)
    try {
      const data = await gatherReceiptData(bill)
      printReceiptHtml(buildReceiptHtml(data))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      window.alert(`ไม่สามารถเปิดใบเสร็จได้: ${message}`)
    } finally {
      setPrintingBillId(null)
    }
  }

  async function handlePrintAll() {
    if (billings.length === 0) return
    setPrintingAll(true)
    try {
      // Dedupe room fetches: many bills, but each room has one lookup.
      const uniqueRoomIds = Array.from(new Set(billings.map((b) => b.roomId)))

      const [roomPairs, logPairs] = await Promise.all([
        Promise.all(
          uniqueRoomIds.map(async (id) => {
            const room = await fetchRoom(id).catch(() => null)
            return [id, room] as const
          }),
        ),
        Promise.all(
          uniqueRoomIds.map(async (id) => {
            const res = await fetchRoomMeterLogs(id, { pageSize: 2 }).catch(() => null)
            return [id, res?.data ?? []] as const
          }),
        ),
      ])

      const roomsById = new Map(roomPairs)
      const logsById = new Map(logPairs)

      const items: ReceiptData[] = billings.map((bill) => {
        const room = roomsById.get(bill.roomId) ?? null
        const logs = logsById.get(bill.roomId) ?? []
        const [latestMeterLog = null, previousMeterLog = null] = logs
        const buildingName =
          (room && buildings.find((b) => Number(b.id) === room.buildingId)?.label) ?? ''
        return { bill, room, buildingName, latestMeterLog, previousMeterLog }
      })

      printReceiptHtml(buildReceiptsHtml(items, `ใบเสร็จ ${month}`))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      window.alert(`พิมพ์ทั้งเดือนไม่สำเร็จ: ${message}`)
    } finally {
      setPrintingAll(false)
    }
  }

  const buildingPlaceholder = buildingsError
    ? 'โหลดข้อมูลอาคารไม่สำเร็จ'
    : buildings.length === 0
    ? 'กำลังโหลดอาคาร…'
    : 'ทุกอาคาร'

  return (
    <main className="sheet sheet--wide">
      <header className="list__header">
        <div>
          <span className="sheet__eyebrow">ระบบจัดการคอนโด</span>
          <h1>รายการบิล</h1>
          <p className="sheet__sub">
            {loading ? 'กำลังโหลด…' : `พบทั้งหมด ${total} รายการ`}
          </p>
        </div>
        <div className="list__header-actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={handlePrintAll}
            disabled={billings.length === 0 || printingAll}
            title={
              billings.length === 0
                ? 'ไม่มีบิลในเดือนนี้'
                : `พิมพ์ใบเสร็จทุกใบในเดือนนี้ (${billings.length} ใบ)`
            }
          >
            {printingAll ? 'กำลังเตรียม…' : `↓ พิมพ์ทั้งเดือน (${billings.length})`}
          </button>
          <button type="button" onClick={() => setDialogOpen(true)}>
            + สร้างบิล
          </button>
        </div>
      </header>

      <section className="filters">
        <div className="filters__field">
          <label>อาคาร</label>
          <Combobox<DropdownItem>
            items={buildings}
            onSelect={setSelectedBuilding}
            placeholder={buildingPlaceholder}
            disabled={buildings.length === 0}
            resetSignal={buildingResetSignal}
          />
        </div>
        <div className="filters__field">
          <label>เดือน</label>
          <MonthPicker value={month} onChange={setMonth} />
        </div>
      </section>

      {error && <div className="banner err">{error}</div>}

      <div className="billing-table">
        <div className="billing-table__head">
          <div>ห้อง</div>
          <div className="num">ค่าไฟฟ้า</div>
          <div className="num">ค่าน้ำ</div>
          <div className="num" title="ค่าส่วนกลาง + ค่าขยะ + ค่ามิเตอร์">ค่าบริการ</div>
          <div className="num">รวม</div>
          <div>สถานะ</div>
          <div className="billing-table__actions-head">การจัดการ</div>
        </div>

        {!loading && billings.length === 0 ? (
          <div className="billing-table__empty">ไม่มีรายการในเดือนนี้</div>
        ) : (
          billings.map((b) => (
            <div className="billing-table__row" key={b.id}>
              <div>{roomLabelById.get(b.roomId) ?? `Room #${b.roomId}`}</div>
              <div className="num">{formatBaht(b.electricity)}</div>
              <div className="num">{formatBaht(b.water)}</div>
              <div
                className="num"
                title={`ส่วนกลาง ${formatBaht(b.maintain)} · ขยะ ${formatBaht(
                  b.trashMaintain,
                )} · มิเตอร์ ${formatBaht(b.meterMaintain)}`}
              >
                {formatBaht(serviceCharge(b))}
              </div>
              <div className="num num--strong">{formatBaht(billingTotal(b))}</div>
              <div className="pay-badges">
                <span className={'pay-badge' + (b.isPayRent === 1 ? ' pay-badge--on' : '')}>
                  ค่าเช่า
                </span>
                <span className={'pay-badge' + (b.isPaid === 1 ? ' pay-badge--on' : '')}>
                  บริการ
                </span>
              </div>
              <div className="billing-table__actions">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setPayingBilling(b)}
                  disabled={b.isPayRent === 1 && b.isPaid === 1}
                  title={
                    b.isPayRent === 1 && b.isPaid === 1 ? 'ชำระครบแล้ว' : 'ชำระเงิน'
                  }
                >
                  ชำระ
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setEditingBilling(b)}
                >
                  แก้ไข
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => handlePrint(b)}
                  disabled={printingBillId === b.id}
                  title="พิมพ์ใบเสร็จ / บันทึกเป็น PDF"
                >
                  {printingBillId === b.id ? '…' : 'พิมพ์'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <BillingForm
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={loadBillings}
      />

      <BillingEditDialog
        open={editingBilling !== null}
        billing={editingBilling}
        roomLabel={
          editingBilling
            ? roomLabelById.get(editingBilling.roomId) ?? `Room #${editingBilling.roomId}`
            : ''
        }
        onClose={() => setEditingBilling(null)}
        onSaved={loadBillings}
      />

      <BillingPayDialog
        open={payingBilling !== null}
        billing={payingBilling}
        roomLabel={
          payingBilling
            ? roomLabelById.get(payingBilling.roomId) ?? `Room #${payingBilling.roomId}`
            : ''
        }
        onClose={() => setPayingBilling(null)}
        onPaid={loadBillings}
      />
    </main>
  )
}
