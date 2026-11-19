import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Building2,
  Check,
  Copy,
  KeyRound,
  LoaderCircle,
  LogIn,
  Link2,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { trpc } from '@/providers/trpc'
import { namthajaAuth } from '@/lib/namthajaAuth'
import PlatformBrand from './PlatformBrand'
import type { SchoolInfo, SchoolSession, SchoolTeacher } from '@contracts/lessonPlans'

type SchoolAuthProps = {
  onAuthenticated: (session: SchoolSession) => void
}

type Mode = 'login' | 'register'
type RoleChoice = 'teacher' | 'admin'

const CODE_REGEX = /^\d{6}$/

function schoolCodeFromUrl(): string {
  if (typeof window === 'undefined') return ''
  const value = new URLSearchParams(window.location.search).get('code')?.trim() ?? ''
  return CODE_REGEX.test(value) ? value : ''
}

const fontStyle = { fontFamily: "'Tajawal', Tahoma, Arial, sans-serif" }

function errorMessage(error: unknown): string | null {
  if (!error) return null
  const message = (error as { message?: string }).message
  return message && message.trim().length > 0 ? message : 'حدث خطأ غير متوقع، حاول مرة أخرى.'
}

export default function SchoolAuth({ onAuthenticated }: SchoolAuthProps) {
  const [mode, setMode] = useState<Mode>('login')

  // ------ وضع تسجيل الدخول ------
  const [code, setCode] = useState(schoolCodeFromUrl)
  const [role, setRole] = useState<RoleChoice>('teacher')
  const [teacherId, setTeacherId] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [platformToken, setPlatformToken] = useState<string | null>(null)
  const [platformEmail, setPlatformEmail] = useState<string | null>(null)
  const [platformChecking, setPlatformChecking] = useState(true)
  const platformAttempted = useRef(false)
  const [platformSchools, setPlatformSchools] = useState<SchoolInfo[]>([])

  const codeValid = CODE_REGEX.test(code)

  const teachersQuery = trpc.lessonPlans.schoolTeachers.useQuery(
    { code },
    {
      enabled: mode === 'login' && codeValid,
      retry: 1,
      staleTime: 60_000,
    },
  )
  const teachers: SchoolTeacher[] = teachersQuery.data ?? []

  const claimPlatformSchoolMutation = trpc.lessonPlans.claimPlatformSchool.useMutation()
  const platformLoginMutation = trpc.lessonPlans.platformLogin.useMutation({
    onSuccess: (result) => {
      if (result.status === 'authenticated') {
        onAuthenticated(result.session)
      } else if (result.status === 'choose_school') {
        setPlatformSchools(result.schools)
      } else {
        setPlatformSchools([])
      }
    },
  })
  const attemptPlatformLogin = platformLoginMutation.mutate

  const loginMutation = trpc.lessonPlans.login.useMutation({
    onSuccess: (session) => {
      // إثبات كلمة مرور الإدارة يسمح بربط مدرسة قديمة بالحساب الحالي مرة واحدة.
      if (session.role === 'admin' && platformToken) {
        claimPlatformSchoolMutation.mutate({ token: session.token, accessToken: platformToken })
      }
      onAuthenticated(session)
    },
  })

  useEffect(() => {
    let mounted = true
    void namthajaAuth.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setPlatformToken(data.session?.access_token ?? null)
      setPlatformEmail(data.session?.user.email ?? null)
      setPlatformChecking(false)
    }).catch(() => {
      if (mounted) setPlatformChecking(false)
    })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!platformToken || platformAttempted.current) return
    platformAttempted.current = true
    attemptPlatformLogin({ accessToken: platformToken, ...(codeValid ? { code } : {}) })
  }, [platformToken, attemptPlatformLogin, code, codeValid])

  const loginError =
    formError ??
    errorMessage(loginMutation.error) ??
    (codeValid ? errorMessage(teachersQuery.error) : null)

  const canSubmitLogin = useMemo(() => {
    if (!codeValid || loginMutation.isPending) return false
    if (role === 'admin') return adminPassword.length > 0
    return teacherId.length > 0
  }, [codeValid, loginMutation.isPending, role, adminPassword, teacherId])

  function handleCodeChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 6)
    setCode(digits)
    setFormError(null)
    loginMutation.reset()
  }

  function handleLoginSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmitLogin) return
    setFormError(null)
    if (role === 'teacher' && !teachers.some((t) => t.id === teacherId)) {
      setFormError('اختر اسمك من قائمة المعلمين.')
      return
    }
    loginMutation.mutate({
      code,
      role,
      teacherId: role === 'teacher' ? teacherId : null,
      password: role === 'admin' ? adminPassword : null,
    })
  }

  // ------ وضع تسجيل مدرسة جديدة ------
  const [schoolName, setSchoolName] = useState('')
  const [schoolPassword, setSchoolPassword] = useState('')
  const [schoolPasswordConfirm, setSchoolPasswordConfirm] = useState('')
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [registered, setRegistered] = useState<{
    schoolCode: string
    schoolName: string
    session: SchoolSession
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const registerMutation = trpc.lessonPlans.registerSchool.useMutation({
    onSuccess: (result) => {
      setRegistered(result)
    },
  })

  const passwordTooShort = schoolPassword.length > 0 && schoolPassword.length < 8
  const passwordsMismatch =
    schoolPasswordConfirm.length > 0 && schoolPassword !== schoolPasswordConfirm

  const canSubmitRegister =
    schoolName.trim().length >= 2 &&
    schoolPassword.length >= 8 &&
    schoolPassword === schoolPasswordConfirm &&
    !registerMutation.isPending

  const registerErrorMessage = registerError ?? errorMessage(registerMutation.error)

  function handleRegisterSubmit(event: React.FormEvent) {
    event.preventDefault()
    setRegisterError(null)
    if (schoolName.trim().length < 2) {
      setRegisterError('أدخل اسم المدرسة (حرفان على الأقل).')
      return
    }
    if (schoolPassword.length < 8) {
      setRegisterError('كلمة المرور الإدارية يجب ألا تقل عن 8 أحرف.')
      return
    }
    if (schoolPassword !== schoolPasswordConfirm) {
      setRegisterError('تأكيد كلمة المرور غير متطابق.')
      return
    }
    registerMutation.mutate({
      name: schoolName.trim(),
      password: schoolPassword,
      platformAccessToken: platformToken ?? undefined,
    })
  }

  async function copyCode() {
    if (!registered) return
    try {
      await navigator.clipboard.writeText(registered.schoolCode)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = registered.schoolCode
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  // ------ شاشة نجاح التسجيل ------
  if (registered) {
    return (
      <div dir="rtl" style={fontStyle} className="auth-shell auth-success-shell">
        <header className="auth-topbar"><PlatformBrand /></header>
        <main className="auth-success-card">
          <div className="auth-success-icon">
            <Check className="h-7 w-7" />
          </div>
          <span className="auth-eyebrow">أصبحت مدرستك ضمن الأداة</span>
          <h1>تم إنشاء مدرستك بنجاح</h1>
          <p>
            مدرسة «{registered.schoolName}» جاهزة الآن. احتفظ بكود المدرسة وشاركه مع المعلمين.
          </p>
          <div className="school-code-ticket">
            <span>كود المدرسة</span>
            <strong dir="ltr">{registered.schoolCode}</strong>
          </div>
          <button type="button" onClick={copyCode} className="copy-code-button">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'تم النسخ' : 'نسخ الكود'}
          </button>
          <button type="button" onClick={() => onAuthenticated(registered.session)} className="auth-primary-button">
            متابعة إلى إعداد المدرسة
          </button>
        </main>
      </div>
    )
  }

  return (
    <div dir="rtl" style={fontStyle} className="auth-shell">
      <header className="auth-topbar">
        <PlatformBrand />
        <span className="auth-topbar-label">الخطط الأسبوعية الذكية - نمذجة التعلم</span>
      </header>
      <main className="auth-layout">
        <section className="auth-intro" aria-labelledby="auth-intro-title">
          <span className="auth-eyebrow">منصة «نمذجة» للأدوات الرقمية المخصصة</span>
          <h1 id="auth-intro-title">خططك الأسبوعية<br /><span>بوضوحٍ ونظام</span></h1>
          <p>من الجدول الدراسي إلى خطة جاهزة للمراجعة والتصدير؛ الدروس والأهداف والواجبات في مسار واحد.</p>
          <img className="auth-illustration" src="./retro-learning.svg" alt="كتب ومكعبات معرفة ونبتة وقلم بأسلوب نمذجة الكلاسيكي" />
          <div className="auth-feature-line" aria-label="مزايا الأداة">
            <span>توزيع آلي</span><i aria-hidden="true">✦</i><span>تحرير مرن</span><i aria-hidden="true">✦</i><span>تصدير واضح</span>
          </div>
        </section>
        <section className="auth-form-column" aria-label="الدخول أو تسجيل مدرسة">
          <div className="auth-form-heading">
            <span>الدخول إلى الأداة</span>
            <h2>ابدأ من مدرستك</h2>
            <p>سجّل الدخول بكود مدرستك أو أنشئ مدرسة جديدة.</p>
          </div>
          <div className="auth-card">
          {/* تبويب الوضع */}
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-[#155b58]/5 p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              aria-pressed={mode === 'login'}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                mode === 'login'
                  ? 'bg-[#155b58] text-[#fffaf0] shadow-sm'
                  : 'text-[#155b58] hover:bg-[#155b58]/10'
              }`}
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              aria-pressed={mode === 'register'}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                mode === 'register'
                  ? 'bg-[#155b58] text-[#fffaf0] shadow-sm'
                  : 'text-[#155b58] hover:bg-[#155b58]/10'
              }`}
            >
              مدرسة جديدة
            </button>
          </div>

          <div className="mb-5 rounded-xl border border-[#155b58]/15 bg-[#155b58]/5 px-4 py-3 text-sm" aria-live="polite">
            {platformChecking ? (
              <span className="flex items-center gap-2 text-[#155b58]"><LoaderCircle className="h-4 w-4 animate-spin" /> جارٍ فحص جلسة نمذجة…</span>
            ) : platformToken ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2 text-[#155b58]">
                  <Link2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>حساب نمذجة متصل{platformEmail ? <>: <bdi dir="ltr">{platformEmail}</bdi></> : null}</span>
                </div>
                {platformLoginMutation.isPending && <p className="text-xs text-[#253d37]/65">جارٍ التحقق من المدارس المرتبطة بالحساب…</p>}
                {platformLoginMutation.isError && <p className="text-xs text-red-700">{errorMessage(platformLoginMutation.error)}</p>}
                {platformSchools.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-semibold">اختر مدرسة للدخول إلى إدارتها مباشرة:</p>
                    {platformSchools.map((school) => (
                      <button
                        key={school.id}
                        type="button"
                        onClick={() => attemptPlatformLogin({ accessToken: platformToken, code: school.code })}
                        className="flex w-full items-center justify-between rounded-lg border border-[#155b58]/20 bg-[#fffaf0] px-3 py-2 text-right font-semibold text-[#155b58] transition hover:bg-[#155b58]/10"
                      >
                        <span>{school.name}</span><bdi dir="ltr">{school.code}</bdi>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="leading-relaxed text-[#253d37]/70">
                لديك حساب في نمذجة؟ <a href="https://namthaja.app/login" className="font-bold text-[#155b58] underline underline-offset-4">سجّل الدخول من الموقع</a> ثم عد للأداة ليدخل الحساب الإداري المرتبط تلقائيًا.
              </p>
            )}
          </div>

          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div>
                <label htmlFor="school-code" className="mb-1.5 block text-sm font-semibold">
                  كود المدرسة
                </label>
                <input
                  id="school-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  dir="ltr"
                  maxLength={6}
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="000000"
                  className="w-full rounded-lg border border-[#253d37]/15 bg-[#fffaf0] px-4 py-2.5 text-center text-lg font-bold tracking-[0.5em] outline-none transition focus:border-[#155b58] focus:ring-2 focus:ring-[#155b58]/20"
                />
                {code.length > 0 && !codeValid && (
                  <p className="mt-1.5 text-xs text-[#253d37]/60">
                    الكود مكوّن من 6 أرقام.
                  </p>
                )}
              </div>

              {codeValid && (
                <>
                  {teachersQuery.isLoading ? (
                    <div className="flex items-center justify-center gap-2 rounded-lg bg-[#155b58]/5 py-4 text-sm text-[#155b58]">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      جارٍ التحقق من الكود وتحميل المعلمين…
                    </div>
                  ) : teachersQuery.isError ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                      {errorMessage(teachersQuery.error)}
                    </div>
                  ) : (
                    <>
                      {/* اختيار الدور */}
                      <div>
                        <span className="mb-1.5 block text-sm font-semibold">الدخول بصفة</span>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setRole('teacher')
                              setFormError(null)
                              loginMutation.reset()
                            }}
                            aria-pressed={role === 'teacher'}
                            className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${
                              role === 'teacher'
                                ? 'border-[#155b58] bg-[#155b58] text-[#fffaf0]'
                                : 'border-[#253d37]/15 text-[#253d37] hover:border-[#155b58]/50'
                            }`}
                          >
                            <UserRound className="h-4 w-4" />
                            معلم
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRole('admin')
                              setFormError(null)
                              loginMutation.reset()
                            }}
                            aria-pressed={role === 'admin'}
                            className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${
                              role === 'admin'
                                ? 'border-[#155b58] bg-[#155b58] text-[#fffaf0]'
                                : 'border-[#253d37]/15 text-[#253d37] hover:border-[#155b58]/50'
                            }`}
                          >
                            <ShieldCheck className="h-4 w-4" />
                            إداري
                          </button>
                        </div>
                      </div>

                      {role === 'teacher' ? (
                        <div>
                          <label htmlFor="teacher-select" className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
                            <UsersRound className="h-4 w-4 text-[#155b58]" />
                            اختر اسمك
                          </label>
                          {teachers.length === 0 ? (
                            <p className="rounded-lg bg-[#253d37]/5 px-4 py-3 text-sm text-[#253d37]/70">
                              لا يوجد معلمون مسجلون بعد. يمكن للإداري الدخول وإضافة المعلمين من
                              إعدادات المدرسة.
                            </p>
                          ) : (
                            <select
                              id="teacher-select"
                              value={teacherId}
                              onChange={(e) => {
                                setTeacherId(e.target.value)
                                setFormError(null)
                                loginMutation.reset()
                              }}
                              className="w-full rounded-lg border border-[#253d37]/15 bg-[#fffaf0] px-4 py-2.5 text-sm outline-none transition focus:border-[#155b58] focus:ring-2 focus:ring-[#155b58]/20"
                            >
                              <option value="" disabled>
                                — اختر المعلم —
                              </option>
                              {teachers.map((teacher) => (
                                <option key={teacher.id} value={teacher.id}>
                                  {teacher.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      ) : (
                        <>
                          {platformToken && (
                            <div className="space-y-2">
                              <button
                                type="button"
                                disabled={platformLoginMutation.isPending}
                                onClick={() => attemptPlatformLogin({ accessToken: platformToken, code })}
                                className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#155b58] bg-[#fffaf0] px-4 py-2.5 text-sm font-bold text-[#155b58] transition hover:bg-[#155b58]/10 disabled:opacity-50"
                              >
                                <Link2 className="h-4 w-4" /> دخول الإدارة بحساب نمذجة المرتبط
                              </button>
                              {platformLoginMutation.data?.status === 'not_linked' && platformLoginMutation.variables?.code === code && (
                                <p className="text-xs text-[#253d37]/65">هذا الحساب غير مرتبط بالمدرسة المحددة. استخدم كلمة مرور الإدارة.</p>
                              )}
                              <p className="text-center text-xs text-[#253d37]/50">أو بكلمة مرور المدرسة</p>
                            </div>
                          )}
                          <div>
                          <label htmlFor="admin-password" className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
                            <KeyRound className="h-4 w-4 text-[#155b58]" />
                            كلمة المرور الإدارية
                          </label>
                          <input
                            id="admin-password"
                            type="password"
                            autoComplete="current-password"
                            value={adminPassword}
                            onChange={(e) => {
                              setAdminPassword(e.target.value)
                              setFormError(null)
                              loginMutation.reset()
                            }}
                            placeholder="••••••••"
                            className="w-full rounded-lg border border-[#253d37]/15 bg-[#fffaf0] px-4 py-2.5 text-sm outline-none transition focus:border-[#155b58] focus:ring-2 focus:ring-[#155b58]/20"
                          />
                          </div>
                        </>
                      )}

                      {loginError && (
                        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700" role="alert">
                          {loginError}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={!canSubmitLogin}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#155b58] px-4 py-3 text-sm font-bold text-[#fffaf0] transition hover:bg-[#155b58]/90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loginMutation.isPending ? (
                          <>
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                            جارٍ تسجيل الدخول…
                          </>
                        ) : (
                          <>
                            <LogIn className="h-4 w-4" />
                            دخول
                          </>
                        )}
                      </button>
                    </>
                  )}
                </>
              )}
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-5">
              <div>
                <label htmlFor="school-name" className="mb-1.5 block text-sm font-semibold">
                  اسم المدرسة
                </label>
                <input
                  id="school-name"
                  type="text"
                  value={schoolName}
                  onChange={(e) => {
                    setSchoolName(e.target.value)
                    setRegisterError(null)
                    registerMutation.reset()
                  }}
                  placeholder="مثال: مدرسة النور الابتدائية"
                  maxLength={160}
                  className="w-full rounded-lg border border-[#253d37]/15 bg-[#fffaf0] px-4 py-2.5 text-sm outline-none transition focus:border-[#155b58] focus:ring-2 focus:ring-[#155b58]/20"
                />
              </div>

              <div>
                <label htmlFor="school-password" className="mb-1.5 block text-sm font-semibold">
                  كلمة المرور الإدارية
                </label>
                <input
                  id="school-password"
                  type="password"
                  autoComplete="new-password"
                  value={schoolPassword}
                  onChange={(e) => {
                    setSchoolPassword(e.target.value)
                    setRegisterError(null)
                    registerMutation.reset()
                  }}
                  placeholder="8 أحرف على الأقل"
                  maxLength={128}
                  className="w-full rounded-lg border border-[#253d37]/15 bg-[#fffaf0] px-4 py-2.5 text-sm outline-none transition focus:border-[#155b58] focus:ring-2 focus:ring-[#155b58]/20"
                />
                {passwordTooShort && (
                  <p className="mt-1.5 text-xs text-red-600">
                    كلمة المرور يجب ألا تقل عن 8 أحرف.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="school-password-confirm" className="mb-1.5 block text-sm font-semibold">
                  تأكيد كلمة المرور
                </label>
                <input
                  id="school-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={schoolPasswordConfirm}
                  onChange={(e) => {
                    setSchoolPasswordConfirm(e.target.value)
                    setRegisterError(null)
                    registerMutation.reset()
                  }}
                  placeholder="أعد إدخال كلمة المرور"
                  maxLength={128}
                  className="w-full rounded-lg border border-[#253d37]/15 bg-[#fffaf0] px-4 py-2.5 text-sm outline-none transition focus:border-[#155b58] focus:ring-2 focus:ring-[#155b58]/20"
                />
                {passwordsMismatch && (
                  <p className="mt-1.5 text-xs text-red-600">كلمة المرور غير متطابقة.</p>
                )}
              </div>

              {registerErrorMessage && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700" role="alert">
                  {registerErrorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={!canSubmitRegister}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#155b58] px-4 py-3 text-sm font-bold text-[#fffaf0] transition hover:bg-[#155b58]/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {registerMutation.isPending ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    جارٍ إنشاء المدرسة…
                  </>
                ) : (
                  <>
                    <Building2 className="h-4 w-4" />
                    إنشاء المدرسة
                  </>
                )}
              </button>

              <p className="text-center text-xs leading-relaxed text-[#253d37]/60">
                {platformToken
                  ? 'ستُربط المدرسة الجديدة بحساب نمذجة المتصل، وستحصل أيضًا على كود مدرسة من 6 أرقام وكلمة مرور إدارة بديلة.'
                  : 'بعد الإنشاء ستحصل على كود مدرسة من 6 أرقام تشاركه مع المعلمين لتسجيل الدخول.'}
              </p>
            </form>
          )}
          </div>
        </section>
      </main>
      <footer className="auth-footer">
        <span>الخطط الأسبوعية الذكية - نمذجة التعلم</span>
        <a href="https://www.namthaja.app/" target="_blank" rel="noreferrer">namthaja.app</a>
      </footer>
    </div>
  )
}
