import { forwardRef } from 'react'
import type {
  SchoolBootstrap,
  SchoolClass,
  SchoolTeacher,
  WeeklyPlanEntry,
} from '@contracts/lessonPlans'
import { days, planWeeks } from '@/data/weeklyPlan'
import { getVisiblePlanPeriods } from '@/lib/planTable'
import PlatformBrand from './PlatformBrand'
import '../plan-options.css'

export type PrintablePlanProps = {
  data: SchoolBootstrap
  entries: WeeklyPlanEntry[]
  week: number
  view: 'class' | 'teacher'
  target: SchoolClass | SchoolTeacher
  interactive?: boolean
  showTeacherName?: boolean
  onEdit?: (classId: string, subjectId: string) => void
}

function planFor(entries: WeeklyPlanEntry[], classId: string, subjectId: string) {
  return entries.find((entry) => entry.classId === classId && entry.subjectId === subjectId)
}

const PrintablePlan = forwardRef<HTMLElement, PrintablePlanProps>(function PrintablePlan(
  { data, entries, week, view, target, interactive = false, showTeacherName = true, onEdit },
  ref,
) {
  const weekInfo = planWeeks.find((item) => item.number === week)
  const targetClass = view === 'class' ? target as SchoolClass : null
  const targetTeacher = view === 'teacher' ? target as SchoolTeacher : null
  const slots = data.lessons.filter((lesson) =>
    targetClass
      ? lesson.classId === targetClass.id
      : data.assignments.some((assignment) =>
        assignment.teacherId === targetTeacher?.id
        && assignment.classId === lesson.classId
        && assignment.subjectId === lesson.subjectId
      ),
  )
  const visiblePeriods = getVisiblePlanPeriods(slots)

  return (
    <section className="plan-sheet" ref={ref} dir="rtl" aria-label={`خطة ${target.name} للأسبوع ${week}`}>
      <header className="plan-sheet-header">
        <div>
          <span className="plan-sheet-kicker">خطة تعلم أسبوعية</span>
          <h2>{data.school.name}</h2>
        </div>
        <div className="plan-sheet-meta">
          <strong>{view === 'class' ? `الفصل: ${target.name}` : `المعلم: ${target.name}`}</strong>
          <span>الأسبوع {week} · {weekInfo?.dates ?? ''}</span>
        </div>
        <div className="plan-sheet-platform"><PlatformBrand linked={false} compact /></div>
      </header>
      <div className="plan-grid-wrap">
        <table className="plan-grid">
          <thead>
            <tr>
              <th className="period-heading">الحصة</th>
              {days.map((day) => <th key={day}>{day}</th>)}
            </tr>
          </thead>
          <tbody>
            {visiblePeriods.map((period) => (
              <tr key={period}>
                <th className="period-cell">{period}</th>
                {days.map((_, day) => {
                  const slot = slots.find((lesson) => lesson.day === day && lesson.period === period)
                  if (!slot) return <td className="empty-slot" key={day}>—</td>
                  const subject = data.subjects.find((item) => item.id === slot.subjectId)
                  const className = data.classes.find((item) => item.id === slot.classId)?.name ?? ''
                  const teacher = data.teachers.find((item) => item.id === slot.teacherId)?.name ?? ''
                  const entry = planFor(entries, slot.classId, slot.subjectId)
                  const objectives = entry?.objectives ?? entry?.defaultObjectives ?? []
                  const homework = entry?.homework ?? entry?.defaultHomework ?? ''
                  const content = (
                    <>
                      <span className="slot-topline">
                        <strong>{subject?.name ?? 'مادة'}</strong>
                        {view === 'class'
                          ? showTeacherName && teacher ? <small className="slot-teacher-name">{teacher}</small> : null
                          : <small>{className}</small>}
                      </span>
                      {entry ? (
                        <span className="slot-lesson">
                          <b>{entry.title || 'لم يحدد عنوان الدرس'}</b>
                          {objectives.length > 0 && (
                            <span className="slot-objectives">
                              {objectives.slice(0, 3).map((objective, index) => (
                                <span key={index}>• {objective}</span>
                              ))}
                            </span>
                          )}
                          {homework && <span className="slot-homework"><b>الواجب:</b> {homework}</span>}
                        </span>
                      ) : (
                        <span className="slot-undistributed">لم تُوزّع الخطة</span>
                      )}
                    </>
                  )
                  return (
                    <td key={day} className={entry ? 'filled-slot' : ''}>
                      {interactive ? (
                        <button type="button" className="slot-button" onClick={() => onEdit?.(slot.classId, slot.subjectId)}>
                          {content}
                        </button>
                      ) : content}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="plan-sheet-footer">
        <span>تُعدّ الأهداف والواجبات وفق الخطة المعتمدة، ويمكن تحريرها بحسب مستوى الطلاب.</span>
        <span>الخطط الأسبوعية الذكية - نمذجة التعلم · namthaja.app</span>
      </footer>
    </section>
  )
})

export default PrintablePlan
