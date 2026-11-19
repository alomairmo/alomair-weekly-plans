import { useEffect, useMemo, useState } from 'react'
import {
  AtSign,
  Check,
  Copy,
  Link2,
  LoaderCircle,
  MessageSquareText,
  Send,
  Share2,
  UserPlus,
  UsersRound,
} from 'lucide-react'
import { trpc } from '@/providers/trpc'
import { getInitialWeek, planWeeks } from '@/data/weeklyPlan'
import {
  buildSchoolDirectLink,
  buildTeacherShareMessage,
} from '@/lib/schoolSharing'
import type { SchoolBootstrap, SchoolLinkedAdmin } from '@contracts/lessonPlans'

type SchoolSharingProps = {
  token: string
  data: SchoolBootstrap
}

type CopyState = 'idle' | 'copied' | 'failed'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function errorMessage(error: unknown): string | null {
  if (!error) return null
  const message = (error as { message?: string }).message
  return message && message.trim().length > 0 ? message : 'حدث خطأ غير متوقع، حاول مرة أخرى.'
}

// النسخ تفاعل متصفح فقط؛ تبقى دوال الرسالة والرابط نقية وقابلة للاختبار في الخادم.
async function copyShareText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // نتابع إلى التراجع اليدوي أدناه.
  }
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}

