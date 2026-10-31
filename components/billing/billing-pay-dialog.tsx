'use client'

import { useEffect, useRef, useState } from 'react'
import { payBilling, type Billing, type PayTarget } from '@/lib/frontend/billing'

type BillingPayDialogProps = {
  open: boolean
  billing: Billing | null
  roomLabel: string
  onClose: () => void
  onPaid?: () => void
}

function formatBaht(v: number | null | undefined): string {
  if (v == null) return '฿0.00'
  return `฿${v.toFixed(2)}`
}

function serviceTotal(b: Billing): number {
  return (
    (b.electricity ?? 0) +
    (b.water ?? 0) +
    (b.maintain ?? 0) +
    (b.trashMaintain ?? 0) +
    (b.meterMaintain ?? 0)
  )
}

export default function BillingPayDialog({
  open,
  billing,
  roomLabel,
  onClose,
  onPaid,
}: BillingPayDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [payingTarget, setPayingTarget] = useState<PayTarget | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Preserve the original UI's prop-driven form reset/loading lifecycle.
    if (open) setErrorMessage(null)
  }, [open])

  async function handlePay(target: PayTarget) {
    if (!billing) return
    setErrorMessage(null)
    setPayingTarget(target)
    try {
      await payBilling(billing.id, target)
      onPaid?.()
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setErrorMessage(`ทำรายการไม่สำเร็จ (${message})`)
    } finally {
      setPayingTarget(null)
    }
  }

  const rentPaid = billing?.isPayRent === 1
  const otherPaid = billing?.isPaid === 1
  const bothPaid = rentPaid && otherPaid
  const serviceAmount = billing ? serviceTotal(billing) : 0

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
          <h2 className="form-dialog__title">ชำระเงิน</h2>
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

      <div className="pay-summary">
        <div className="pay-summary__row">
          <span className="pay-summary__label">ห้อง</span>
          <span className="pay-summary__value">{roomLabel}</span>
        </div>
        <div className="pay-summary__row">
          <span className="pay-summary__label">ยอดค่าน้ำไฟ/ส่วนกลาง</span>
          <span className="pay-summary__value pay-summary__value--strong">
            {formatBaht(serviceAmount)}
          </span>
        </div>
      </div>

      <div className="pay-choices">
        <button
          type="button"
          className={
            'pay-choice' +
            (rentPaid ? ' pay-choice--paid' : '') +
            (payingTarget === 'rent' ? ' pay-choice--loading' : '')
          }
          onClick={() => handlePay('rent')}
          disabled={rentPaid || payingTarget !== null}
        >
          <span className="pay-choice__icon">{rentPaid ? '✓' : '฿'}</span>
          <span className="pay-choice__body">
            <span className="pay-choice__title">
              {rentPaid ? 'ค่าเช่าชำระแล้ว' : 'ชำระค่าเช่า'}
            </span>
            <span className="pay-choice__sub">
              {payingTarget === 'rent' ? 'กำลังบันทึก…' : 'ทำเครื่องหมายว่าจ่ายค่าเช่าแล้ว'}
            </span>
          </span>
        </button>

        <button
          type="button"
          className={
            'pay-choice' +
            (otherPaid ? ' pay-choice--paid' : '') +
            (payingTarget === 'other' ? ' pay-choice--loading' : '')
          }
          onClick={() => handlePay('other')}
          disabled={otherPaid || payingTarget !== null}
        >
          <span className="pay-choice__icon">{otherPaid ? '✓' : '฿'}</span>
          <span className="pay-choice__body">
            <span className="pay-choice__title">
              {otherPaid ? 'ค่าน้ำไฟ/ส่วนกลางชำระแล้ว' : 'ชำระค่าน้ำไฟ/ส่วนกลาง'}
            </span>
            <span className="pay-choice__sub">
              {payingTarget === 'other' ? 'กำลังบันทึก…' : 'ทำเครื่องหมายว่าจ่ายบริการแล้ว'}
            </span>
          </span>
        </button>
      </div>

      {errorMessage && <div className="banner err">{errorMessage}</div>}

      <div className="actions">
        <span className="actions__total">
          {bothPaid ? 'ชำระครบแล้ว' : rentPaid || otherPaid ? 'ชำระบางส่วน' : 'ยังไม่ได้ชำระ'}
        </span>
        <div className="actions__buttons">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>
    </dialog>
  )
}
