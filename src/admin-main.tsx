import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AdminPage from './AdminPage.tsx'

const container =
  document.getElementById('admin-root') ?? document.getElementById('root')!

createRoot(container).render(
  <StrictMode>
    <AdminPage />
  </StrictMode>,
)

