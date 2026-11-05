import { type FormEvent, useEffect, useRef, useState } from 'react'
import './App.css'
import pesertaData from './data/peserta.json'

import xtrarunBg from './assets/xtrarun-bg.png'
import saveduitBg from './assets/saveduit-bg.png'
import titleXtrarun from './assets/title-xtrarun.png'
import logoBankJateng from './assets/logo-bank-jateng.png'
import spinWheelXtrarun from './assets/spin-wheel-xtrarun.png'
import spinWheelSaveduit from './assets/spin-wheel-saveduit.png'
import pointerImg from './assets/pointer.png'
import spinButtonCircleSvg from './assets/spin-button-circle.svg'
import nomorUndianCircleSvg from './assets/nomor-undian-circle.svg'
import motifRedImg from './assets/motif-red.png'
import motifYellowImg from './assets/motif-yellow.png'

const DESIGN_WIDTH = 1080
const DESIGN_HEIGHT = 1920

type ScreenMode = 'start' | 'wheel' | 'win' | 'zonk'
type ThemeMode = 'xtrarun' | 'saveduit'

interface WheelSegment {
  index: number
  label: string
  isWin: boolean
}

interface Peserta {
  NO: number
  BIB: number
  NAMA: string
  KATEGORI: string
}

interface InitialParams {
  screen: ScreenMode
  theme: ThemeMode
  bib: number
  prize: string
}

const PESERTA_LIST: Peserta[] = pesertaData

function findPesertaByBib(bibInput: number | string): Peserta | undefined {
  const cleaned = String(bibInput ?? '').replace(/\D/g, '')
  if (!cleaned) return undefined
  const numericBib = Number(cleaned)
  if (!numericBib || Number.isNaN(numericBib)) return undefined
  return PESERTA_LIST.find((p) => Number(p.BIB) === numericBib)
}

function getThemeFromKategori(kategori: string): ThemeMode {
  return kategori.trim().toUpperCase() === 'XTRARUN' ? 'xtrarun' : 'saveduit'
}

// 12 segments clockwise starting from 12 o'clock (each segment = 30deg).
// At rotation = 0deg, segment index 2 ('1') sits directly under the right-side pointer.
const WHEEL_SEGMENTS: WheelSegment[] = [
  { index: 0, label: '5', isWin: true },
  { index: 1, label: 'zonk', isWin: false },
  { index: 2, label: '1', isWin: true },
  { index: 3, label: '3', isWin: true },
  { index: 4, label: 'zonk', isWin: false },
  { index: 5, label: '4', isWin: true },
  { index: 6, label: '5', isWin: true },
  { index: 7, label: 'zonk', isWin: false },
  { index: 8, label: '2', isWin: true },
  { index: 9, label: '3', isWin: true },
  { index: 10, label: 'zonk', isWin: false },
  { index: 11, label: '4', isWin: true },
]

function isValidScreen(value: string | null): value is ScreenMode {
  return (
    value === 'start' ||
    value === 'wheel' ||
    value === 'win' ||
    value === 'zonk'
  )
}

function getInitialParams(): InitialParams {
  if (typeof window === 'undefined') {
    return { screen: 'start', theme: 'saveduit', bib: 0, prize: '1' }
  }

  const params = new URLSearchParams(window.location.search)
  const screenParam = params.get('screen')
  const themeParam = params.get('theme')
  const bibParam = params.get('bib')
  const prizeParam = params.get('prize')

  const screen: ScreenMode = isValidScreen(screenParam) ? screenParam : 'start'
  const parsedBib = bibParam !== null ? parseInt(bibParam, 10) : NaN
  const bib: number = !Number.isNaN(parsedBib)
    ? parsedBib
    : screen === 'win' || screen === 'zonk'
      ? (PESERTA_LIST[0]?.BIB ?? 10128)
      : 0
  const matchedPeserta = findPesertaByBib(bib)
  const theme: ThemeMode =
    screen !== 'start' && matchedPeserta
      ? getThemeFromKategori(matchedPeserta.KATEGORI)
      : themeParam === 'xtrarun'
        ? 'xtrarun'
        : 'saveduit'
  const prize =
    prizeParam && ['1', '2', '3', '4', '5'].includes(prizeParam)
      ? prizeParam
      : '1'

  return { screen, theme, bib, prize }
}

