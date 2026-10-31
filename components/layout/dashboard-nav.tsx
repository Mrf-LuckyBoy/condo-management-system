'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function DashboardNav() {
  const pathname = usePathname()
  return (
    <nav className="app-nav" aria-label="เมนูหลัก">
      {[{ href: '/', label: 'บิล' }, { href: '/management', label: 'จัดการคอนโด' }].map(({ href, label }) => (
        <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}
          className={'app-nav__tab' + (pathname === href ? ' app-nav__tab--active' : '')}>
          {label}
        </Link>
      ))}
    </nav>
  )
}
