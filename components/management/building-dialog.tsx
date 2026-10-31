'use client'

import { useEffect, useRef, useState } from 'react'
import { createBuilding, updateBuilding, type Building } from '@/lib/frontend/condo-management'

type BuildingDialogProps = {
  open: boolean
  // `null` means create; a Building means edit that one.
  building: Building | null
  mode: 'create' | 'edit'
  onClose: () => void
  onSaved?: (b: Building) => void
}

export default function BuildingDialog({
  open,
  building,
  mode,
  onClose,
  onSaved,
}: BuildingDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [buildingName, setBuildingName] = useState('')
  const [ownerName, setOwnerName] = useState('')
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
    if (mode === 'edit' && building) {
      setBuildingName(building.buildingName ?? '')
      setOwnerName(building.ownerName ?? '')
    } else {
      setBuildingName('')
      setOwnerName('')
    }
  }, [open, mode, building])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMessage(null)
    setSubmitting(true)
    try {
      const body = {
        buildingName: buildingName.trim() === '' ? null : buildingName.trim(),
        ownerName: ownerName.trim() === '' ? null : ownerName.trim(),
      }
      const saved =
        mode === 'edit' && building
          ? await updateBuilding(building.id, body)
          : await createBuilding(body)
      onSaved?.(saved)
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setErrorMessage(`บันทึกไม่สำเร็จ (${message})`)
    } finally {
      setSubmitting(false)
    }
  }

  const title = mode === 'edit' ? 'แก้ไขอาคาร' : 'เพิ่มอาคารใหม่'

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
        <div className="field">
          <label htmlFor="building-name">ชื่ออาคาร</label>
          <input
            id="building-name"
            type="text"
            value={buildingName}
            onChange={(e) => setBuildingName(e.target.value)}
            placeholder="เช่น Tower A"
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="owner-name">ผู้ดูแล / เจ้าของ</label>
          <input
            id="owner-name"
            type="text"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="ชื่อผู้ดูแล (ไม่บังคับ)"
          />
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
