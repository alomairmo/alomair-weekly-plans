import { useMemo, useState } from 'react'
import {
  CalendarDays,
  GraduationCap,
  LayoutGrid,
  NotebookTabs,
  Printer,
  UserRound,
} from 'lucide-react'
import '@fontsource/tajawal/400.css'
import '@fontsource/tajawal/500.css'
import '@fontsource/tajawal/700.css'
import '@fontsource/tajawal/800.css'
import rawSchedule from './data/schedule.json'
import { getInitialWeek, planWeeks } from './data/weeklyPlan'
import WeeklyPlan from './components/WeeklyPlan'
import './App.css'

type ViewMode = 'all' | 'class' | 'teacher' | 'plan'
type PlanScope = 'class' | 'teacher'

type Lesson = {
  teacherId: number
  classId: string
  day: number
  period: number
  subject: string
}

type Teacher = { id: number; name: string; load: number }
type SchoolClass = { id: string; name: string }

type ScheduleData = {
  school: string
  title: string
  term: string
  days: string[]
  periods: number[]
  teachers: Teacher[]
  classes: SchoolClass[]
  lessons: Lesson[]
}

const schedule = rawSchedule as ScheduleData
const arabicDigits = '٠١٢٣٤٥٦٧٨٩'
const toArabicNumber = (value: number) =>
  String(value).replace(/\d/g, (digit) => arabicDigits[Number(digit)])

function LessonDetails({
  lesson,
  context,
}: {
  lesson: Lesson
  context: 'class' | 'teacher' | 'all'
}) {
  const teacher = schedule.teachers[lesson.teacherId]
  const schoolClass = schedule.classes.find((item) => item.id === lesson.classId)

  return (
    <>
      <strong className="lesson-subject">{lesson.subject}</strong>
      {context === 'teacher' && (
        <span className="lesson-class">{lesson.classId}</span>
      )}
      {context === 'class' && (
        <span className="lesson-secondary">{teacher.name}</span>
      )}
      {context === 'all' && (
        <>
          <span className="lesson-class">{lesson.classId}</span>
          <span className="lesson-secondary">{teacher.name}</span>
        </>
      )}
      {context === 'teacher' && schoolClass && (
        <span className="lesson-secondary">{schoolClass.name}</span>
      )}
    </>
  )
}

