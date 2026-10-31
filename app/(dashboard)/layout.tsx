import type { ReactNode } from 'react'
import DashboardNav from '@/components/layout/dashboard-nav'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <DashboardNav />
      {children}
    </div>
  )
}