export default function SchoolSharing({ token, data }: SchoolSharingProps) {
  const utils = trpc.useUtils()

  // ------ الحسابات المرتبطة بالإدارة ------
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)

  const adminsQuery = trpc.lessonPlans.linkedAdmins.useQuery({ token })
  const admins: SchoolLinkedAdmin[] = adminsQuery.data ?? []

  const addAdminMutation = trpc.lessonPlans.addLinkedAdmin.useMutation({
    onSuccess: () => {
      setEmail('')
      setEmailError(null)
      void utils.lessonPlans.linkedAdmins.invalidate({ token })
    },
  })

  const emailValid = EMAIL_REGEX.test(email.trim())
  const addAdminError = emailError ?? errorMessage(addAdminMutation.error)

  function handleAddAdmin(event: React.FormEvent) {
    event.preventDefault()
    const normalized = email.trim().toLowerCase()
    if (!EMAIL_REGEX.test(normalized)) {
      setEmailError('أدخل بريدًا إلكترونيًا صحيحًا لحساب نمذجة.')
      return
    }
    setEmailError(null)
    addAdminMutation.mutate({ token, email: normalized })
  }

  // ------ رابط الدخول المباشر ------
  const directLink = useMemo(() => buildSchoolDirectLink(data.school.code), [data.school.code])
  const [linkCopyState, setLinkCopyState] = useState<CopyState>('idle')

  async function copyLink() {
    const ok = await copyShareText(directLink)
    setLinkCopyState(ok ? 'copied' : 'failed')
    window.setTimeout(() => setLinkCopyState('idle'), 2500)
  }

  // ------ رسالة المشاركة المقترحة ------
  const [week, setWeek] = useState<number>(() => getInitialWeek())
  const weekInfo = planWeeks.find((item) => item.number === week) ?? planWeeks[0]

  const generatedMessage = useMemo(
    () =>
      buildTeacherShareMessage({
        schoolName: data.school.name,
        week,
        weekDates: weekInfo?.dates,
        link: directLink,
      }),
    [data.school.name, week, weekInfo?.dates, directLink],
  )

  // المعاينة قابلة للتحرير، لكنها تتحدث تلقائيًا عند تغيير الأسبوع.
  const [messageDraft, setMessageDraft] = useState(generatedMessage)
  useEffect(() => {
    setMessageDraft(generatedMessage)
  }, [generatedMessage])

  const [messageCopyState, setMessageCopyState] = useState<CopyState>('idle')
  const [shareState, setShareState] = useState<CopyState>('idle')
  const [shareNote, setShareNote] = useState<string | null>(null)

  async function copyMessage() {
    const ok = await copyShareText(messageDraft)
    setMessageCopyState(ok ? 'copied' : 'failed')
    window.setTimeout(() => setMessageCopyState('idle'), 2500)
  }

  async function shareMessage() {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ text: messageDraft })
        setShareState('idle')
        setShareNote('تمت المشاركة.')
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          // إلغاء المستخدم ليس خطأً.
          setShareState('idle')
          setShareNote(null)
          return
        }
        const ok = await copyShareText(messageDraft)
        setShareState(ok ? 'copied' : 'failed')
        setShareNote(ok
          ? 'تعذر فتح قائمة المشاركة؛ نُسخت الرسالة بدلًا من ذلك.'
          : 'تعذر فتح قائمة المشاركة والنسخ؛ حدّد النص وانسخه يدويًا.')
      }
      return
    }
    const ok = await copyShareText(messageDraft)
    setShareState(ok ? 'copied' : 'failed')
    setShareNote(
      ok
        ? 'المشاركة المباشرة غير متاحة في هذا المتصفح؛ نُسخت الرسالة تلقائيًا والصقها في أي تطبيق.'
        : 'المشاركة المباشرة غير متاحة وتعذر النسخ؛ حدّد النص وانسخه يدويًا.',
    )
    window.setTimeout(() => {
      setShareState('idle')
      setShareNote(null)
    }, 4000)
  }

  return (
    <div dir="rtl" className="sharing-panel">
      {/* الحسابات المرتبطة بالإدارة */}
      <section className="sharing-card" aria-labelledby="sharing-admins-title">
        <header className="sharing-card-header">
          <UsersRound className="h-5 w-5" aria-hidden="true" />
          <div>
            <h2 id="sharing-admins-title">الحسابات المرتبطة بالإدارة</h2>
            <p>اربط حسابات نمذجة بإدارة المدرسة ليدخل أصحابها دون كلمة مرور الإدارة.</p>
          </div>
        </header>

        <form className="sharing-add-form" onSubmit={handleAddAdmin}>
          <label htmlFor="sharing-admin-email">بريد حساب نمذجة</label>
          <div className="sharing-add-row">
            <input
              id="sharing-admin-email"
              type="email"
              dir="ltr"
              inputMode="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                setEmailError(null)
                addAdminMutation.reset()
              }}
            />
            <button
              type="submit"
              className="sharing-primary-button"
              disabled={!emailValid || addAdminMutation.isPending}
            >
              {addAdminMutation.isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <UserPlus className="h-4 w-4" aria-hidden="true" />
              )}
              {addAdminMutation.isPending ? 'جارٍ الإضافة…' : 'إضافة الحساب'}
            </button>
          </div>
        </form>

        {addAdminError && (
          <p className="sharing-error" role="alert">
            {addAdminError}
          </p>
        )}
        {addAdminMutation.isSuccess && (
          <p className="sharing-success" role="status">
            <Check className="h-4 w-4" aria-hidden="true" /> أُضيف الحساب إلى إدارة المدرسة.
          </p>
        )}

        {adminsQuery.isLoading ? (
          <p className="sharing-loading">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> جارٍ تحميل الحسابات المرتبطة…
          </p>
        ) : adminsQuery.isError ? (
          <p className="sharing-error" role="alert">
            {errorMessage(adminsQuery.error)}
          </p>
        ) : admins.length === 0 ? (
          <p className="sharing-empty">لا توجد حسابات مرتبطة بعد. أضف بريد حساب نمذجة لربطه بالإدارة.</p>
        ) : (
          <ul className="sharing-admin-list">
            {admins.map((admin) => (
              <li key={admin.id} className="sharing-admin-item">
                <AtSign className="h-4 w-4" aria-hidden="true" />
                <div className="sharing-admin-info">
                  {admin.email ? (
                    <bdi dir="ltr">{admin.email}</bdi>
                  ) : (
                    <>
                      <strong>الحساب المالك</strong>
                      <small>يظهر بريده هنا بعد دخوله التالي بحساب نمذجة.</small>
                    </>
                  )}
                </div>
                <span className={admin.owner ? 'sharing-badge sharing-badge--owner' : 'sharing-badge'}>
                  {admin.owner ? 'المالك' : 'إداري'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* رابط الدخول المباشر */}
      <section className="sharing-card" aria-labelledby="sharing-link-title">
        <header className="sharing-card-header">
          <Link2 className="h-5 w-5" aria-hidden="true" />
          <div>
            <h2 id="sharing-link-title">رابط الدخول المباشر للمدرسة</h2>
            <p>رابط عام آمن يفتح الأداة مع تعبئة كود المدرسة تلقائيًا، ولا يتضمن كلمة مرور أو أسرارًا.</p>
          </div>
        </header>
        <div className="sharing-link-row">
          <bdi dir="ltr" className="sharing-link-text">{directLink}</bdi>
          <button
            type="button"
            onClick={copyLink}
            className={
              linkCopyState === 'copied' ? 'sharing-copy-button is-copied' : 'sharing-copy-button'
            }
          >
            {linkCopyState === 'copied' ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
            {linkCopyState === 'copied' ? 'تم النسخ' : linkCopyState === 'failed' ? 'تعذر النسخ' : 'نسخ الرابط'}
          </button>
        </div>
        {linkCopyState === 'copied' && (
          <p className="sharing-success" role="status">نُسخ الرابط إلى الحافظة.</p>
        )}
      </section>

      {/* رسالة مشاركة مقترحة */}
      <section className="sharing-card" aria-labelledby="sharing-message-title">
        <header className="sharing-card-header">
          <MessageSquareText className="h-5 w-5" aria-hidden="true" />
          <div>
            <h2 id="sharing-message-title">رسالة مشاركة مقترحة</h2>
            <p>رسالة جاهزة تطلب من المعلمين تعبئة الخطة الأسبوعية مع شرح الخطوات.</p>
          </div>
        </header>

        <div className="sharing-week-row">
          <label htmlFor="sharing-week-select">الأسبوع المطلوب</label>
          <select
            id="sharing-week-select"
            value={week}
            onChange={(event) => setWeek(Number(event.target.value))}
          >
            {planWeeks.map((item) => (
              <option key={item.number} value={item.number}>
                الأسبوع {item.number.toLocaleString('ar-EG')} — {item.dates}
              </option>
            ))}
          </select>
        </div>

        <textarea
          className="sharing-message-preview"
          value={messageDraft}
          onChange={(event) => setMessageDraft(event.target.value)}
          rows={14}
          aria-label="معاينة رسالة المشاركة"
        />

        <div className="sharing-message-actions">
          <button
            type="button"
            onClick={copyMessage}
            className={
              messageCopyState === 'copied' ? 'sharing-copy-button is-copied' : 'sharing-copy-button'
            }
          >
            {messageCopyState === 'copied' ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
            {messageCopyState === 'copied' ? 'تم النسخ' : messageCopyState === 'failed' ? 'تعذر النسخ' : 'نسخ الرسالة'}
          </button>
          <button type="button" onClick={shareMessage} className="sharing-primary-button">
            {shareState === 'copied' ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Share2 className="h-4 w-4" aria-hidden="true" />
            )}
            مشاركة
          </button>
        </div>
        {messageCopyState === 'copied' && (
          <p className="sharing-success" role="status">
            <Send className="h-4 w-4" aria-hidden="true" /> نُسخت الرسالة مع الرابط إلى الحافظة.
          </p>
        )}
        {shareNote && (
          <p className={shareState === 'failed' ? 'sharing-error' : 'sharing-success'} role="status">
            {shareNote}
          </p>
        )}
      </section>
    </div>
  )
}