function PeriodList({
  lessons,
  day,
  context,
}: {
  lessons: Lesson[]
  day: number
  context: 'class' | 'teacher' | 'all'
}) {
  return (
    <ol className="period-list" aria-label={`حصص يوم ${schedule.days[day]}`}>
      {schedule.periods.map((period) => {
        const lesson = lessons.find(
          (item) => item.day === day && item.period === period,
        )
        return (
          <li className={lesson ? 'period-row' : 'period-row is-empty'} key={period}>
            <div className="period-number">
              <span>الحصة</span>
              <strong>{toArabicNumber(period)}</strong>
            </div>
            {lesson ? (
              <div className="period-lesson">
                <LessonDetails lesson={lesson} context={context} />
              </div>
            ) : (
              <span className="empty-label">لا توجد حصة</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

function WeeklySchedule({
  lessons,
  context,
}: {
  lessons: Lesson[]
  context: 'class' | 'teacher'
}) {
  return (
    <>
      <div className="weekly-desktop table-scroll">
        <table className="weekly-table">
          <caption className="sr-only">الجدول الأسبوعي للحصص السبع</caption>
          <thead>
            <tr>
              <th scope="col" className="day-heading">اليوم</th>
              {schedule.periods.map((period) => (
                <th scope="col" key={period}>
                  <span>الحصة</span>
                  <strong>{toArabicNumber(period)}</strong>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schedule.days.map((day, dayIndex) => (
              <tr key={day}>
                <th scope="row" className="day-cell">{day}</th>
                {schedule.periods.map((period) => {
                  const lesson = lessons.find(
                    (item) => item.day === dayIndex && item.period === period,
                  )
                  return (
                    <td className={lesson ? 'weekly-lesson' : 'weekly-lesson is-empty'} key={period}>
                      {lesson ? (
                        <LessonDetails lesson={lesson} context={context} />
                      ) : (
                        <span aria-label="لا توجد حصة">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="weekly-mobile">
        {schedule.days.map((day, dayIndex) => {
          const dayLoad = lessons.filter((lesson) => lesson.day === dayIndex).length
          return (
            <section className="mobile-day" key={day} aria-labelledby={`day-${context}-${dayIndex}`}>
              <div className="mobile-day-heading">
                <h3 id={`day-${context}-${dayIndex}`}>{day}</h3>
                <span>{toArabicNumber(dayLoad)} حصص</span>
              </div>
              <PeriodList lessons={lessons} day={dayIndex} context={context} />
            </section>
          )
        })}
      </div>
    </>
  )
}

function MasterTable() {
  return (
    <div className="master-desktop table-scroll">
      <table className="master-table">
        <caption className="sr-only">الجدول العام لجميع المعلمين، خمسة أيام وسبع حصص يوميًا</caption>
        <thead>
          <tr className="master-days">
            <th scope="col" rowSpan={2} className="teacher-column">المعلم</th>
            {schedule.days.map((day) => (
              <th scope="colgroup" colSpan={7} key={day}>{day}</th>
            ))}
            <th scope="col" rowSpan={2} className="load-column">مجموع<br />الحصص</th>
          </tr>
          <tr className="master-periods">
            {schedule.days.map((day) =>
              schedule.periods.map((period) => (
                <th scope="col" key={`${day}-${period}`}>{toArabicNumber(period)}</th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {schedule.teachers.map((teacher) => (
            <tr key={teacher.id}>
              <th scope="row" className="teacher-column">{teacher.name}</th>
              {schedule.days.map((_, dayIndex) =>
                schedule.periods.map((period) => {
                  const lesson = schedule.lessons.find(
                    (item) =>
                      item.teacherId === teacher.id &&
                      item.day === dayIndex &&
                      item.period === period,
                  )
                  return (
                    <td className={lesson ? 'master-lesson' : 'master-lesson is-empty'} key={`${dayIndex}-${period}`}>
                      {lesson ? (
                        <>
                          <strong>{lesson.classId}</strong>
                          <span>{lesson.subject}</span>
                        </>
                      ) : (
                        <span aria-label="لا توجد حصة">—</span>
                      )}
                    </td>
                  )
                }),
              )}
              <td className="load-column"><strong>{toArabicNumber(teacher.load)}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MobileMaster({ lessons }: { lessons: Lesson[] }) {
  const [selectedDay, setSelectedDay] = useState(0)

  return (
    <div className="master-mobile">
      <div className="day-tabs" role="group" aria-label="اختر يوم عرض الجدول العام">
        {schedule.days.map((day, index) => (
          <button
            type="button"
            className={selectedDay === index ? 'day-tab is-active' : 'day-tab'}
            aria-pressed={selectedDay === index}
            onClick={() => setSelectedDay(index)}
            key={day}
          >
            {day}
          </button>
        ))}
      </div>
      <p className="mobile-hint">اختر اليوم، ثم افتح اسم المعلم لعرض حصصه السبع.</p>
      <div className="teacher-accordion">
        {schedule.teachers.map((teacher, index) => {
          const teacherLessons = lessons.filter((lesson) => lesson.teacherId === teacher.id)
          return (
            <details key={teacher.id} open={index === 0}>
              <summary>
                <span>{teacher.name}</span>
                <small>{toArabicNumber(teacher.load)} حصة أسبوعيًا</small>
              </summary>
              <PeriodList lessons={teacherLessons} day={selectedDay} context="teacher" />
            </details>
          )
        })}
      </div>
    </div>
  )
}

function App() {
  const [view, setView] = useState<ViewMode>('all')
  const [selectedClass, setSelectedClass] = useState(schedule.classes[0].id)
  const [selectedTeacher, setSelectedTeacher] = useState(schedule.teachers[0].id)
  const [selectedWeek, setSelectedWeek] = useState(getInitialWeek)
  const [planScope, setPlanScope] = useState<PlanScope>('class')

  const currentClass = schedule.classes.find((item) => item.id === selectedClass)!
  const currentTeacher = schedule.teachers.find((item) => item.id === selectedTeacher)!

  const classLessons = useMemo(
    () => schedule.lessons.filter((lesson) => lesson.classId === selectedClass),
    [selectedClass],
  )
  const teacherLessons = useMemo(
    () => schedule.lessons.filter((lesson) => lesson.teacherId === selectedTeacher),
    [selectedTeacher],
  )

  const planSubjectCount = useMemo(
    () => new Set(classLessons.map((lesson) => lesson.subject)).size,
    [classLessons],
  )
  const planTeacherSubjectCount = useMemo(
    () => new Set(teacherLessons.map((lesson) => `${lesson.classId}|${lesson.subject}`)).size,
    [teacherLessons],
  )

  const title = view === 'all'
    ? schedule.title
    : view === 'class'
      ? currentClass.name
      : view === 'teacher'
        ? `الجدول الأسبوعي — ${currentTeacher.name}`
        : planScope === 'class'
          ? `الخطة الأسبوعية — ${currentClass.name}`
          : `خطة المعلم الأسبوعية — ${currentTeacher.name}`
  const subtitle = view === 'all'
    ? 'جميع المعلمين والفصول في جدول واحد'
    : view === 'class'
      ? `${currentClass.id} · المواد والمعلمون للحصص السبع في كل يوم`
      : view === 'teacher'
        ? 'الفصول والمواد للحصص السبع في كل يوم'
        : `${planScope === 'class' ? currentClass.id : 'الفصول والمواد التي يدرّسها'} · الأسبوع ${toArabicNumber(selectedWeek)} · ${planWeeks[selectedWeek - 1].dates}`
  const currentLoad = view === 'class'
    ? classLessons.length
    : view === 'teacher'
      ? teacherLessons.length
      : view === 'plan'
        ? planScope === 'class' ? planSubjectCount : planTeacherSubjectCount
        : schedule.lessons.length

  return (
    <div className="app-shell" dir="rtl">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">ع</span>
          <div>
            <p>{schedule.school}</p>
            <span>{schedule.term}</span>
          </div>
        </div>
        <button type="button" className="print-button" onClick={() => window.print()}>
          <Printer size={18} strokeWidth={1.8} aria-hidden="true" />
          <span>{view === 'plan' ? 'طباعة الخطة' : 'طباعة الجدول'}</span>
        </button>
      </header>

      <div className="workspace">
        <aside className="controls" aria-label="خيارات عرض الجدول">
          <div className="view-controls">
            <span className="control-label">طريقة العرض</span>
            <div className="view-switch" role="group" aria-label="طريقة عرض الجدول">
              <button
                type="button"
                className={view === 'all' ? 'view-button is-active' : 'view-button'}
                aria-pressed={view === 'all'}
                onClick={() => setView('all')}
              >
                <LayoutGrid size={19} aria-hidden="true" />
                <span>كامل الجدول</span>
              </button>
              <button
                type="button"
                className={view === 'class' ? 'view-button is-active' : 'view-button'}
                aria-pressed={view === 'class'}
                onClick={() => setView('class')}
              >
                <GraduationCap size={19} aria-hidden="true" />
                <span>حسب الفصل</span>
              </button>
              <button
                type="button"
                className={view === 'teacher' ? 'view-button is-active' : 'view-button'}
                aria-pressed={view === 'teacher'}
                onClick={() => setView('teacher')}
              >
                <UserRound size={19} aria-hidden="true" />
                <span>حسب المعلم</span>
              </button>
              <button
                type="button"
                className={view === 'plan' ? 'view-button is-active' : 'view-button'}
                aria-pressed={view === 'plan'}
                onClick={() => setView('plan')}
              >
                <NotebookTabs size={19} aria-hidden="true" />
                <span>الخطة الأسبوعية للفصول</span>
              </button>
            </div>
          </div>

          {view === 'plan' && (
            <div className="plan-scope-control">
              <span className="control-label">فتح الخطة بحسب</span>
              <div className="plan-scope-switch" role="group" aria-label="فتح الخطة الأسبوعية بحسب الفصل أو المعلم">
                <button
                  type="button"
                  className={planScope === 'class' ? 'is-active' : ''}
                  aria-pressed={planScope === 'class'}
                  onClick={() => setPlanScope('class')}
                >
                  <GraduationCap size={18} aria-hidden="true" />
                  <span>الفصل</span>
                </button>
                <button
                  type="button"
                  className={planScope === 'teacher' ? 'is-active' : ''}
                  aria-pressed={planScope === 'teacher'}
                  onClick={() => setPlanScope('teacher')}
                >
                  <UserRound size={18} aria-hidden="true" />
                  <span>المعلم</span>
                </button>
              </div>
            </div>
          )}

          {(view === 'class' || (view === 'plan' && planScope === 'class')) && (
            <label className="select-field">
              <span>اختر الفصل</span>
              <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>
                {schedule.classes.map((schoolClass) => (
                  <option value={schoolClass.id} key={schoolClass.id}>
                    {schoolClass.name} — {schoolClass.id}
                  </option>
                ))}
              </select>
            </label>
          )}

          {(view === 'teacher' || (view === 'plan' && planScope === 'teacher')) && (
            <label className="select-field">
              <span>اختر المعلم</span>
              <select value={selectedTeacher} onChange={(event) => setSelectedTeacher(Number(event.target.value))}>
                {schedule.teachers.map((teacher) => (
                  <option value={teacher.id} key={teacher.id}>
                    {teacher.name} — {toArabicNumber(teacher.load)} حصة
                  </option>
                ))}
              </select>
            </label>
          )}

          {view === 'plan' && (
            <label className="select-field">
              <span>اختر الأسبوع</span>
              <select value={selectedWeek} onChange={(event) => setSelectedWeek(Number(event.target.value))}>
                {planWeeks.map((week) => (
                  <option value={week.number} key={week.number}>
                    الأسبوع {toArabicNumber(week.number)} — {week.dates}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="schedule-facts" aria-label="ملخص الجدول">
            <div><strong>{toArabicNumber(schedule.teachers.length)}</strong><span>معلمًا</span></div>
            <div><strong>{toArabicNumber(schedule.classes.length)}</strong><span>فصول</span></div>
            <div><strong>{toArabicNumber(schedule.lessons.length)}</strong><span>حصة</span></div>
          </div>
          <p className="source-note">
            {view === 'plan' ? (
              <>١٦ أسبوعًا دراسيًا<br />دروس وواجبات استرشادية قابلة للتعديل</>
            ) : (
              <>مطابق للجدول الأسبوعي الأصلي<br />٥ أيام · ٧ حصص يوميًا</>
            )}
          </p>
        </aside>

        <main className="schedule-main">
          <div className="schedule-heading">
            <div>
              <div className="schedule-kicker">
                <CalendarDays size={17} aria-hidden="true" />
                <span>{view === 'plan' ? 'الخطة الدراسية' : 'الجدول الأسبوعي'}</span>
              </div>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
            <div className="load-summary">
              <strong>{toArabicNumber(currentLoad)}</strong>
              <span>{view === 'all' ? 'حصة مجدولة' : view === 'plan' ? planScope === 'class' ? 'مادة هذا الأسبوع' : 'مادة بحسب الفصول' : 'حصة أسبوعيًا'}</span>
            </div>
          </div>

          <div className="schedule-content" key={`${view}-${planScope}-${selectedClass}-${selectedTeacher}-${selectedWeek}`}>
            {view === 'all' && (
              <>
                <MasterTable />
                <MobileMaster lessons={schedule.lessons} />
              </>
            )}
            {view === 'class' && <WeeklySchedule lessons={classLessons} context="class" />}
            {view === 'teacher' && <WeeklySchedule lessons={teacherLessons} context="teacher" />}
            {view === 'plan' && (
              <WeeklyPlan
                classId={selectedClass}
                className={currentClass.name}
                classes={schedule.classes}
                week={selectedWeek}
                lessons={schedule.lessons}
                teachers={schedule.teachers}
                teacherId={planScope === 'teacher' ? selectedTeacher : undefined}
                teacherName={planScope === 'teacher' ? currentTeacher.name : undefined}
                onWeekChange={setSelectedWeek}
                toArabicNumber={toArabicNumber}
              />
            )}
          </div>

          <footer className="schedule-footer">
            <span>مجمع العماير</span>
            <span>الفصل الأول ١٤٤٨هـ</span>
          </footer>
        </main>
      </div>
    </div>
  )
}

export default App
