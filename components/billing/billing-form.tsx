'use client'

import { useEffect, useRef, useState } from 'react'
import Combobox from '@/components/ui/combobox'
import { fetchBuildings, fetchRooms, type DropdownItem } from '@/lib/frontend/condo-management'
import { createBilling, type BillingBody } from '@/lib/frontend/billing'

type BillingFormProps = {
  open: boolean
  onClose: () => void
  onCreated?: () => void
}

export default function BillingForm({ open, onClose, onCreated }: BillingFormProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [buildings, setBuildings] = useState<DropdownItem[]>([])
  const [buildingsError, setBuildingsError] = useState<string | null>(null)
  const [selectedBuilding, setSelectedBuilding] = useState<DropdownItem | null>(null)
  const [buildingResetSignal, setBuildingResetSignal] = useState(0)

  const [rooms, setRooms] = useState<DropdownItem[]>([])
  const [roomsLoading, setRoomsLoading] = useState(false)
  const [roomsError, setRoomsError] = useState<string | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<DropdownItem | null>(null)
  const [roomResetSignal, setRoomResetSignal] = useState(0)

  const [electricity, setElectricity] = useState('')
  const [water, setWater] = useState('')
  const [maintain, setMaintain] = useState('')
  const [trashMaintain, setTrashMaintain] = useState('')
  const [meterMaintain, setMeterMaintain] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchBuildings()
      .then(setBuildings)
      .catch((err: Error) => setBuildingsError(err.message))
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Preserve the original UI's prop-driven form reset/loading lifecycle.
    setSelectedRoom(null)
    setRoomResetSignal((s) => s + 1)

    if (!selectedBuilding) {
      setRooms([])
      return
    }

    setRoomsLoading(true)
    setRoomsError(null)
    fetchRooms({ buildingId: Number(selectedBuilding.id), activeOnly: true })
      .then(setRooms)
      .catch((err: Error) => setRoomsError(err.message))
      .finally(() => setRoomsLoading(false))
  }, [selectedBuilding])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Clear form state whenever the dialog is (re)opened.
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Preserve the original UI's prop-driven form reset/loading lifecycle.
    setSelectedBuilding(null)
    setBuildingResetSignal((s) => s + 1)
    setElectricity('')
    setWater('')
    setMaintain('')
    setTrashMaintain('')
    setMeterMaintain('')
    setErrorMessage(null)
  }, [open])

  const total = [electricity, water, maintain, trashMaintain, meterMaintain]
    .map((v) => parseFloat(v) || 0)
    .reduce((a, b) => a + b, 0)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMessage(null)

    if (!selectedRoom) {
      setErrorMessage('กรุณาเลือกอาคารและห้องก่อน')
      return
    }

    const body: BillingBody = { roomId: Number(selectedRoom.id) }
    if (electricity !== '') body.electricity = Number(electricity)
    if (water !== '') body.water = Number(water)
    if (maintain !== '') body.maintain = Number(maintain)
    if (trashMaintain !== '') body.trashMaintain = Number(trashMaintain)
    if (meterMaintain !== '') body.meterMaintain = Number(meterMaintain)

    setSubmitting(true)
    try {
      await createBilling(body)
      onCreated?.()
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setErrorMessage(`สร้างบิลไม่สำเร็จ (${message})`)
    } finally {
      setSubmitting(false)
    }
  }

  const buildingPlaceholder = buildingsError
    ? 'โหลดข้อมูลอาคารไม่สำเร็จ'
    : buildings.length === 0
    ? 'กำลังโหลดอาคาร…'
    : 'ค้นหาอาคาร…'

  const roomPlaceholder = !selectedBuilding
    ? 'กรุณาเลือกอาคารก่อน'
    : roomsLoading
    ? 'กำลังโหลดห้อง…'
    : roomsError
    ? 'โหลดข้อมูลห้องไม่สำเร็จ'
    : rooms.length === 0
    ? 'ไม่มีห้องในอาคารนี้'
    : 'ค้นหาห้อง…'

  return (
    <dialog
      ref={dialogRef}
      className="dialog dialog--form"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose()
      }}
    >
      <header className="form-dialog__header">
        <div>
          <span className="sheet__eyebrow">ระบบจัดการคอนโด</span>
          <h2 className="form-dialog__title">สร้างบิลใหม่</h2>
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

      <form className="steps" onSubmit={handleSubmit} noValidate>
        <div className="step">
          <div className={'step__marker' + (selectedBuilding ? ' done' : '')}>1</div>
          <div className="step__body">
            <label>อาคาร</label>
            <Combobox<DropdownItem>
              items={buildings}
              onSelect={setSelectedBuilding}
              placeholder={buildingPlaceholder}
              disabled={buildings.length === 0}
              resetSignal={buildingResetSignal}
            />
          </div>
        </div>

        <div className="step">
          <div className={'step__marker' + (selectedRoom ? ' done' : '')}>2</div>
          <div className="step__body">
            <label>ห้อง</label>
            <Combobox<DropdownItem>
              items={rooms}
              onSelect={setSelectedRoom}
              placeholder={roomPlaceholder}
              disabled={!selectedBuilding || rooms.length === 0}
              resetSignal={roomResetSignal}
            />
          </div>
        </div>

        <div className="step">
          <div className="step__marker">3</div>
          <div className="step__body">
            <label>ค่าใช้จ่าย (฿)</label>
            <div className="charges">
              <div className="field">
                <label htmlFor="electricity">ค่าไฟฟ้า</label>
                <input
                  id="electricity"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={electricity}
                  onChange={(e) => setElectricity(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="water">ค่าน้ำ</label>
                <input
                  id="water"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={water}
                  onChange={(e) => setWater(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="maintain">ค่าส่วนกลาง</label>
                <input
                  id="maintain"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={maintain}
                  onChange={(e) => setMaintain(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="trashMaintain">ค่าขยะ</label>
                <input
                  id="trashMaintain"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={trashMaintain}
                  onChange={(e) => setTrashMaintain(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="meterMaintain">ค่ามิเตอร์</label>
                <input
                  id="meterMaintain"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={meterMaintain}
                  onChange={(e) => setMeterMaintain(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {errorMessage && <div className="banner err">{errorMessage}</div>}

        <div className="actions">
          <span className="actions__total">รวม: ฿{total.toFixed(2)}</span>
          <div className="actions__buttons">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              ยกเลิก
            </button>
            <button type="submit" disabled={submitting}>
              {submitting ? 'กำลังสร้าง…' : 'สร้างบิล'}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  )
}
