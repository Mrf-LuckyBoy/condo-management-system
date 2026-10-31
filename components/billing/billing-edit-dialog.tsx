'use client'

import { useEffect, useRef, useState } from 'react'
import { updateBilling, type Billing, type BillingPatch } from '@/lib/frontend/billing'

type BillingEditDialogProps = {
  open: boolean
  billing: Billing | null
  roomLabel: string
  onClose: () => void
  onSaved?: () => void
}

function toInputValue(v: number | null | undefined): string {
  return v == null ? '' : String(v)
}

export default function BillingEditDialog({
  open,
  billing,
  roomLabel,
  onClose,
  onSaved,
}: BillingEditDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [electricity, setElectricity] = useState('')
  const [water, setWater] = useState('')
  const [maintain, setMaintain] = useState('')
  const [trashMaintain, setTrashMaintain] = useState('')
  const [meterMaintain, setMeterMaintain] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (!open || !billing) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Preserve the original UI's prop-driven form reset/loading lifecycle.
    setElectricity(toInputValue(billing.electricity))
    setWater(toInputValue(billing.water))
    setMaintain(toInputValue(billing.maintain))
    setTrashMaintain(toInputValue(billing.trashMaintain))
    setMeterMaintain(toInputValue(billing.meterMaintain))
    setErrorMessage(null)
  }, [open, billing])

  const total = [electricity, water, maintain, trashMaintain, meterMaintain]
    .map((v) => parseFloat(v) || 0)
    .reduce((a, b) => a + b, 0)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!billing) return
    setErrorMessage(null)

    // Send only fields that changed. Empty input clears the value (null).
    const original = {
      electricity: toInputValue(billing.electricity),
      water: toInputValue(billing.water),
      maintain: toInputValue(billing.maintain),
      trashMaintain: toInputValue(billing.trashMaintain),
      meterMaintain: toInputValue(billing.meterMaintain),
    }
    const current = { electricity, water, maintain, trashMaintain, meterMaintain }
    const patch: BillingPatch = {}
    for (const key of Object.keys(current) as (keyof typeof current)[]) {
      if (current[key] !== original[key]) {
        patch[key] = current[key] === '' ? null : Number(current[key])
      }
    }

    if (Object.keys(patch).length === 0) {
      onClose()
      return
    }

    setSubmitting(true)
    try {
      await updateBilling(billing.id, patch)
      onSaved?.()
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setErrorMessage(`บันทึกไม่สำเร็จ (${message})`)
    } finally {
      setSubmitting(false)
    }
  }

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
          <h2 className="form-dialog__title">แก้ไขบิล</h2>
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
          <div className="step__marker done">•</div>
          <div className="step__body">
            <label>ห้อง</label>
            <div className="readonly">{roomLabel}</div>
          </div>
        </div>

        <div className="step">
          <div className="step__marker">1</div>
          <div className="step__body">
            <label>ค่าใช้จ่าย (฿)</label>
            <div className="charges">
              <div className="field">
                <label htmlFor="edit-electricity">ค่าไฟฟ้า</label>
                <input
                  id="edit-electricity"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={electricity}
                  onChange={(e) => setElectricity(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="edit-water">ค่าน้ำ</label>
                <input
                  id="edit-water"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={water}
                  onChange={(e) => setWater(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="edit-maintain">ค่าส่วนกลาง</label>
                <input
                  id="edit-maintain"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={maintain}
                  onChange={(e) => setMaintain(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="edit-trashMaintain">ค่าขยะ</label>
                <input
                  id="edit-trashMaintain"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={trashMaintain}
                  onChange={(e) => setTrashMaintain(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="edit-meterMaintain">ค่ามิเตอร์</label>
                <input
                  id="edit-meterMaintain"
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
              {submitting ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  )
}