export default function App() {
  const initial = getInitialParams()
  const [screen, setScreen] = useState<ScreenMode>(initial.screen)
  const [theme, setTheme] = useState<ThemeMode>(initial.theme)
  const [bibNumber, setBibNumber] = useState<number>(initial.bib)
  const [warningMessage, setWarningMessage] = useState<string | null>(null)
  const [prizeNumber, setPrizeNumber] = useState<string>(initial.prize)
  const [rotation, setRotation] = useState<number>(0)
  const [isSpinning, setIsSpinning] = useState<boolean>(false)
  const [scale, setScale] = useState<number>(1)
  const spinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function updateScale() {
      const wScale = window.innerWidth / DESIGN_WIDTH
      const hScale = window.innerHeight / DESIGN_HEIGHT
      const nextScale = Math.min(wScale, hScale)
      setScale(nextScale)
    }

    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current) {
        clearTimeout(spinTimeoutRef.current)
      }
    }
  }, [])

  const handleBibChange = (nextBib: number) => {
    const validBib = Number.isNaN(nextBib) ? 0 : nextBib
    setBibNumber(validBib)
  }

  const handleStart = (e?: FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault()
    const currentBib = Number(String(bibNumber ?? '').replace(/\D/g, ''))
    if (!currentBib) {
      setWarningMessage('Harap masukkan nomor BIB terlebih dahulu!')
      return
    }

    const peserta = findPesertaByBib(currentBib)
    if (!peserta) {
      setWarningMessage(
        `Nomor BIB "${currentBib}" tidak terdaftar dalam data peserta.`,
      )
      return
    }

    setBibNumber(currentBib)
    setTheme(getThemeFromKategori(peserta.KATEGORI))
    setWarningMessage(null)
    setScreen('wheel')
  }

  const handleSpin = () => {
    if (isSpinning) return
    setIsSpinning(true)

    const chosenIndex = Math.floor(Math.random() * WHEEL_SEGMENTS.length)
    const chosenSegment = WHEEL_SEGMENTS[chosenIndex]

    // Calculate clockwise rotation so chosenIndex aligns with the right-side pointer (index 2 at 0deg)
    const targetMod = ((2 - chosenIndex) * 30 + 360) % 360
    const currentMod = ((rotation % 360) + 360) % 360
    const deltaMod = (targetMod - currentMod + 360) % 360
    const extraSpins = (5 + Math.floor(Math.random() * 3)) * 360
    const nextRotation = rotation + extraSpins + deltaMod

    setRotation(nextRotation)

    spinTimeoutRef.current = setTimeout(() => {
      setIsSpinning(false)
      if (chosenSegment.isWin) {
        setPrizeNumber(chosenSegment.label)
        setScreen('win')
      } else {
        setScreen('zonk')
      }
    }, 4200)
  }

  const handleClaim = () => {
    setIsSpinning(false)
    setBibNumber(0)
    setScreen('start')
  }

  const backgroundImg = theme === 'saveduit' ? saveduitBg : xtrarunBg
  const wheelImg = theme === 'saveduit' ? spinWheelSaveduit : spinWheelXtrarun
  const isSaveduitResult =
    theme === 'saveduit' && (screen === 'win' || screen === 'zonk')

  return (
    <div
      className={`viewport-wrapper ${theme === 'saveduit' ? 'theme-saveduit' : 'theme-xtrarun'
        }`}
    >
      <div
        className="kiosk-stage"
        data-node-id={
          screen === 'start'
            ? theme === 'saveduit'
              ? '15:134'
              : '14:23'
            : screen === 'wheel'
              ? theme === 'saveduit'
                ? '15:146'
                : '14:36'
              : screen === 'win'
                ? theme === 'saveduit'
                  ? '15:152'
                  : '14:50'
                : theme === 'saveduit'
                  ? '159:46'
                  : '156:12'
        }
        data-name={screen === 'start' ? 'START SCREEN' : 'SPIN WHEEL'}
        style={{
          transform: Math.abs(scale - 1) < 0.001 ? 'none' : `scale(${scale})`,
        }}
      >
        {/* Background Layer (14:24 / 14:37) */}
        <div className="layer-bg" data-node-id="14:24" data-name="XTRARUN 1">
          <img alt="" className="img-cover" src={backgroundImg} />
        </div>

        {/* Title Header Layer (14:26 / 14:38) */}
        <div
          className="layer-title"
          data-node-id="14:26"
          data-name="TITTLE XTRARUN 1"
        >
          <img alt="" className="img-cover" src={titleXtrarun} />
        </div>

        {/* Bank Jateng Logo Layer (14:28 / 14:39) */}
        <div
          className="layer-logo"
          data-node-id="14:28"
          data-name="logo bank jateng background biru-02 1"
        >
          <img alt="Bank Jateng" className="img-cover" src={logoBankJateng} />
        </div>

        {/* SCREEN 1: START SCREEN (14:23 / 15:134) */}
        {screen === 'start' && (
          <form onSubmit={handleStart}>
            <div data-node-id="14:122">
              <div className="start-bib-card" data-node-id="14:33" />
              <p
                className="start-bib-label font-hanson"
                data-node-id="14:35"
              >
                NOMOR BIB
              </p>
              <div className="start-bib-input-box" data-node-id="14:30">
                <input
                  type="text"
                  inputMode="numeric"
                  className="start-bib-input"
                  placeholder="Masukkan nomor BIB"
                  value={bibNumber ? String(bibNumber) : ''}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '')
                    handleBibChange(digits ? Number(digits) : 0)
                  }}
                  aria-label="Nomor BIB"
                  data-node-id="14:31"
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-mulai"
              data-node-id="14:27"
            >
              <span
                className="btn-mulai-text font-hanson"
                data-node-id="14:29"
              >
                MULAI
              </span>
            </button>
          </form>
        )}

        {/* WARNING POPUP MODAL */}
        {warningMessage && (
          <div
            className="warning-modal-backdrop"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="warning-modal-title"
            aria-describedby="warning-modal-desc"
            onClick={() => setWarningMessage(null)}
          >
            <div
              className="warning-modal-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="warning-modal-icon" aria-hidden="true">
                !
              </div>
              <h2
                id="warning-modal-title"
                className="warning-modal-title font-hanson"
              >
                PERINGATAN
              </h2>
              <p
                id="warning-modal-desc"
                className="warning-modal-message font-open-sauce"
              >
                {warningMessage}
              </p>
              <button
                type="button"
                className="warning-modal-btn"
                onClick={() => setWarningMessage(null)}
              >
                <span className="warning-modal-btn-text font-hanson">
                  TUTUP
                </span>
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 2, 3, 4: SPIN WHEEL & RESULT OVERLAYS (14:36, 14:50, 156:12) */}
        {screen !== 'start' && (
          <>
            {/* Wheel Image (14:48 / 156:2) */}
            <div
              className="wheel-container"
              data-node-id="14:48"
              data-name="SPIN WHEEL 1"
            >
              <div
                className="wheel-rotor"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: isSpinning
                    ? 'transform 4.2s cubic-bezier(0.15, 0.85, 0.25, 1)'
                    : 'none',
                }}
              >
                <img alt="" className="img-cover" src={wheelImg} />
              </div>
            </div>

            {/* Pointer Image (14:49) */}
            <div
              className="wheel-pointer"
              data-node-id="14:49"
              data-name="POINTER 1"
            >
              <img alt="" className="img-cover" src={pointerImg} />
            </div>

            {/* Center Spin Hub Button (57:4 / 211:2 / 211:7 / 188:6) */}
            <button
              type="button"
              className="btn-spin-center"
              onClick={handleSpin}
              disabled={isSpinning || screen !== 'wheel'}
              aria-label="Spin"
              data-node-id="57:4"
            >
              <img
                alt=""
                className="btn-spin-circle-svg"
                src={spinButtonCircleSvg}
                width="250"
                height="250"
                data-node-id="57:2"
              />
              <div
                className="btn-spin-logo"
                data-node-id="188:3"
                data-name="logo bank jateng background biru-02 1"
              >
                <img alt="" className="img-cover" src={logoBankJateng} />
              </div>
            </button>

            {/* Result Overlay (14:50 HADIAH or 156:12 ZONK) */}
            {(screen === 'win' || screen === 'zonk') && (
              <>
                <div
                  className="result-overlay-backdrop"
                  data-node-id="14:57"
                />

                {/* Top Celebration Group: HADIAH + Motifs (14:118 / 211:81 / 15:159 / 211:90) */}
                <div
                  className={
                    isSaveduitResult
                      ? 'celebration-group-saveduit'
                      : 'celebration-group-xtrarun'
                  }
                  data-node-id={screen === 'win' ? '14:118' : '211:81'}
                >
                  <div
                    className="motif-red-1"
                    data-node-id="14:112"
                    data-name="motif red 1"
                  >
                    <img alt="" className="img-cover" src={motifRedImg} />
                  </div>
                  <div
                    className="motif-red-2"
                    data-node-id="14:113"
                    data-name="motif red 2"
                  >
                    <img alt="" className="img-cover" src={motifRedImg} />
                  </div>
                  <div
                    className="motif-yellow-1"
                    data-node-id="14:115"
                    data-name="motif yellow 1"
                  >
                    <img alt="" className="img-cover" src={motifYellowImg} />
                  </div>
                  <div
                    className="motif-yellow-2"
                    data-node-id="14:116"
                    data-name="motif yellow 2"
                  >
                    <img alt="" className="img-cover" src={motifYellowImg} />
                  </div>
                  <div
                    className="motif-yellow-3"
                    data-node-id="14:117"
                    data-name="motif yellow 3"
                  >
                    <img alt="" className="img-cover" src={motifYellowImg} />
                  </div>
                  <p
                    className="result-heading-hadiah font-hanson"
                    data-node-id="14:58"
                  >
                    HADIAH
                  </p>
                </div>

                {/* Center Prize Display: NOMOR UNDIAN (211:43) or ZONK (156:20) */}
                {screen === 'win' ? (
                  <div
                    className="nomor-undian"
                    data-node-id="211:43"
                    data-name="NOMOR UNDIAN"
                  >
                    <div
                      className="nomor-undian-circle"
                      data-node-id="211:42"
                    >
                      <img
                        alt=""
                        className="nomor-undian-circle-svg"
                        src={nomorUndianCircleSvg}
                        width="337"
                        height="337"
                      />
                    </div>
                    <p
                      className="nomor-undian-text font-hanson"
                      data-node-id="211:13"
                    >
                      {prizeNumber}
                    </p>
                  </div>
                ) : (
                  <div data-node-id="156:20">
                    <p
                      className="result-heading-zonk font-hanson"
                      data-node-id="156:27"
                    >
                      ZONK
                    </p>
                  </div>
                )}

                {/* Action Button: KLAIM on Win (14:129) / KELUAR on Zonk (156:33) */}
                <button
                  type="button"
                  className="btn-klaim"
                  onClick={handleClaim}
                  data-node-id={screen === 'win' ? '14:130' : '156:34'}
                >
                  <span
                    className="btn-klaim-text font-hanson"
                    data-node-id={screen === 'win' ? '14:131' : '156:35'}
                  >
                    {screen === 'win' ? 'KLAIM' : 'KELUAR'}
                  </span>
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}


