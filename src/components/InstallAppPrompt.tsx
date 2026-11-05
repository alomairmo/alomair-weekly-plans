import { useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'

type InstallChoice = {
  outcome: 'accepted' | 'dismissed'
  platform: string
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<InstallChoice>
}

const dismissKey = 'alomair-install-banner-dismissed'

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  )
}

function wasDismissed() {
  try {
    return sessionStorage.getItem(dismissKey) === 'true'
  } catch {
    return false
  }
}

function isIos() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function isMacSafari() {
  return (
    /Macintosh/.test(navigator.userAgent) &&
    /Safari/.test(navigator.userAgent) &&
    !/Chrome|Chromium|Edg/.test(navigator.userAgent)
  )
}

export default function InstallAppPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(() => !isStandalone() && !wasDismissed())
  const [showInstructions, setShowInstructions] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)')
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
      if (!wasDismissed() && !isStandalone()) setVisible(true)
    }
    const handleInstalled = () => {
      setDeferredPrompt(null)
      setVisible(false)
    }
    const handleDisplayModeChange = () => {
      if (isStandalone()) setVisible(false)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleInstalled)
    displayMode.addEventListener('change', handleDisplayModeChange)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleInstalled)
      displayMode.removeEventListener('change', handleDisplayModeChange)
    }
  }, [])

  if (!visible) return null

  const dismiss = () => {
    try {
      sessionStorage.setItem(dismissKey, 'true')
    } catch {
      // الإخفاء يعمل حتى عندما يمنع المتصفح التخزين المحلي.
    }
    setVisible(false)
  }

  const install = async () => {
    if (!deferredPrompt) {
      setShowInstructions(true)
      return
    }

    setInstalling(true)
    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      setDeferredPrompt(null)
      if (choice.outcome === 'accepted') {
        setVisible(false)
      } else {
        setShowInstructions(true)
      }
    } catch {
      setShowInstructions(true)
    } finally {
      setInstalling(false)
    }
  }

  return (
    <section className="install-app" aria-label="تثبيت تطبيق جدول العماير">
      <div className="install-app-main">
        <img className="install-app-icon" src="/icons/icon-192.png" alt="" width="44" height="44" />
        <div className="install-app-copy">
          <strong>ثبّت «جدول العماير» على جهازك</strong>
          <span>يفتح بضغطة واحدة كتطبيق مستقل على الجوال أو الكمبيوتر.</span>
        </div>
        <div className="install-app-actions">
          <button type="button" className="install-app-button" onClick={install} disabled={installing}>
            <Download size={18} aria-hidden="true" />
            {installing ? 'جارٍ فتح التثبيت…' : 'تثبيت التطبيق'}
          </button>
          <button type="button" className="install-app-dismiss" onClick={dismiss} aria-label="إخفاء شريط التثبيت">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      {showInstructions && (
        <div className="install-app-instructions" role="status">
          {isIos() ? (
            <>
              <Share size={18} aria-hidden="true" />
              <span>اضغط «مشاركة» في متصفحك، ثم اختر «إضافة إلى الشاشة الرئيسية» واضغط «إضافة».</span>
            </>
          ) : isMacSafari() ? (
            <span>من قائمة «ملف» في Safari اختر «إضافة إلى Dock»، ثم أكّد الإضافة.</span>
          ) : (
            <span>من قائمة المتصفح اختر «تثبيت التطبيق» أو «إضافة إلى سطح المكتب / الشاشة الرئيسية». إذا لم يظهر الخيار، استخدم Chrome أو Edge.</span>
          )}
        </div>
      )}
    </section>
  )
}
