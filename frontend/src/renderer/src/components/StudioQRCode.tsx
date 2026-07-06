import { useRef, useState } from 'react'
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react'
import { Copy, Check, Download, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Props {
  studioName: string
  studioUrl: string
  size?: number
}

export function StudioQRCode({ studioName, studioUrl, size = 180 }: Props) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const qrValue = JSON.stringify({ url: studioUrl, name: studioName })
  const isLocalhost = studioUrl.includes('localhost') || studioUrl.includes('127.0.0.1')

  const handleCopy = async () => {
    await navigator.clipboard.writeText(studioUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `agon-qr-${studioName.toLowerCase().replace(/\s+/g, '-')}.png`
    a.click()
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* QR Code */}
      <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
        <QRCodeSVG
          value={qrValue}
          size={size}
          fgColor="#111827"
          bgColor="#ffffff"
          level="M"
        />
      </div>

      {/* Hidden canvas for download */}
      <div className="hidden">
        <QRCodeCanvas
          ref={canvasRef}
          value={qrValue}
          size={400}
          fgColor="#111827"
          bgColor="#ffffff"
          level="M"
        />
      </div>

      {/* URL row */}
      <div className="flex items-center gap-2 w-full max-w-xs">
        <code className="flex-1 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-1.5 truncate">
          {studioUrl}
        </code>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors shrink-0"
          title={t('qr.copyUrl')}
        >
          {copied
            ? <Check size={13} className="text-green-600" />
            : <Copy size={13} />
          }
          {copied ? t('qr.copied') : t('qr.copyUrl')}
        </button>
        <button
          onClick={handleDownload}
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors shrink-0"
          title={t('qr.download')}
        >
          <Download size={13} />
          {t('qr.download')}
        </button>
      </div>

      {/* Localhost warning */}
      {isLocalhost && (
        <div className="flex items-start gap-2 w-full max-w-xs rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5">
          <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700">{t('qr.localWarning')}</p>
        </div>
      )}
    </div>
  )
}
