import { Copy } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FORM_SLUG } from '../lib/data'
import { useStore } from '../lib/store'

export default function ShareBlock() {
  const { formName } = useStore()
  const publicUrl = `${window.location.origin}/f/${FORM_SLUG}`
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState<'link' | 'embed' | null>(null)

  useEffect(() => {
    QRCode.toDataURL(publicUrl, {
      margin: 1,
      width: 148,
      color: { dark: '#12265a', light: '#ffffff' },
    })
      .then(setQr)
      .catch(() => setQr(null))
  }, [publicUrl])

  const embed = `<iframe src="${publicUrl}" width="100%" height="720" style="border:0;border-radius:16px" title="${formName}"></iframe>`

  const copy = (text: string, which: 'link' | 'embed') => {
    navigator.clipboard?.writeText(text).catch(() => {})
    setCopied(which)
    window.setTimeout(() => setCopied(null), 1800)
  }

  return (
    <>
      <div className="share-row">
        <span className="share-link mono" dir="ltr">
          {publicUrl}
        </span>
        <button type="button" className="btn btn-primary" onClick={() => copy(publicUrl, 'link')}>
          <Copy size={13} aria-hidden="true" /> {copied === 'link' ? 'הועתק ✓' : 'העתקה'}
        </button>
        <Link className="btn btn-secondary" to={`/f/${FORM_SLUG}`} target="_blank">
          פתיחה
        </Link>
      </div>
      {qr && (
        <div className="qr-box">
          <img src={qr} alt={`קוד QR לטופס ${formName}`} width={148} height={148} />
          <span>סריקה למילוי מהנייד</span>
        </div>
      )}
      <div className="embed-box">
        <div className="embed-head">
          <span className="field-label">קוד הטמעה (iframe)</span>
          <button type="button" className="mini-copy" onClick={() => copy(embed, 'embed')}>
            {copied === 'embed' ? 'הועתק ✓' : 'העתקת הקוד'}
          </button>
        </div>
        <code className="embed-code" dir="ltr">
          {embed}
        </code>
      </div>
    </>
  )
}
