import { useState } from 'react'
import { BookOpenCheck, CalendarDays, LoaderCircle, LogOut, Settings2, Share2 } from 'lucide-react'
import { trpc } from '@/providers/trpc'
import type { SchoolSession } from '@contracts/lessonPlans'
import SchoolAuth from '@/components/SchoolAuth'
import SchoolSetup from '@/components/SchoolSetup'
import SchoolSharing from '@/components/SchoolSharing'
import WeeklyPlans from '@/components/WeeklyPlans'
import SchoolSchedule from '@/components/SchoolSchedule'
import InstallAppPrompt from '@/components/InstallAppPrompt'
import PlatformBrand from '@/components/PlatformBrand'
import './App.css'

const sessionKey = 'weekly-plans-school-session'

function savedSession(): SchoolSession | null {
  try {
    const value = localStorage.getItem(sessionKey)
    return value ? JSON.parse(value) as SchoolSession : null
  } catch {
    return null
  }
}

type AppTab = 'plans' | 'schedule' | 'setup' | 'sharing'

export default function App() {
  const utils = trpc.useUtils()
  const [session, setSession] = useState<SchoolSession | null>(savedSession)
  const [tab, setTab] = useState<AppTab>('plans')
  const bootstrap = trpc.lessonPlans.bootstrap.useQuery(
    { token: session?.token ?? '' },
    { enabled: Boolean(session), retry: 1 },
  )
  const logout = trpc.lessonPlans.logout.useMutation()

  const activeTab: AppTab = bootstrap.data?.role === 'admin' && bootstrap.data.classes.length === 0
    ? 'setup'
    : tab

  const authenticate = (nextSession: SchoolSession) => {
    localStorage.setItem(sessionKey, JSON.stringify(nextSession))
    setSession(nextSession)
    setTab('plans')
  }

  const signOut = () => {
    if (!session) return
    logout.mutate({ token: session.token }, {
      onSettled: () => {
        localStorage.removeItem(sessionKey)
        setSession(null)
      },
    })
  }

  if (!session) {
    return <><InstallAppPrompt /><SchoolAuth onAuthenticated={authenticate} /></>
  }

  return (
    <div className="app-shell" dir="rtl">
      <InstallAppPrompt />
      <header className="app-header">
        <PlatformBrand />
        <div className="tool-identity">
          <span>أداة التخطيط المدرسي</span>
          <strong>الخطط الأسبوعية الذكية - نمذجة التعلم</strong>
          <small>{bootstrap.data?.school.name ?? 'جارٍ تحميل المدرسة…'}</small>
        </div>
        <div className="account-block">
          {bootstrap.data && <span className="account-summary"><b>{session.role === 'admin' ? 'إداري' : 'معلم'}</b><small>كود المدرسة {bootstrap.data.school.code}</small></span>}
          <button type="button" onClick={signOut} disabled={logout.isPending}><LogOut size={17} /> خروج</button>
        </div>
      </header>

      <nav className="main-navigation" aria-label="أقسام التطبيق">
        <button type="button" className={activeTab === 'plans' ? 'active' : ''} onClick={() => setTab('plans')}><BookOpenCheck size={19} /> الخطط الأسبوعية</button>
        <button type="button" className={activeTab === 'schedule' ? 'active' : ''} onClick={() => setTab('schedule')}><CalendarDays size={19} /> الجدول الدراسي</button>
        {session.role === 'admin' && <button type="button" className={activeTab === 'setup' ? 'active' : ''} onClick={() => setTab('setup')}><Settings2 size={19} /> إعداد المدرسة</button>}
        {session.role === 'admin' && <button type="button" className={activeTab === 'sharing' ? 'active' : ''} onClick={() => setTab('sharing')}><Share2 size={19} /> المشاركة</button>}
      </nav>

      <main className="app-main">
        <div className="workspace-heading">
          <div>
            <span>من أدوات المعلم في نمذجة التعلّم</span>
            <h1>{activeTab === 'plans' ? 'الخطط الأسبوعية' : activeTab === 'schedule' ? 'الجدول الدراسي' : activeTab === 'sharing' ? 'المشاركة' : 'إعداد المدرسة'}</h1>
            <p>{activeTab === 'plans'
              ? 'وزّع الدروس والأهداف والواجبات، ثم راجع الخطة وصدّرها بوضوح.'
              : activeTab === 'schedule'
                ? 'عرض الحصص كاملة أو بحسب الفصل والمعلم، من الأحد إلى الخميس.'
                : activeTab === 'sharing'
                  ? 'إدارة حسابات الإدارة ومشاركة رابط الدخول ورسالة الخطة الأسبوعية.'
                  : 'إدارة الفصول والمواد والمعلمين والتعيينات والجدول الدراسي.'}</p>
          </div>
          <span className="workspace-heading-mark" aria-hidden="true">✦</span>
        </div>
        {bootstrap.isLoading && <div className="page-status"><LoaderCircle className="spin" /> جارٍ تحميل بيانات المدرسة والصلاحيات…</div>}
        {bootstrap.error && (
          <div className="fatal-state">
            <h1>تعذر تحميل بيانات المدرسة</h1>
            <p>{bootstrap.error.message}</p>
            <div><button type="button" className="primary-button" onClick={() => bootstrap.refetch()}>إعادة المحاولة</button><button type="button" className="secondary-button" onClick={signOut}>تسجيل الخروج</button></div>
          </div>
        )}
        {bootstrap.data && activeTab === 'plans' && <WeeklyPlans token={session.token} data={bootstrap.data} />}
        {bootstrap.data && activeTab === 'schedule' && <SchoolSchedule data={bootstrap.data} />}
        {bootstrap.data && activeTab === 'setup' && session.role === 'admin' && (
          <SchoolSetup
            token={session.token}
            data={bootstrap.data}
            onSaved={(data) => utils.lessonPlans.bootstrap.setData({ token: session.token }, data)}
          />
        )}
        {bootstrap.data && activeTab === 'sharing' && session.role === 'admin' && (
          <SchoolSharing token={session.token} data={bootstrap.data} />
        )}
      </main>
    </div>
  )
}
