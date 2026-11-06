import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import './AdminPage.css'
import logoBankJateng from './assets/logo-bank-jateng.png'
import AdminLayout from './layouts/AdminLayout'
import {
  clearSpinHistory,
  deleteSpinHistoryRecord,
  fetchSpinHistory,
  getAdminToken,
  HISTORY_STORAGE_KEY,
  loadSpinHistory,
  loginAdmin,
  logoutAdmin,
  type SpinHistoryItem,
  verifyAdminSession,
} from './spinHistory'

type KategoriFilter = 'ALL' | 'SAVEDUIT' | 'XTRARUN'
type RewardFilter = 'ALL' | 'WIN' | 'ZONK'

function formatDateTime(iso: string): string {
  try {
    const date = new Date(iso)
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date)
  } catch {
    return iso
  }
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() =>
    Boolean(getAdminToken()),
  )
  const [authChecking, setAuthChecking] = useState<boolean>(true)
  const [username, setUsername] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [isSubmittingAuth, setIsSubmittingAuth] = useState<boolean>(false)

  const [history, setHistory] = useState<SpinHistoryItem[]>(() =>
    loadSpinHistory(),
  )
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [kategoriFilter, setKategoriFilter] = useState<KategoriFilter>('ALL')
  const [rewardFilter, setRewardFilter] = useState<RewardFilter>('ALL')
  const [confirmClearModal, setConfirmClearModal] = useState<boolean>(false)

  useEffect(() => {
    document.title = 'Admin - Spin History Bank Jateng'
  }, [])

  // Verify existing session token on mount
  useEffect(() => {
    let mounted = true
    verifyAdminSession().then((valid) => {
      if (!mounted) return
      setIsAuthenticated(valid)
      setAuthChecking(false)
    })
    return () => {
      mounted = false
    }
  }, [])

  const handleManualRefresh = useCallback(async () => {
    setIsLoadingData(true)
    try {
      const items = await fetchSpinHistory()
      setHistory(items)
    } finally {
      setIsLoadingData(false)
    }
  }, [])

  // Fetch from API & poll every 4 seconds when authenticated
  useEffect(() => {
    if (!isAuthenticated) return

    let active = true
    const poll = () => {
      void fetchSpinHistory().then((items) => {
        if (active) setHistory(items)
      })
    }

    poll()
    const intervalId = window.setInterval(poll, 4000)

    const handleStorage = (e: StorageEvent) => {
      if (!e.key || e.key === HISTORY_STORAGE_KEY) {
        setHistory(loadSpinHistory())
      }
    }
    window.addEventListener('storage', handleStorage)

    return () => {
      active = false
      window.clearInterval(intervalId)
      window.removeEventListener('storage', handleStorage)
    }
  }, [isAuthenticated])

  const handleLoginSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setAuthError('Harap isi username dan password.')
      return
    }

    setIsSubmittingAuth(true)
    setAuthError(null)
    const result = await loginAdmin(username.trim(), password)
    setIsSubmittingAuth(false)

    if (result.ok) {
      setIsAuthenticated(true)
      setPassword('')
    } else {
      setAuthError(result.message || 'Login gagal.')
    }
  }

  const handleLogout = () => {
    logoutAdmin()
    setIsAuthenticated(false)
    setUsername('')
    setPassword('')
  }

  const stats = useMemo(() => {
    const totalSpin = history.length
    const totalWin = history.filter((item) => item.isWin).length
    const totalZonk = totalSpin - totalWin
    return {
      totalSpin,
      totalWin,
      totalZonk,
    }
  }, [history])

  const filteredHistory = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return history.filter((item) => {
      const matchQuery =
        !query ||
        String(item.bib).toLowerCase().includes(query) ||
        item.nama.toLowerCase().includes(query) ||
        item.reward.toLowerCase().includes(query)

      const matchKategori =
        kategoriFilter === 'ALL' ||
        item.kategori.trim().toUpperCase() === kategoriFilter

      const matchReward =
        rewardFilter === 'ALL' ||
        (rewardFilter === 'WIN' && item.isWin) ||
        (rewardFilter === 'ZONK' && !item.isWin)

      return matchQuery && matchKategori && matchReward
    })
  }, [history, searchQuery, kategoriFilter, rewardFilter])

  const handleDeleteItem = async (id: string) => {
    const updated = await deleteSpinHistoryRecord(id)
    setHistory(updated)
  }

  const handleConfirmClearAll = async () => {
    const updated = await clearSpinHistory()
    setHistory(updated)
    setConfirmClearModal(false)
  }

  const handleExportCsv = () => {
    const headers = [
      'No',
      'Waktu Spin',
      'Nomor BIB',
      'Nama Peserta',
      'Kategori',
      'Status',
      'Reward',
    ]
    const rows = filteredHistory.map((item, idx) => [
      String(idx + 1),
      formatDateTime(item.timestamp),
      String(item.bib),
      `"${item.nama.replace(/"/g, '""')}"`,
      item.kategori,
      item.isWin ? 'HADIAH' : 'ZONK',
      `"${item.reward.replace(/"/g, '""')}"`,
    ])
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `spin-history-bank-jateng-${new Date().toISOString().slice(0, 10)}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (authChecking) {
    return (
      <AdminLayout centered>
        <p className="admin-loading-text">Memeriksa sesi admin...</p>
      </AdminLayout>
    )
  }

  // LOGIN SCREEN FOR ADMIN
  if (!isAuthenticated) {
    return (
      <AdminLayout centered>
        <div className="admin-login-card">
          <img
            src={logoBankJateng}
            alt="Bank Jateng"
            className="admin-login-logo"
          />
          <h1 className="admin-login-title admin-font-display">ADMIN LOGIN</h1>
          <p className="admin-login-subtitle">
            Masuk untuk mengakses tabel Spin History &amp; Reward Peserta
          </p>

          {authError && (
            <div className="admin-login-alert" role="alert">
              {authError}
            </div>
          )}

          <form className="admin-login-form" onSubmit={handleLoginSubmit}>
            <div className="admin-form-group">
              <label htmlFor="admin-username" className="admin-form-label">
                Username
              </label>
              <input
                id="admin-username"
                type="text"
                className="admin-form-input"
                placeholder="Masukkan username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label htmlFor="admin-password" className="admin-form-label">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                className="admin-form-input"
                placeholder="Masukkan password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="admin-btn admin-btn-primary admin-login-submit"
              disabled={isSubmittingAuth}
            >
              {isSubmittingAuth ? 'Memproses...' : 'Masuk ke Admin'}
            </button>
          </form>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      {/* Top Navbar */}
      <header className="admin-header">
        <div className="admin-header-inner">
          <div className="admin-header-brand">
            <img
              src={logoBankJateng}
              alt="Bank Jateng"
              className="admin-header-logo"
            />
            <div>
              <h1 className="admin-header-title admin-font-display">
                ADMIN SPIN HISTORY
              </h1>
              <p className="admin-header-subtitle">
                Riwayat Data Peserta &amp; Reward Spin Wheel Bank Jateng
              </p>
            </div>
          </div>

          <div className="admin-header-actions">
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={() => void handleManualRefresh()}
              disabled={isLoadingData}
            >
              {isLoadingData ? 'Memuat...' : 'Refresh Data'}
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-export"
              onClick={handleExportCsv}
              disabled={filteredHistory.length === 0}
            >
              Export CSV
            </button>
            {history.length > 0 && (
              <button
                type="button"
                className="admin-btn admin-btn-danger"
                onClick={() => setConfirmClearModal(true)}
              >
                Reset History
              </button>
            )}
            <button
              type="button"
              className="admin-btn admin-btn-logout"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="admin-content">
        {/* Summary Cards */}
        <section className="admin-stats-grid">
          <div className="admin-stat-card">
            <div className="admin-stat-info">
              <span className="admin-stat-label">Total Spin History</span>
              <span className="admin-stat-meta">Total putaran tercatat</span>
            </div>
            <strong className="admin-stat-value admin-font-display">
              {stats.totalSpin}
            </strong>
          </div>

          <div className="admin-stat-card admin-stat-card-win">
            <div className="admin-stat-info">
              <span className="admin-stat-label">Total Dapat Reward</span>
              <span className="admin-stat-meta">Berhasil mendapat hadiah</span>
            </div>
            <strong className="admin-stat-value admin-font-display">
              {stats.totalWin}
            </strong>
          </div>

          <div className="admin-stat-card admin-stat-card-zonk">
            <div className="admin-stat-info">
              <span className="admin-stat-label">Total Zonk</span>
              <span className="admin-stat-meta">Hasil putaran zonk</span>
            </div>
            <strong className="admin-stat-value admin-font-display">
              {stats.totalZonk}
            </strong>
          </div>
        </section>

        {/* Controls Bar: Heading + Filters */}
        <section className="admin-controls-card">
          <div className="admin-section-heading">
            <h2 className="admin-section-title">Tabel Spin History</h2>
            <span className="admin-count-pill">
              {filteredHistory.length} Data
            </span>
          </div>

          <div className="admin-filters">
            <input
              type="search"
              className="admin-search-input"
              placeholder="Cari Nomor BIB, Nama Peserta, atau Reward..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <select
              className="admin-select"
              value={kategoriFilter}
              onChange={(e) =>
                setKategoriFilter(e.target.value as KategoriFilter)
              }
              aria-label="Filter Kategori"
            >
              <option value="ALL">Semua Kategori</option>
              <option value="SAVEDUIT">SAVEDUIT</option>
              <option value="XTRARUN">XTRARUN</option>
            </select>

            <select
              className="admin-select"
              value={rewardFilter}
              onChange={(e) => setRewardFilter(e.target.value as RewardFilter)}
              aria-label="Filter Hasil Reward"
            >
              <option value="ALL">Semua Hasil</option>
              <option value="WIN">Dapat Hadiah</option>
              <option value="ZONK">Zonk</option>
            </select>
          </div>
        </section>

        {/* Spin History Table */}
        <section className="admin-table-card">
          <div className="admin-table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '64px' }}>No</th>
                  <th>Waktu Spin</th>
                  <th>Nomor BIB</th>
                  <th>Nama Peserta</th>
                  <th>Kategori</th>
                  <th>Reward yang Diperoleh</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="admin-empty-cell">
                      {history.length === 0
                        ? 'Belum ada data di tabel spin history.'
                        : 'Tidak ada data spin history yang sesuai dengan filter pencarian.'}
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((item, index) => (
                    <tr key={item.id}>
                      <td data-label="No" className="admin-cell-mono">
                        {index + 1}
                      </td>
                      <td data-label="Waktu Spin" className="admin-cell-time">
                        {formatDateTime(item.timestamp)}
                      </td>
                      <td data-label="Nomor BIB">
                        <span className="admin-bib-badge">{item.bib}</span>
                      </td>
                      <td data-label="Nama Peserta" className="admin-cell-name">
                        {item.nama}
                      </td>
                      <td data-label="Kategori">
                        <span
                          className={`admin-kategori-badge ${
                            item.kategori.trim().toUpperCase() === 'XTRARUN'
                              ? 'kategori-xtrarun'
                              : 'kategori-saveduit'
                          }`}
                        >
                          {item.kategori}
                        </span>
                      </td>
                      <td data-label="Reward">
                        <span
                          className={`admin-reward-badge ${
                            item.isWin ? 'reward-win' : 'reward-zonk'
                          }`}
                        >
                          {item.reward}
                        </span>
                      </td>
                      <td data-label="Aksi" style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="admin-btn-delete-row"
                          onClick={() => void handleDeleteItem(item.id)}
                          title="Hapus baris riwayat ini"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Confirmation Modal for Reset History */}
      {confirmClearModal && (
        <div
          className="admin-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmClearModal(false)}
        >
          <div
            className="admin-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="admin-modal-title admin-font-display">
              HAPUS SEMUA HISTORY?
            </h2>
            <p className="admin-modal-desc">
              Seluruh data di tabel spin history akan dihapus permanen dari
              server.
            </p>
            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => setConfirmClearModal(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-danger"
                onClick={() => void handleConfirmClearAll()}
              >
                Ya, Hapus Semua
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
