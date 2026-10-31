'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import BuildingDialog from '@/components/management/building-dialog'
import RoomDialog from '@/components/management/room-dialog'
import {
  bulkUpdateMeters,
  deleteBuilding,
  deleteRoom,
  exportBuildingMeterRooms,
  fetchBuildingDetail,
  fetchBuildingSetting,
  generateBillsForBuilding,
  listBuildings,
  upsertBuildingSetting,
  type BulkMeterItem,
  type Building,
  type BuildingDetail,
  type BuildingSettingPatch,
  type GenerateBillsResponse,
  type MeterExportItem,
  type Room,
  type SettingBuilding,
} from '@/lib/frontend/condo-management'

function toInputValue(v: number | null | undefined): string {
  return v == null ? '' : String(v)
}

function toNullableNumber(s: string): number | null {
  const t = s.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

// ---------------------------------------------------------------------------
// CSV template for bulk meter update — active rooms only, UTF-8 BOM so Excel
// opens Thai text correctly. The two "…New" columns are left blank for the
// user to fill in; the other columns are for context.
// ---------------------------------------------------------------------------

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function buildMeterTemplateCsv(items: MeterExportItem[]): string {
  const header = [
    'roomId',
    'roomNumber',
    'rentName',
    'electricityUnitOld',
    'waterUnitOld',
    'electricityUnitNew',
    'waterUnitNew',
  ]
  const rows = items.map((r) => [
    r.roomId,
    r.roomNumber ?? '',
    r.rentName ?? '',
    r.electricityUnit ?? '',
    r.waterUnit ?? '',
    '',
    '',
  ])
  const lines = [header, ...rows].map((cols) => cols.map(csvCell).join(','))
  return '﻿' + lines.join('\r\n')
}

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function safeFilenamePart(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-')
}

// Small RFC-4180-ish CSV parser: supports quoted fields, "" escapes, CRLF/LF.
function parseCsv(input: string): string[][] {
  let text = input
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\r') {
      // Handled together with \n
    } else if (c === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += c
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

export type ParsedMeterItem = {
  roomId: number
  electricityUnit?: number
  waterUnit?: number
  // For preview/context
  roomLabel: string
  oldElectricity: number | null
  oldWater: number | null
  errors: string[]
}

export type ParsedMeterResult = {
  items: ParsedMeterItem[]
  fileErrors: string[]
}

function parseMeterCsv(text: string, rooms: Room[]): ParsedMeterResult {
  const rows = parseCsv(text)
    .map((r) => r.map((c) => c))
    // Drop fully-empty rows.
    .filter((r) => !(r.length === 0 || (r.length === 1 && r[0].trim() === '')))
  if (rows.length === 0) return { items: [], fileErrors: ['ไฟล์ CSV ว่างเปล่า'] }

  const [headerRow, ...dataRows] = rows
  const header = headerRow.map((h) => h.trim())
  const idxRoomId = header.indexOf('roomId')
  const idxElec = header.indexOf('electricityUnitNew')
  const idxWater = header.indexOf('waterUnitNew')

  const fileErrors: string[] = []
  if (idxRoomId === -1) fileErrors.push('ไม่พบคอลัมน์ roomId ในไฟล์')
  if (idxElec === -1 && idxWater === -1) {
    fileErrors.push('ต้องมีอย่างน้อยคอลัมน์ electricityUnitNew หรือ waterUnitNew')
  }
  if (fileErrors.length > 0) return { items: [], fileErrors }

  const roomsById = new Map<number, Room>()
  for (const r of rooms) roomsById.set(r.id, r)

  const items: ParsedMeterItem[] = []
  dataRows.forEach((row, i) => {
    if (row.every((cell) => cell.trim() === '')) return
    const lineNo = i + 2 // header is line 1

    const errors: string[] = []
    const roomIdStr = (row[idxRoomId] ?? '').trim()
    const roomId = Number(roomIdStr)
    if (!Number.isInteger(roomId) || roomId <= 0) {
      errors.push(`บรรทัด ${lineNo}: roomId "${roomIdStr}" ไม่ถูกต้อง`)
    }

    const elecStr = idxElec !== -1 ? (row[idxElec] ?? '').trim() : ''
    const waterStr = idxWater !== -1 ? (row[idxWater] ?? '').trim() : ''
    let electricityUnit: number | undefined
    let waterUnit: number | undefined

    if (elecStr !== '') {
      const n = Number(elecStr)
      if (!Number.isInteger(n) || n < 0) {
        errors.push(`บรรทัด ${lineNo}: ค่ามิเตอร์ไฟ "${elecStr}" ต้องเป็นจำนวนเต็ม ≥ 0`)
      } else {
        electricityUnit = n
      }
    }
    if (waterStr !== '') {
      const n = Number(waterStr)
      if (!Number.isInteger(n) || n < 0) {
        errors.push(`บรรทัด ${lineNo}: ค่ามิเตอร์น้ำ "${waterStr}" ต้องเป็นจำนวนเต็ม ≥ 0`)
      } else {
        waterUnit = n
      }
    }

    // Skip rows with no new values AND no errors (nothing to apply, nothing to report).
    if (electricityUnit === undefined && waterUnit === undefined && errors.length === 0) return

    const room = roomsById.get(roomId)
    if (!room && errors.length === 0) {
      errors.push(`บรรทัด ${lineNo}: ไม่พบห้อง roomId ${roomId} ในอาคารนี้`)
    } else if (room && room.isActive === 0 && errors.length === 0) {
      errors.push(`บรรทัด ${lineNo}: ห้อง ${room.roomNumber ?? roomId} ถูกปิดใช้งาน`)
    }

    const roomLabel = room
      ? room.roomNumber != null
        ? `ห้อง ${room.roomNumber}`
        : `Room #${roomId}`
      : `Room #${roomId}`

    items.push({
      roomId,
      electricityUnit,
      waterUnit,
      roomLabel,
      oldElectricity: room?.electricityUnit ?? null,
      oldWater: room?.waterUnit ?? null,
      errors,
    })
  })

  return { items, fileErrors }
}

// ---------------------------------------------------------------------------
// Meter bulk-update section (download + upload)
// ---------------------------------------------------------------------------

type MeterBulkSectionProps = {
  buildingId: number
  buildingName: string | null
  rooms: Room[]
  onApplied: () => void
}

function MeterBulkSection({
  buildingId,
  buildingName,
  rooms,
  onApplied,
}: MeterBulkSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ParsedMeterResult | null>(null)
  const [downloading, setDownloading] = useState(false)

  const activeRoomCount = rooms.filter((r) => r.isActive !== 0).length

  async function handleDownload() {
    setDownloading(true)
    try {
      const { items } = await exportBuildingMeterRooms(buildingId)
      if (items.length === 0) {
        window.alert('ไม่มีห้องที่เปิดใช้งานในอาคารนี้')
        return
      }
      const csv = buildMeterTemplateCsv(items)
      const namePart = safeFilenamePart(buildingName ?? `building-${buildingId}`)
      const now = new Date()
      const yyyyMm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      downloadTextFile(`meter-template-${namePart}-${yyyyMm}.csv`, csv, 'text/csv')
    } catch (err) {
      window.alert(
        `ดาวน์โหลดไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setDownloading(false)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Reset so re-uploading the same file still triggers change.
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const parsed = parseMeterCsv(text, rooms)
      setPreview(parsed)
    } catch (err) {
      window.alert(`อ่านไฟล์ไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <>
      <div className="section-head">
        <h3>อัปเดตค่ามิเตอร์ (bulk)</h3>
      </div>
      <div className="stack">
        <p className="mgmt-generate__sub">
          ดาวน์โหลด template, กรอกค่ามิเตอร์ใหม่ในคอลัมน์ <code>electricityUnitNew</code> /{' '}
          <code>waterUnitNew</code> แล้วอัปโหลดไฟล์กลับ ระบบจะแสดงตัวอย่างก่อนอัปเดตจริง
        </p>
        <div className="section-head__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleDownload}
            disabled={downloading || activeRoomCount === 0}
            title={
              activeRoomCount === 0
                ? 'ไม่มีห้องที่เปิดใช้งาน'
                : `ดาวน์โหลด CSV สำหรับ ${activeRoomCount} ห้อง`
            }
          >
            {downloading ? 'กำลังโหลด…' : '↓ ดาวน์โหลด template'}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={rooms.length === 0}
          >
            ↑ อัปโหลด CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            hidden
          />
        </div>
      </div>

      {preview && (
        <MeterBulkPreviewDialog
          preview={preview}
          onClose={() => setPreview(null)}
          onApplied={() => {
            setPreview(null)
            onApplied()
          }}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Preview + confirm dialog for the parsed CSV
// ---------------------------------------------------------------------------

function MeterBulkPreviewDialog({
  preview,
  onClose,
  onApplied,
}: {
  preview: ParsedMeterResult
  onClose: () => void
  onApplied: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    if (!d.open) d.showModal()
  }, [])

  const validItems = preview.items.filter((it) => it.errors.length === 0)
  const errorItems = preview.items.filter((it) => it.errors.length > 0)
  const canApply = preview.fileErrors.length === 0 && validItems.length > 0 && !applying

  async function handleApply() {
    setApplying(true)
    setError(null)
    try {
      const payload: BulkMeterItem[] = validItems.map((it) => {
        const item: BulkMeterItem = { roomId: it.roomId }
        if (it.electricityUnit !== undefined) item.electricityUnit = it.electricityUnit
        if (it.waterUnit !== undefined) item.waterUnit = it.waterUnit
        return item
      })
      await bulkUpdateMeters(payload)
      onApplied()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setApplying(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog dialog--form dialog--wide"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose()
      }}
    >
      <header className="form-dialog__header">
        <div>
          <span className="sheet__eyebrow">จัดการคอนโด</span>
          <h2 className="form-dialog__title">ตรวจสอบก่อนอัปเดตมิเตอร์</h2>
        </div>
        <button
          type="button"
          className="form-dialog__close"
          onClick={onClose}
          aria-label="ปิด"
        >
          ×
        </button>
      </header>

      <div className="stack">
        {preview.fileErrors.map((msg, i) => (
          <div className="banner err" key={`f-${i}`}>
            {msg}
          </div>
        ))}

        {validItems.length > 0 && (
          <div>
            <div className="section-head">
              <h3>จะอัปเดต ({validItems.length})</h3>
            </div>
            <div className="meter-diff">
              <div className="meter-diff__head">
                <div>ห้อง</div>
                <div className="num">ไฟ (เดิม → ใหม่)</div>
                <div className="num">น้ำ (เดิม → ใหม่)</div>
              </div>
              {validItems.map((it) => (
                <div className="meter-diff__row" key={it.roomId}>
                  <div>{it.roomLabel}</div>
                  <div className="num">
                    {it.electricityUnit === undefined
                      ? '—'
                      : `${it.oldElectricity ?? '—'} → ${it.electricityUnit}`}
                  </div>
                  <div className="num">
                    {it.waterUnit === undefined
                      ? '—'
                      : `${it.oldWater ?? '—'} → ${it.waterUnit}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {errorItems.length > 0 && (
          <div>
            <div className="section-head">
              <h3>ข้าม ({errorItems.length})</h3>
            </div>
            <ul className="skipped-list">
              {errorItems.map((it, i) => (
                <li key={`e-${i}`}>
                  <strong>{it.roomLabel}</strong> — {it.errors.join('; ')}
                </li>
              ))}
            </ul>
          </div>
        )}

        {preview.items.length === 0 && preview.fileErrors.length === 0 && (
          <div className="banner err">ไม่พบข้อมูลที่จะอัปเดตในไฟล์</div>
        )}

        {error && <div className="banner err">{error}</div>}
      </div>

      <div className="actions">
        <span className="actions__total">
          {validItems.length === 0
            ? 'ไม่มีข้อมูลที่จะอัปเดต'
            : `พร้อมอัปเดต ${validItems.length} ห้อง`}
        </span>
        <div className="actions__buttons">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            ยกเลิก
          </button>
          <button type="button" onClick={handleApply} disabled={!canApply}>
            {applying ? 'กำลังอัปเดต…' : `อัปเดต ${validItems.length} ห้อง`}
          </button>
        </div>
      </div>
    </dialog>
  )
}

// ---------------------------------------------------------------------------
// Setting form
// ---------------------------------------------------------------------------

type SettingFormProps = {
  buildingId: number
  setting: SettingBuilding | null
  onSaved: (s: SettingBuilding) => void
}

function SettingForm({ buildingId, setting, onSaved }: SettingFormProps) {
  const [electricityPerUnit, setElectricityPerUnit] = useState('')
  const [waterPerUnit, setWaterPerUnit] = useState('')
  const [baseMaintain, setBaseMaintain] = useState('')
  const [trashMaintain, setTrashMaintain] = useState('')
  const [meterMaintain, setMeterMaintain] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedTick, setSavedTick] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Preserve the original UI's prop-driven form reset/loading lifecycle.
    setElectricityPerUnit(toInputValue(setting?.electricityPerUnit))
    setWaterPerUnit(toInputValue(setting?.waterPerUnit))
    setBaseMaintain(toInputValue(setting?.baseMaintain))
    setTrashMaintain(toInputValue(setting?.trashMaintain))
    setMeterMaintain(toInputValue(setting?.meterMaintain))
    setError(null)
    setSavedTick(false)
  }, [setting, buildingId])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSavedTick(false)
    try {
      const body: BuildingSettingPatch = {
        electricityPerUnit: toNullableNumber(electricityPerUnit),
        waterPerUnit: toNullableNumber(waterPerUnit),
        baseMaintain: toNullableNumber(baseMaintain),
        trashMaintain: toNullableNumber(trashMaintain),
        meterMaintain: toNullableNumber(meterMaintain),
      }
      const next = await upsertBuildingSetting(buildingId, body)
      onSaved(next)
      setSavedTick(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack">
      <div className="grid-2">
        <div className="field">
          <label htmlFor="s-elec">ค่าไฟฟ้า / หน่วย (฿)</label>
          <input
            id="s-elec"
            type="number"
            min="0"
            step="0.01"
            value={electricityPerUnit}
            onChange={(e) => setElectricityPerUnit(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="field">
          <label htmlFor="s-water">ค่าน้ำ / หน่วย (฿)</label>
          <input
            id="s-water"
            type="number"
            min="0"
            step="0.01"
            value={waterPerUnit}
            onChange={(e) => setWaterPerUnit(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>
      <div className="grid-3">
        <div className="field">
          <label htmlFor="s-base">ค่าส่วนกลาง (฿)</label>
          <input
            id="s-base"
            type="number"
            min="0"
            step="0.01"
            value={baseMaintain}
            onChange={(e) => setBaseMaintain(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="field">
          <label htmlFor="s-trash">ค่าขยะ (฿)</label>
          <input
            id="s-trash"
            type="number"
            min="0"
            step="0.01"
            value={trashMaintain}
            onChange={(e) => setTrashMaintain(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="field">
          <label htmlFor="s-meter">ค่ามิเตอร์ (฿)</label>
          <input
            id="s-meter"
            type="number"
            min="0"
            step="0.01"
            value={meterMaintain}
            onChange={(e) => setMeterMaintain(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>

      {error && <div className="banner err">{error}</div>}
      {savedTick && !error && <div className="banner ok">บันทึกอัตราแล้ว</div>}

      <div className="actions">
        <span className="actions__total">อัตราจะถูกใช้ตอนสร้างบิลรายเดือน</span>
        <button type="submit" disabled={saving}>
          {saving ? 'กำลังบันทึก…' : 'บันทึกอัตรา'}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Rooms section
// ---------------------------------------------------------------------------

type RoomsSectionProps = {
  buildingId: number
  rooms: Room[]
  onChanged: () => void
}

function RoomsSection({ buildingId, rooms, onChanged }: RoomsSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)

  function openCreate() {
    setEditingRoom(null)
    setDialogOpen(true)
  }
  function openEdit(r: Room) {
    setEditingRoom(r)
    setDialogOpen(true)
  }

  async function handleDelete(r: Room) {
    const label = r.roomNumber != null ? `ห้อง ${r.roomNumber}` : `ห้อง #${r.id}`
    if (!window.confirm(`ลบ ${label}? การลบจะไม่สำเร็จหากห้องนี้มีบิลอยู่แล้ว`)) return
    try {
      await deleteRoom(r.id)
      onChanged()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      window.alert(`ลบห้องไม่สำเร็จ: ${message}`)
    }
  }

  return (
    <>
      <div className="section-head">
        <h3>ห้อง ({rooms.length})</h3>
        <button type="button" className="btn--sm" onClick={openCreate}>
          + เพิ่มห้อง
        </button>
      </div>

      <div className="rooms-table">
        <div className="rooms-table__head">
          <div>เลขห้อง</div>
          <div>ประเภท</div>
          <div className="num">ค่าเช่า</div>
          <div className="num">มิเตอร์ไฟ</div>
          <div className="num">มิเตอร์น้ำ</div>
          <div>สถานะ</div>
          <div className="rooms-table__actions-head">การจัดการ</div>
        </div>

        {rooms.length === 0 ? (
          <div className="rooms-table__empty">ยังไม่มีห้องในอาคารนี้</div>
        ) : (
          rooms.map((r) => (
            <div className="rooms-table__row" key={r.id}>
              <div>{r.roomNumber ?? '—'}</div>
              <div>{r.rentName ?? '—'}</div>
              <div className="num">
                {r.rentPrice != null ? `฿${r.rentPrice.toFixed(2)}` : '—'}
              </div>
              <div className="num">{r.electricityUnit ?? '—'}</div>
              <div className="num">{r.waterUnit ?? '—'}</div>
              <div className="pay-badges">
                <span
                  className={
                    'pay-badge' + (r.isActive === 0 ? '' : ' pay-badge--on')
                  }
                >
                  {r.isActive === 0 ? 'ปิดใช้' : 'เปิดใช้'}
                </span>
                {r.isOwner === 1 && (
                  <span className="pay-badge pay-badge--on">เจ้าของ</span>
                )}
              </div>
              <div className="rooms-table__actions">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => openEdit(r)}
                >
                  แก้ไข
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm btn--danger"
                  onClick={() => handleDelete(r)}
                >
                  ลบ
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <RoomDialog
        open={dialogOpen}
        buildingId={buildingId}
        room={editingRoom}
        mode={editingRoom ? 'edit' : 'create'}
        onClose={() => setDialogOpen(false)}
        onSaved={onChanged}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CondoManagement() {
  const [buildings, setBuildings] = useState<Building[]>([])
  const [buildingsError, setBuildingsError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const [detail, setDetail] = useState<BuildingDetail | null>(null)
  const [setting, setSetting] = useState<SettingBuilding | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [buildingDialog, setBuildingDialog] = useState<
    { mode: 'create' } | { mode: 'edit'; building: Building } | null
  >(null)

  const [generateResult, setGenerateResult] = useState<GenerateBillsResponse | null>(null)
  const [generating, setGenerating] = useState(false)

  const refreshBuildings = useCallback(async () => {
    try {
      const list = await listBuildings()
      setBuildings(list)
      setBuildingsError(null)
      if (selectedId == null && list.length > 0) setSelectedId(list[0].id)
      // If the selected building was removed, drop the selection.
      if (selectedId != null && !list.some((b) => b.id === selectedId)) {
        setSelectedId(list[0]?.id ?? null)
      }
    } catch (err) {
      setBuildingsError(err instanceof Error ? err.message : String(err))
    }
  }, [selectedId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Preserve the original UI's prop-driven form reset/loading lifecycle.
    refreshBuildings()
    // Intentionally exclude refreshBuildings from deps — we only want the
    // one-shot on-mount fetch here. Later refreshes are called explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadDetail = useCallback(async (id: number) => {
    setDetailLoading(true)
    setDetailError(null)
    try {
      const [d, s] = await Promise.all([
        fetchBuildingDetail(id),
        fetchBuildingSetting(id).catch((err: Error) => {
          // 404 → no setting yet; treat as empty.
          if (/404|not found/i.test(err.message)) return null
          throw err
        }),
      ])
      setDetail(d)
      setSetting(s)
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : String(err))
      setDetail(null)
      setSetting(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Preserve the original UI's prop-driven form reset/loading lifecycle.
      setDetail(null)
      setSetting(null)
      return
    }
    loadDetail(selectedId)
  }, [selectedId, loadDetail])

  async function handleDeleteBuilding(b: Building) {
    if (!window.confirm(`ลบอาคาร "${b.buildingName ?? b.id}"? ห้ามลบถ้ายังมีห้อง`)) return
    try {
      await deleteBuilding(b.id)
      await refreshBuildings()
    } catch (err) {
      window.alert(`ลบไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function handleGenerateBills() {
    if (selectedId == null) return
    if (
      !window.confirm(
        'สร้างบิลของเดือนนี้สำหรับทุกห้องที่เปิดใช้งานในอาคารนี้?\n(ถ้ามีบิลของเดือนนี้แล้วจะไม่ซ้ำ)',
      )
    ) {
      return
    }
    setGenerating(true)
    try {
      const res = await generateBillsForBuilding(selectedId)
      setGenerateResult(res)
    } catch (err) {
      window.alert(
        `สร้างบิลไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setGenerating(false)
    }
  }

  return (
    <main className="sheet sheet--wide">
      <header className="list__header">
        <div>
          <span className="sheet__eyebrow">ระบบจัดการคอนโด</span>
          <h1>จัดการคอนโด</h1>
          <p className="sheet__sub">
            {buildings.length === 0
              ? 'ยังไม่มีอาคาร กดปุ่ม "เพิ่มอาคาร" เพื่อสร้าง'
              : `ทั้งหมด ${buildings.length} อาคาร`}
          </p>
        </div>
        <button type="button" onClick={() => setBuildingDialog({ mode: 'create' })}>
          + เพิ่มอาคาร
        </button>
      </header>

      {buildingsError && <div className="banner err">{buildingsError}</div>}

      <div className="mgmt-layout">
        <aside className="mgmt-sidebar">
          <h3 className="mgmt-sidebar__title">อาคาร</h3>
          <ul className="mgmt-sidebar__list">
            {buildings.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  className={
                    'mgmt-sidebar__item' +
                    (b.id === selectedId ? ' mgmt-sidebar__item--active' : '')
                  }
                  onClick={() => setSelectedId(b.id)}
                >
                  <span className="mgmt-sidebar__item-name">
                    {b.buildingName ?? `Building #${b.id}`}
                  </span>
                  {b.ownerName && (
                    <span className="mgmt-sidebar__item-sub">{b.ownerName}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="mgmt-detail">
          {selectedId == null ? (
            <div className="mgmt-detail__empty">เลือกอาคารจากรายการซ้าย</div>
          ) : detailLoading ? (
            <div className="mgmt-detail__empty">กำลังโหลด…</div>
          ) : detailError ? (
            <div className="banner err">{detailError}</div>
          ) : detail ? (
            <>
              <div className="mgmt-detail__head">
                <div>
                  <h2 className="mgmt-detail__title">
                    {detail.buildingName ?? `Building #${detail.id}`}
                  </h2>
                  {detail.ownerName && (
                    <p className="mgmt-detail__sub">ผู้ดูแล: {detail.ownerName}</p>
                  )}
                </div>
                <div className="mgmt-detail__head-actions">
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => setBuildingDialog({ mode: 'edit', building: detail })}
                  >
                    แก้ไขอาคาร
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm btn--danger"
                    onClick={() => handleDeleteBuilding(detail)}
                    disabled={detail.rooms.length > 0}
                    title={
                      detail.rooms.length > 0 ? 'ลบไม่ได้ถ้ายังมีห้อง' : 'ลบอาคาร'
                    }
                  >
                    ลบอาคาร
                  </button>
                </div>
              </div>

              <section className="mgmt-section">
                <div className="section-head">
                  <h3>อัตราค่าบริการ</h3>
                </div>
                <SettingForm
                  buildingId={detail.id}
                  setting={setting}
                  onSaved={setSetting}
                />
              </section>

              <section className="mgmt-section">
                <RoomsSection
                  buildingId={detail.id}
                  rooms={detail.rooms}
                  onChanged={() => loadDetail(detail.id)}
                />
              </section>

              <section className="mgmt-section">
                <MeterBulkSection
                  buildingId={detail.id}
                  buildingName={detail.buildingName}
                  rooms={detail.rooms}
                  onApplied={() => loadDetail(detail.id)}
                />
              </section>

              <section className="mgmt-section">
                <div className="section-head">
                  <h3>สร้างบิลรายเดือน</h3>
                </div>
                <div className="mgmt-generate">
                  <p className="mgmt-generate__sub">
                    สร้างบิลของเดือนนี้ให้กับทุกห้องที่เปิดใช้งานในอาคารนี้
                    อ่านค่ามิเตอร์ล่าสุดและคำนวณด้วยอัตราด้านบน
                    ถ้ามีบิลของเดือนนี้แล้วจะไม่สร้างซ้ำ
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerateBills}
                    disabled={generating || detail.rooms.length === 0 || !setting}
                    title={
                      !setting
                        ? 'ต้องบันทึกอัตราก่อน'
                        : detail.rooms.length === 0
                        ? 'ยังไม่มีห้อง'
                        : 'สร้างบิลรายเดือน'
                    }
                  >
                    {generating ? 'กำลังสร้าง…' : 'สร้างบิลรายเดือน'}
                  </button>
                </div>
              </section>
            </>
          ) : (
            <div className="mgmt-detail__empty">ไม่พบข้อมูล</div>
          )}
        </section>
      </div>

      <BuildingDialog
        open={buildingDialog !== null}
        mode={buildingDialog?.mode ?? 'create'}
        building={buildingDialog?.mode === 'edit' ? buildingDialog.building : null}
        onClose={() => setBuildingDialog(null)}
        onSaved={async (saved) => {
          await refreshBuildings()
          setSelectedId(saved.id)
        }}
      />

      {generateResult && (
        <GenerateResultDialog
          result={generateResult}
          onClose={() => {
            setGenerateResult(null)
            if (selectedId != null) loadDetail(selectedId)
          }}
        />
      )}
    </main>
  )
}

// ---------------------------------------------------------------------------
// Generate-bills result dialog
// ---------------------------------------------------------------------------

function GenerateResultDialog({
  result,
  onClose,
}: {
  result: GenerateBillsResponse
  onClose: () => void
}) {
  return (
    <dialog open className="dialog dialog--form">
      <header className="form-dialog__header">
        <div>
          <span className="sheet__eyebrow">จัดการคอนโด</span>
          <h2 className="form-dialog__title">สร้างบิลเสร็จสิ้น</h2>
        </div>
        <button
          type="button"
          className="form-dialog__close"
          onClick={onClose}
          aria-label="ปิด"
        >
          ×
        </button>
      </header>

      <div className="stack">
        <div className="banner ok">สร้างบิลใหม่ {result.created} รายการ</div>

        {result.skipped.length > 0 && (
          <div>
            <div className="section-head">
              <h3>ข้ามไป ({result.skipped.length})</h3>
            </div>
            <ul className="skipped-list">
              {result.skipped.map((s, i) => (
                <li key={i}>
                  <strong>Room #{s.roomId}</strong> — {s.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="actions">
        <span />
        <div className="actions__buttons">
          <button type="button" onClick={onClose}>
            ตกลง
          </button>
        </div>
      </div>
    </dialog>
  )
}
