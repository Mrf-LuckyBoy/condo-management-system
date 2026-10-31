import BillingList from '@/components/billing/billing-list'
import { Suspense } from 'react'

export default function BillingPage() {
  return (
    <Suspense fallback={<main className="sheet sheet--wide">กำลังโหลดรายการบิล…</main>}>
      <BillingList />
    </Suspense>
  )
}
