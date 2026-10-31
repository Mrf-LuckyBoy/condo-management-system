'use client'

import { useEffect, useRef } from 'react'

type SuccessDialogProps = {
  open: boolean
  detail: string | null
  onClose: () => void
}

export default function SuccessDialog({ open, detail, onClose }: SuccessDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="dialog"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="dialog__icon">✓</div>
      <h2 className="dialog__title">สร้างบิลสำเร็จ</h2>
      <p className="dialog__detail">{detail}</p>
      <button type="button" className="dialog__close" onClick={onClose}>
        ตกลง
      </button>
    </dialog>
  )
}
