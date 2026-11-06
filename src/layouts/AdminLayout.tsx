import type { ReactNode } from 'react'

interface AdminLayoutProps {
  centered?: boolean
  children: ReactNode
}

export default function AdminLayout({
  centered = false,
  children,
}: AdminLayoutProps) {
  return (
    <div
      className={`admin-layout ${centered ? 'admin-layout-centered' : ''}`}
    >
      {children}
    </div>
  )
}

