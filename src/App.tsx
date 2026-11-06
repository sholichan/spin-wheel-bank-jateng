import { useEffect, useState } from 'react'
import AdminPage from './AdminPage'
import SpinWheelPage from './SpinWheelPage'

type RoutePage = 'spinwheel' | 'admin'

function resolveRoute(): RoutePage {
  if (typeof window === 'undefined') return 'spinwheel'
  const pathname = window.location.pathname.toLowerCase().replace(/\/+$/, '')
  const hash = window.location.hash.toLowerCase()
  const params = new URLSearchParams(window.location.search)

  if (
    pathname === '/admin' ||
    pathname.endsWith('/admin') ||
    pathname.endsWith('/admin.html') ||
    hash === '#admin' ||
    hash === '#/admin' ||
    params.get('page') === 'admin' ||
    params.get('screen') === 'admin'
  ) {
    return 'admin'
  }

  return 'spinwheel'
}

export default function App() {
  const [route, setRoute] = useState<RoutePage>(() => resolveRoute())

  useEffect(() => {
    const updateRoute = () => setRoute(resolveRoute())
    window.addEventListener('popstate', updateRoute)
    window.addEventListener('hashchange', updateRoute)
    return () => {
      window.removeEventListener('popstate', updateRoute)
      window.removeEventListener('hashchange', updateRoute)
    }
  }, [])

  if (route === 'admin') {
    return <AdminPage />
  }

  return <SpinWheelPage />
}
