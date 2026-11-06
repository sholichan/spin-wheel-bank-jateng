import type { ReactNode } from 'react'

interface SpinWheelLayoutProps {
  theme: 'xtrarun' | 'saveduit'
  children: ReactNode
}

export default function SpinWheelLayout({
  theme,
  children,
}: SpinWheelLayoutProps) {
  return (
    <div
      className={`spinwheel-layout ${
        theme === 'saveduit' ? 'theme-saveduit' : 'theme-xtrarun'
      }`}
    >
      {children}
    </div>
  )
}

