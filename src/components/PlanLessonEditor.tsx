import { useMemo, useState } from 'react'
import { Check, LoaderCircle, RotateCcw, X } from 'lucide-react'
import { trpc } from '@/providers/trpc'
import type { SchoolBootstrap, WeeklyPlanEntry } from '@contracts/lessonPlans'

export type PlanLessonEditorProps = {
  token: string
  week: number
  data: SchoolBootstrap
  classId: string
  subjectId: string
  entry: WeeklyPlanEntry | undefined
  onPlanChange: (entries: WeeklyPlanEntry[]) => void
  onClose: () => void
}

export default function PlanLessonEditor({
  token,
  week,
  data,
  classId,
  subjectId,
  entry,
  onPlanChange,
  onClose,
}: PlanLessonEditorProps) {
  const utils = trpc.useUtils()
  const curriculumQuery = trpc.lessonPlans.curriculum.useQuery(
    { token, subjectId },
    { enabled: Boolean(entry), retry: 1 },
  )
  const [title, setTitle] = useState(entry?.title ?? '')
  const [objectives, setObjectives] = useState<string[]>(() => {
    const values = entry?.objectives ?? entry?.defaultObjectives ?? []
    return [values[0] ?? '', values[1] ?? '', values[2] ?? '']
  })
  const [homework, setHomework] = useState(entry?.homework ?? entry?.defaultHomework ?? '')
  const [message, setMessage] = useState('')
  const subject = data.subjects.find((item) => item.id === subjectId)
  const schoolClass = data.classes.find((item) => item.id === classId)
  const lessons = useMemo(
    () => [...(curriculumQuery.data ?? [])].sort((a, b) =>
      (a.week ?? Number.MAX_SAFE_INTEGER) - (b.week ?? Number.MAX_SAFE_INTEGER)
      || a.sequence - b.sequence
      || a.title.localeCompare(b.title, 'ar')),
    [curriculumQuery.data],
  )

  const updatePlan = (entries: WeeklyPlanEntry[]) => {
    onPlanChange(entries)
    utils.lessonPlans.plan.setData({ token, week }, entries)
  }

  const setLesson = trpc.lessonPlans.setPlanLesson.useMutation({
    onSuccess: (entries) => {
      updatePlan(entries)
      const updated = entries.find((item) => item.classId === classId && item.subjectId === subjectId)
      setTitle(updated?.title ?? '')
      const values = updated?.objectives ?? updated?.defaultObjectives ?? []
      setObjectives([values[0] ?? '', values[1] ?? '', values[2] ?? ''])
      setHomework(updated?.homework ?? updated?.defaultHomework ?? '')
      setMessage('تم تغيير الدرس وتحديث الأهداف والواجب تلقائيًا.')
    },
  })

  const save = trpc.lessonPlans.updatePlan.useMutation({
    onSuccess: (entries) => {
      updatePlan(entries)
      onClose()
    },
  })

  const reset = () => {
    if (!entry) return
    setLesson.mutate({ token, classId, subjectId, week, lessonId: entry.lessonId })
  }

  const busy = setLesson.isPending || save.isPending
  const error = setLesson.error?.message || save.error?.message || curriculumQuery.error?.message

  if (!entry) {
    return (
      <aside className="lesson-editor empty-editor">
        <button type="button" className="icon-button" onClick={onClose} aria-label="إغلاق"><X size={18} /></button>
        <p>وزّع خطة هذا الأسبوع على الفصل والمادة أولًا، ثم عدّل الدرس من هنا.</p>
      </aside>
    )
  }

  return (
    <aside className="lesson-editor" aria-label="محرر الدرس">
      <div className="lesson-editor-heading">
        <div>
          <span>تحرير الخطة</span>
          <h3>{subject?.name} · {schoolClass?.name}</h3>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="إغلاق المحرر"><X size={20} /></button>
      </div>

      <label className="field-label">
        <span>عنوان الدرس — اختر من توزيع المنهج</span>
        <select
          value={entry.lessonId ?? ''}
          disabled={busy || curriculumQuery.isLoading}
          onChange={(event) => setLesson.mutate({
            token,
            classId,
            subjectId,
            week,
            lessonId: event.target.value || null,
          })}
        >
          <option value="">بدون درس مرتبط</option>
          {lessons.map((lesson) => (
            <option value={lesson.id} key={lesson.id}>
              {lesson.week === null ? 'دون أسبوع محدد' : `الأسبوع ${lesson.week}`} — {lesson.title}
            </option>
          ))}
        </select>
      </label>
      {curriculumQuery.isLoading && <p className="inline-status"><LoaderCircle className="spin" size={16} /> جارٍ تحميل دروس المادة…</p>}
      {!curriculumQuery.isLoading && lessons.length === 0 && (
        <p className="inline-status">لا توجد دروس مستوردة لهذه المادة بعد؛ يمكنك كتابة الخطة يدويًا.</p>
      )}

      <label className="field-label">
        <span>عنوان الدرس المعروض</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={1000} />
      </label>

      <fieldset className="objectives-fields">
        <legend>أهداف الدرس <small>ثلاثة أهداف كحد أقصى</small></legend>
        {objectives.map((objective, index) => (
          <label key={index}>
            <span>{index + 1}</span>
            <textarea
              value={objective}
              onChange={(event) => setObjectives((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
              rows={2}
              maxLength={1000}
            />
          </label>
        ))}
      </fieldset>

      <label className="field-label">
        <span>الواجب</span>
        <textarea value={homework} onChange={(event) => setHomework(event.target.value)} rows={3} maxLength={4000} />
      </label>

      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      <p className="inline-status">تُحفظ التعديلات في خطة المدرسة فقط، ولا تغيّر بيانات المنهج العام.</p>
      <div className="editor-actions">
        <button
          type="button"
          className="primary-button"
          disabled={busy}
          onClick={() => save.mutate({
            token,
            classId,
            subjectId,
            week,
            patch: {
              title,
              objectives: objectives.map((item) => item.trim()).filter(Boolean).slice(0, 3),
              homework,
            },
          })}
        >
          {save.isPending ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}
          حفظ التعديلات
        </button>
        <button type="button" className="secondary-button" onClick={reset} disabled={busy || !entry.lessonId}>
          <RotateCcw size={17} /> استعادة بيانات الدرس
        </button>
      </div>
    </aside>
  )
}
