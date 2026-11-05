import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  Save,
} from 'lucide-react'
import { trpc } from '@/providers/trpc'
import type {
  ScheduleLesson,
  ScheduleSubject,
  Teacher,
} from '@contracts/types'

type ScheduleEditorProps = {
  classId: string
  lessons: ScheduleLesson[]
  subjects: ScheduleSubject[]
  teachers: Teacher[]
  days: string[]
  periods: number[]
  toArabicNumber: (value: number) => string
}

export default function ScheduleEditor({
  classId,
  lessons,
  subjects,
  teachers,
  days,
  periods,
  toArabicNumber,
}: ScheduleEditorProps) {
  const classLessons = useMemo(
    () => lessons.filter((lesson) => lesson.classId === classId),
    [classId, lessons],
  )
  const classSubjects = useMemo(
    () => subjects
      .filter((subject) => subject.classId === classId)
      .sort((a, b) => a.sortOrder - b.sortOrder),
    [classId, subjects],
  )
  const [draftLessons, setDraftLessons] = useState<ScheduleLesson[]>(classLessons)
  const [draftSubjects, setDraftSubjects] = useState<ScheduleSubject[]>(classSubjects)
  const [message, setMessage] = useState('التعديلات هنا مشتركة، وتظهر في الجدول والخطة بعد حفظها.')
  const [isError, setIsError] = useState(false)
  const utils = trpc.useUtils()

  useEffect(() => {
    setDraftLessons(classLessons)
    setDraftSubjects(classSubjects)
  }, [classId, classLessons, classSubjects])

  const invalidateSchedule = async () => {
    await utils.schedule.get.invalidate()
  }

  const saveLessons = trpc.schedule.saveLessons.useMutation({
    onSuccess: async () => {
      setIsError(false)
      setMessage('حُفظ ترتيب الحصص وبياناتها، وظهرت التعديلات في جميع العروض.')
      await invalidateSchedule()
    },
    onError: () => {
      setIsError(true)
      setMessage('تعذر حفظ الحصص. تأكد من عدم وجود حصة أخرى للمعلم في اليوم والوقت نفسيهما.')
    },
  })

  const saveSubjects = trpc.schedule.saveSubjects.useMutation({
    onSuccess: async () => {
      setIsError(false)
      setMessage('حُفظت أسماء المواد وترتيبها، وستظهر بالترتيب الجديد في الخطة والتنزيل.')
      await invalidateSchedule()
    },
    onError: () => {
      setIsError(true)
      setMessage('تعذر حفظ المواد. تأكد من عدم تكرار اسم المادة في الفصل نفسه.')
    },
  })

  const isPending = saveLessons.isPending || saveSubjects.isPending

  function updateLesson(id: string, patch: Partial<ScheduleLesson>) {
    setDraftLessons((current) => current.map((lesson) => (
      lesson.id === id ? { ...lesson, ...patch } : lesson
    )))
  }

  function moveLesson(id: string, offset: number) {
    setDraftLessons((current) => {
      const lesson = current.find((item) => item.id === id)
      if (!lesson) return current
      const targetPeriod = lesson.period + offset
      if (targetPeriod < 1 || targetPeriod > 7) return current
      const target = current.find(
        (item) => item.day === lesson.day && item.period === targetPeriod,
      )
      return current.map((item) => {
        if (item.id === lesson.id) return { ...item, period: targetPeriod }
        if (target && item.id === target.id) return { ...item, period: lesson.period }
        return item
      })
    })
  }

  function moveSubject(index: number, offset: number) {
    setDraftSubjects((current) => {
      const targetIndex = index + offset
      if (targetIndex < 0 || targetIndex >= current.length) return current
      const next = [...current]
      const [moved] = next.splice(index, 1)
      next.splice(targetIndex, 0, moved)
      return next.map((subject, sortOrder) => ({ ...subject, sortOrder }))
    })
  }

  function submitSubjects() {
    const names = draftSubjects.map((subject) => subject.name.trim())
    if (names.some((name) => !name)) {
      setIsError(true)
      setMessage('لا يمكن حفظ مادة باسم فارغ.')
      return
    }
    if (new Set(names).size !== names.length) {
      setIsError(true)
      setMessage('لا يمكن تكرار اسم المادة في الفصل نفسه.')
      return
    }
    saveSubjects.mutate({
      classId,
      subjects: draftSubjects.map((subject, sortOrder) => ({
        subjectKey: subject.subjectKey,
        name: subject.name.trim(),
        sortOrder,
      })),
    })
  }

  function submitLessons() {
    saveLessons.mutate(draftLessons.map((lesson) => ({
      id: lesson.id,
      classId: lesson.classId,
      subjectKey: lesson.subjectKey,
      teacherId: lesson.teacherId,
      day: lesson.day,
      period: lesson.period,
      sortOrder: Math.max(0, lessons.findIndex((item) => item.id === lesson.id)),
    })))
  }

  return (
    <section className="schedule-editor" aria-label={`تحرير جدول ومواد فصل ${classId}`}>
      <div className="editor-intro">
        <div>
          <h2>تحرير الجدول والمواد</h2>
          <p>غيّر المادة أو المعلم، أو انقل الحصة إلى الحصة السابقة أو التالية. عند تبديل حصتين مشغولتين يتم تبديل موضعيهما.</p>
        </div>
      </div>

      <div className={`editor-status${isError ? ' is-error' : ''}`} role="status" aria-live="polite">
        {isPending ? <LoaderCircle className="spin" size={17} aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}
        <span>{isPending ? 'جارٍ الحفظ في قاعدة البيانات…' : message}</span>
      </div>

      <section className="subjects-editor" aria-labelledby="subjects-editor-title">
        <div className="editor-section-heading">
          <div>
            <h3 id="subjects-editor-title">المواد وترتيبها</h3>
            <p>يظهر هذا الترتيب في الخطة الأسبوعية وملفات PDF.</p>
          </div>
          <button type="button" onClick={submitSubjects} disabled={isPending}>
            {saveSubjects.isPending ? <LoaderCircle className="spin" size={17} aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}
            حفظ المواد والترتيب
          </button>
        </div>
        <div className="subject-editor-list">
          {draftSubjects.map((subject, index) => (
            <div className="subject-editor-row" key={subject.subjectKey}>
              <span className="subject-order">{toArabicNumber(index + 1)}</span>
              <label>
                <span className="sr-only">اسم المادة {toArabicNumber(index + 1)}</span>
                <input
                  type="text"
                  value={subject.name}
                  maxLength={100}
                  onChange={(event) => setDraftSubjects((current) => current.map((item) => (
                    item.subjectKey === subject.subjectKey
                      ? { ...item, name: event.target.value }
                      : item
                  )))}
                  disabled={isPending}
                />
              </label>
              <div className="subject-move-actions">
                <button
                  type="button"
                  onClick={() => moveSubject(index, -1)}
                  disabled={isPending || index === 0}
                  aria-label={`تقديم مادة ${subject.name}`}
                >
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => moveSubject(index, 1)}
                  disabled={isPending || index === draftSubjects.length - 1}
                  aria-label={`تأخير مادة ${subject.name}`}
                >
                  <ArrowLeft size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="lessons-editor" aria-labelledby="lessons-editor-title">
        <div className="editor-section-heading">
          <div>
            <h3 id="lessons-editor-title">الحصص الأسبوعية</h3>
            <p>تحقق من المعلم قبل الحفظ؛ تمنع قاعدة البيانات تعارض مواعيد المعلم.</p>
          </div>
          <button type="button" onClick={submitLessons} disabled={isPending}>
            {saveLessons.isPending ? <LoaderCircle className="spin" size={17} aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}
            حفظ تغييرات الحصص
          </button>
        </div>

        <div className="lesson-editor-days">
          {days.map((day, dayIndex) => (
            <section className="lesson-editor-day" key={day} aria-label={`حصص يوم ${day}`}>
              <h4>{day}</h4>
              {periods.map((period) => {
                const lesson = draftLessons.find(
                  (item) => item.day === dayIndex && item.period === period,
                )
                if (!lesson) {
                  return (
                    <div className="lesson-editor-row is-empty" key={period}>
                      <span className="editor-period">الحصة {toArabicNumber(period)}</span>
                      <span>لا توجد حصة</span>
                    </div>
                  )
                }
                return (
                  <div className="lesson-editor-row" key={lesson.id}>
                    <span className="editor-period">الحصة {toArabicNumber(period)}</span>
                    <div className="lesson-editor-fields">
                      <label>
                        <span>المادة</span>
                        <select
                          value={lesson.subjectKey}
                          onChange={(event) => updateLesson(lesson.id, { subjectKey: event.target.value })}
                          disabled={isPending}
                          aria-label={`مادة ${day} الحصة ${toArabicNumber(period)}`}
                        >
                          {draftSubjects.map((subject) => (
                            <option value={subject.subjectKey} key={subject.subjectKey}>
                              {subject.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>المعلم</span>
                        <select
                          value={lesson.teacherId}
                          onChange={(event) => updateLesson(lesson.id, { teacherId: Number(event.target.value) })}
                          disabled={isPending}
                          aria-label={`معلم ${day} الحصة ${toArabicNumber(period)}`}
                        >
                          {teachers.map((teacher) => (
                            <option value={teacher.id} key={teacher.id}>{teacher.name}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="lesson-move-actions">
                      <button
                        type="button"
                        onClick={() => moveLesson(lesson.id, -1)}
                        disabled={isPending || period === 1}
                        aria-label={`نقل ${lesson.subject} إلى الحصة السابقة`}
                      >
                        <ArrowRight size={17} aria-hidden="true" />
                        <span>السابقة</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => moveLesson(lesson.id, 1)}
                        disabled={isPending || period === 7}
                        aria-label={`نقل ${lesson.subject} إلى الحصة التالية`}
                      >
                        <ArrowLeft size={17} aria-hidden="true" />
                        <span>التالية</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </section>
          ))}
        </div>
      </section>
    </section>
  )
}
