'use client'

import { useEffect, useRef, useState } from 'react'
import {
  createRoom,
  updateRoom,
  type Room,
  type RoomCreateBody,
  type RoomPatch,
} from '@/lib/frontend/condo-management'

type RoomDialogProps = {
  open: boolean
  buildingId: number
  // `null` means create; a Room means edit that one.
  room: Room | null
  mode: 'create' | 'edit'
  onClose: () => void
  onSaved?: (r: Room) => void
}

function toInputValue(v: number | string | null | undefined): string {
  return v == null ? '' : String(v)
}

function toNullableNumber(s: string): number | null {
  const t = s.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export default function RoomDialog({
  open,
  buildingId,
  room,
  mode,
  onClose,
  onSaved,
}: RoomDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [roomNumber, setRoomNumber] = useState('')
  const [rentName, setRentName] = useState('')
  const [rentPrice, setRentPrice] = useState('')
  const [electricityUnit, setElectricityUnit] = useState('')
  const [waterUnit, setWaterUnit] = useState('')
  const [isOwner, setIsOwner] = useState(false)
  const [isActive, setIsActive] = useState(true)

  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Preserve the original UI's prop-driven form reset/loading lifecycle.
    setErrorMessage(null)
    if (mode === 'edit' && room) {
      setRoomNumber(toInputValue(room.roomNumber))
      setRentName(room.rentName ?? '')
      setRentPrice(toInputValue(room.rentPrice))
      setElectricityUnit(toInputValue(room.electricityUnit))
      setWaterUnit(toInputValue(room.waterUnit))
      setIsOwner(room.isOwner === 1)
      setIsActive(room.isActive !== 0) // null defaults to active
    } else {
      setRoomNumber('')
      setRentName('')
      setRentPrice('')
      setElectricityUnit('')
      setWaterUnit('')
      setIsOwner(false)
      setIsActive(true)
    }
  }, [open, mode, room])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMessage(null)
    setSubmitting(true)
    try {
      const shared: RoomPatch = {
        roomNumber: toNullableNumber(roomNumber),
        rentName: rentName.trim() === '' ? null : rentName.trim(),
        rentPrice: toNullableNumber(rentPrice),
        electricityUnit: toNullableNumber(electricityUnit),
        waterUnit: toNullableNumber(waterUnit),
        isOwner: isOwner ? 1 : 0,
        isActive: isActive ? 1 : 0,
      }
      const saved =
        mode === 'edit' && room
          ? await updateRoom(room.id, shared)
          : await createRoom({ ...(shared as RoomCreateBody), buildingId })
      onSaved?.(saved)
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setErrorMessage(`บันทึกไม่สำเร็จ (${message})`)
    } finally {
      setSubmitting(false)
    }
  }

  const title = mode === 'edit' ? 'แก้ไขห้อง' : 'เพิ่มห้องใหม่'

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
          <span className="sheet__eyebrow">จัดการคอนโด</span>
          <h2 className="form-dialog__title">{title}</h2>
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

      <form className="stack" onSubmit={handleSubmit} noValidate>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="room-number">เลขห้อง</label>
            <input
              id="room-number"
              type="number"
              min="0"
              step="1"
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              placeholder="101"
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="rent-name">ประเภท</label>
            <input
              id="rent-name"
              type="text"
              value={rentName}
              onChange={(e) => setRentName(e.target.value)}
              placeholder="Deluxe, Studio"
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="rent-price">ค่าเช่ารายเดือน (฿)</label>
          <input
            id="rent-price"
            type="number"
            min="0"
            step="0.01"
            value={rentPrice}
            onChange={(e) => setRentPrice(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="elec-unit">มิเตอร์ไฟฟ้าปัจจุบัน</label>
            <input
              id="elec-unit"
              type="number"
              min="0"
              step="1"
              value={electricityUnit}
              onChange={(e) => setElectricityUnit(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="field">
            <label htmlFor="water-unit">มิเตอร์น้ำปัจจุบัน</label>
            <input
              id="water-unit"
              type="number"
              min="0"
              step="1"
              value={waterUnit}
              onChange={(e) => setWaterUnit(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <div className="checkbox-row">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={isOwner}
              onChange={(e) => setIsOwner(e.target.checked)}
            />
            <span>เจ้าของอยู่เอง</span>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span>เปิดใช้งาน</span>
          </label>
        </div>

        {errorMessage && <div className="banner err">{errorMessage}</div>}

        <div className="actions">
          <span />
          <div className="actions__buttons">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              ยกเลิก
            </button>
            <button type="submit" disabled={submitting}>
              {submitting ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  )
}
