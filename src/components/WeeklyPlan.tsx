import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Cloud,
  Download,
  Files,
  Info,
  LoaderCircle,
  Pencil,
  RotateCcw,
  Save,
  UserRound,
  X,
} from 'lucide-react'
import { trpc } from '@/providers/trpc'
import {
  getCurriculumLessons,
  getDefaultLessonId,
  planWeeks,
} from '@/data/weeklyPlan'

type ScheduleLesson = {
  teacherId: number
  classId: string
  subject: string
}

type Teacher = { id: number; name: string }
type SchoolClass = { id: string; name: string }

type WeeklyPlanProps = {
  classId: string
  className: string
  classes: SchoolClass[]
  week: number
  lessons: ScheduleLesson[]
  teachers: Teacher[]
  teacherId?: number
  teacherName?: string
  onWeekChange: (week: number) => void
  toArabicNumber: (value: number) => string
}

type PlanRow = {
  key: string
  classId: string
  className: string
  name: string
  periods: number
  teachers: string[]
}

type ExportMode = 'class' | 'all' | null

const overrideKey = (classId: string, subject: string) => `${classId}|${subject}`

export default function WeeklyPlan({
  classId,
  className,
  classes,
  week,
  lessons,
  teachers,
  teacherId,
  teacherName,
  onWeekChange,
  toArabicNumber,
}: WeeklyPlanProps) {
  const isTeacherView = teacherId !== undefined
  const [localEdits, setLocalEdits] = useState<Record<string, string>>({})
  const [localHomeworkEdits, setLocalHomeworkEdits] = useState<Record<string, string>>({})
  const [editingSubject, setEditingSubject] = useState<string | null>(null)
  const [homeworkDraft, setHomeworkDraft] = useState('')
  const [pendingSubject, setPendingSubject] = useState<string | null>(null)
  const [savedSubject, setSavedSubject] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [exportMode, setExportMode] = useState<ExportMode>(null)
  const [exportProgress, setExportProgress] = useState({ completed: 0, total: classes.length })
  const [exportError, setExportError] = useState<string | null>(null)
  const utils = trpc.useUtils()
  const classOverridesQuery = trpc.weeklyPlan.list.useQuery(
    { classId, week },
    { retry: 1, enabled: !isTeacherView },
  )
  const weekOverridesQuery = trpc.weeklyPlan.listWeek.useQuery(
    { week },
    { retry: 1, enabled: isTeacherView },
  )
  const overridesQuery = isTeacherView ? weekOverridesQuery : classOverridesQuery

  const invalidatePlan = async () => {
    await Promise.all([
      utils.weeklyPlan.list.invalidate(),
      utils.weeklyPlan.listWeek.invalidate(),
    ])
  }

  const setLesson = trpc.weeklyPlan.setLesson.useMutation({
    onSuccess: async (_data, variables) => {
      setSavedSubject(variables.subject)
      setSaveError(null)
      await invalidatePlan()
    },
    onError: (_error, variables) => {
      const key = overrideKey(variables.classId, variables.subject)
      setLocalEdits((current) => {
        const next = { ...current }
        delete next[key]
        return next
      })
      setSaveError(`تعذر حفظ تعديل مادة ${variables.subject}. حاول مرة أخرى.`)
    },
    onSettled: () => setPendingSubject(null),
  })

  const setHomework = trpc.weeklyPlan.setHomework.useMutation({
    onSuccess: async (_data, variables) => {
      setSavedSubject(variables.subject)
      setSaveError(null)
      setEditingSubject(null)
      await invalidatePlan()
    },
    onError: (_error, variables) => {
      const key = overrideKey(variables.classId, variables.subject)
      setLocalHomeworkEdits((current) => {
        const next = { ...current }
        delete next[key]
        return next
      })
      setSaveError(`تعذر حفظ واجب مادة ${variables.subject}. حاول مرة أخرى.`)
    },
    onSettled: () => setPendingSubject(null),
  })

  const planRows = useMemo<PlanRow[]>(() => {
    const seen = new Set<string>()
    return lessons
      .filter((lesson) => isTeacherView
        ? lesson.teacherId === teacherId
        : lesson.classId === classId)
      .filter((lesson) => {
        const key = overrideKey(lesson.classId, lesson.subject)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map((lesson) => {
        const subjectLessons = lessons.filter(
          (item) => item.classId === lesson.classId
            && item.subject === lesson.subject
            && (!isTeacherView || item.teacherId === teacherId),
        )
        const teacherIds = isTeacherView
          ? [teacherId]
          : [...new Set(subjectLessons.map((item) => item.teacherId))]
        return {
          key: overrideKey(lesson.classId, lesson.subject),
          classId: lesson.classId,
          className: classes.find((item) => item.id === lesson.classId)?.name ?? lesson.classId,
          name: lesson.subject,
          periods: subjectLessons.length,
          teachers: teacherIds.map((id) => teachers[id]?.name).filter(Boolean),
        }
      })
  }, [classId, classes, isTeacherView, lessons, teacherId, teachers])

  const savedOverrides = useMemo(
    () => Object.fromEntries(
      (overridesQuery.data ?? []).map((item) => [overrideKey(item.classId, item.subject), item]),
    ),
    [overridesQuery.data],
  )

  const currentWeek = planWeeks[week - 1]

  function changeLesson(row: PlanRow, lessonId: string) {
    setSavedSubject(null)
    setSaveError(null)
    setEditingSubject(null)
    setLocalEdits((current) => ({ ...current, [row.key]: lessonId }))
    setLocalHomeworkEdits((current) => {
      const next = { ...current }
      delete next[row.key]
      return next
    })
    setPendingSubject(row.key)
    setLesson.mutate({ classId: row.classId, subject: row.name, week, lessonId })
  }

  function startHomeworkEdit(rowKey: string, homework: string) {
    setSavedSubject(null)
    setSaveError(null)
    setEditingSubject(rowKey)
    setHomeworkDraft(homework)
  }

  function saveHomework(row: PlanRow, lessonId: string) {
    const homeworkText = homeworkDraft.trim()
    if (!homeworkText) {
      setSaveError('لا يمكن حفظ واجب فارغ. اكتب نص الواجب أولًا.')
      return
    }
    setSaveError(null)
    setSavedSubject(null)
    setLocalHomeworkEdits((current) => ({ ...current, [row.key]: homeworkText }))
    setPendingSubject(row.key)
    setHomework.mutate({
      classId: row.classId,
      subject: row.name,
      week,
      lessonId,
      homeworkText,
    })
  }

  async function exportClass() {
    setExportMode('class')
    setExportError(null)
    try {
      const [{ downloadClassPlanPdf }, overrides] = await Promise.all([
        import('@/lib/planExport'),
        utils.weeklyPlan.listWeek.fetch({ week }),
      ])
      await downloadClassPlanPdf({
        schoolClass: { id: classId, name: className },
        week,
        lessons,
        teachers,
        overrides,
      })
    } catch {
      setExportError('تعذر إنشاء ملف خطة الفصل. حاول مرة أخرى.')
    } finally {
      setExportMode(null)
    }
  }

  async function exportAllClasses() {
    setExportMode('all')
    setExportProgress({ completed: 0, total: classes.length })
    setExportError(null)
    try {
      const [{ downloadAllPlansZip }, overrides] = await Promise.all([
        import('@/lib/planExport'),
        utils.weeklyPlan.listWeek.fetch({ week }),
      ])
      await downloadAllPlansZip({
        classes,
        week,
        lessons,
        teachers,
        overrides,
        onProgress: (completed, total) => setExportProgress({ completed, total }),
      })
    } catch {
      setExportError('تعذر إنشاء الملف المضغوط. حاول مرة أخرى.')
    } finally {
      setExportMode(null)
    }
  }

  const exportDisabled = exportMode !== null || pendingSubject !== null || overridesQuery.isLoading

  return (
    <section
      className="weekly-plan"
      aria-label={isTeacherView ? `الخطة الأسبوعية للمعلم ${teacherName}` : `الخطة الأسبوعية لـ${className}`}
    >
      <div className="plan-notice">
        <Info size={19} aria-hidden="true" />
        <div>
          <strong>توزيع استرشادي قابل للتعديل</strong>
          <p>
            الدروس والواجبات مقترحة بحسب مواد الجدول ومجالات المناهج، وليست توزيعًا رسميًا صادرًا عن المدرسة.
            راجع الكتاب وتوزيع المعلم قبل الاعتماد. التعديلات تُحفظ في خطة المدرسة المشتركة.
          </p>
          <a
            href="https://www.moe.gov.sa/en/education/generaleducation/pages/academiccalendar.aspx"
            target="_blank"
            rel="noreferrer"
          >
            مرجع التقويم الدراسي — وزارة التعليم
          </a>
        </div>
      </div>

      <div className="week-navigation">
        <button
          type="button"
          onClick={() => onWeekChange(week - 1)}
          disabled={week === 1 || exportMode !== null}
          aria-label="الأسبوع السابق"
        >
          <ArrowRight size={19} aria-hidden="true" />
          <span>السابق</span>
        </button>
        <div className="week-current">
          <span>الأسبوع {toArabicNumber(week)} من {toArabicNumber(16)}</span>
          <strong>{currentWeek.dates}</strong>
          {currentWeek.note && <small>{currentWeek.note}</small>}
        </div>
        <button
          type="button"
          onClick={() => onWeekChange(week + 1)}
          disabled={week === 16 || exportMode !== null}
          aria-label="الأسبوع التالي"
        >
          <span>التالي</span>
          <ArrowLeft size={19} aria-hidden="true" />
        </button>
      </div>

      {!isTeacherView && (
        <div className="plan-downloads" aria-label="تنزيل الخطط الأسبوعية">
          <button type="button" onClick={exportClass} disabled={exportDisabled}>
            {exportMode === 'class' ? <LoaderCircle className="spin" size={18} aria-hidden="true" /> : <Download size={18} aria-hidden="true" />}
            <span>{exportMode === 'class' ? 'جارٍ إنشاء PDF…' : 'تحميل خطة الفصل PDF'}</span>
          </button>
          <button type="button" className="download-all" onClick={exportAllClasses} disabled={exportDisabled}>
            {exportMode === 'all' ? <LoaderCircle className="spin" size={18} aria-hidden="true" /> : <Files size={18} aria-hidden="true" />}
            <span>{exportMode === 'all' ? `تجهيز ${toArabicNumber(exportProgress.completed)} / ${toArabicNumber(exportProgress.total)}` : 'تحميل جميع الفصول ZIP'}</span>
          </button>
          <p>للأسبوع المحدد · كل فصل في ملف PDF مستقل من صفحة واحدة</p>
        </div>
      )}

      <div className="plan-status" role="status" aria-live="polite">
        {overridesQuery.isLoading ? (
          <><LoaderCircle className="spin" size={16} aria-hidden="true" /> جارٍ تحميل تعديلات الأسبوع…</>
        ) : exportMode ? (
          <><LoaderCircle className="spin" size={16} aria-hidden="true" /> {exportMode === 'all' ? 'جارٍ إنشاء ملفات الفصول وتجميعها…' : 'جارٍ تجهيز خطة الفصل للتنزيل…'}</>
        ) : exportError ? (
          <span className="status-error">{exportError}</span>
        ) : saveError ? (
          <span className="status-error">{saveError}</span>
        ) : savedSubject ? (
          <><CheckCircle2 size={16} aria-hidden="true" /> حُفظ تعديل {savedSubject}، وسيبقى بعد إعادة فتح الصفحة.</>
        ) : (
          <><Cloud size={16} aria-hidden="true" /> اختر درسًا أو عدّل الواجب يدويًا؛ تُحفظ التغييرات تلقائيًا بعد الحفظ.</>
        )}
      </div>

      {overridesQuery.isError ? (
        <div className="plan-load-error" role="alert">
          <strong>تعذر تحميل التعديلات المحفوظة</strong>
          <p>يمكنك إعادة المحاولة. لم تتغير بيانات الخطة الأصلية.</p>
          <button type="button" onClick={() => overridesQuery.refetch()}>إعادة المحاولة</button>
        </div>
      ) : (
        <div className="plan-list" role="list" aria-busy={overridesQuery.isLoading}>
          <div className="plan-list-heading" aria-hidden="true">
            <span>{isTeacherView ? 'الفصل والمادة' : 'المادة والمعلم'}</span>
            <span>الدرس المفترض</span>
            <span>الواجب المرتبط</span>
          </div>
          {planRows.map((row) => {
            const curriculumLessons = getCurriculumLessons(row.classId, row.name)
            const defaultId = getDefaultLessonId(week)
            const override = savedOverrides[row.key]
            const selectedId = localEdits[row.key]
              ?? override?.lessonId
              ?? defaultId
            const selectedLesson = curriculumLessons.find((lesson) => lesson.id === selectedId)
              ?? curriculumLessons[week - 1]
            const savedHomework = override?.lessonId === selectedLesson.id
              ? override.homeworkText
              : null
            const homework = localHomeworkEdits[row.key]
              ?? savedHomework
              ?? selectedLesson.homework
            const isPending = pendingSubject === row.key
            const isModified = selectedId !== defaultId
            const isEditing = editingSubject === row.key
            const hasCustomHomework = Boolean(localHomeworkEdits[row.key] || savedHomework)

            return (
              <article className="plan-row" role="listitem" key={row.key}>
                <div className="plan-subject">
                  <div>
                    <h3>{row.name}</h3>
                    {isTeacherView && <span>{row.className} — {row.classId}</span>}
                    <span>{toArabicNumber(row.periods)} {row.periods === 1 ? 'حصة' : 'حصص'} هذا الأسبوع</span>
                  </div>
                  <p>
                    <UserRound size={14} aria-hidden="true" />
                    {row.teachers.join('، ')}
                  </p>
                </div>

                <div className="plan-lesson">
                  <div className="plan-field-label">
                    <label htmlFor={`lesson-${row.classId}-${row.name}`}>
                      <BookOpen size={15} aria-hidden="true" /> الدرس
                    </label>
                    {isModified && (
                      <button
                        type="button"
                        className="reset-lesson"
                        onClick={() => changeLesson(row, defaultId)}
                        disabled={isPending}
                      >
                        <RotateCcw size={13} aria-hidden="true" /> المقترح
                      </button>
                    )}
                  </div>
                  <div className="lesson-select-wrap">
                    <select
                      id={`lesson-${row.classId}-${row.name}`}
                      value={selectedLesson.id}
                      onChange={(event) => changeLesson(row, event.target.value)}
                      disabled={isPending || overridesQuery.isLoading || exportMode !== null}
                      aria-label={`اختيار درس ${row.name}${isTeacherView ? ` لفصل ${row.className}` : ''}`}
                    >
                      {curriculumLessons.map((lesson, index) => (
                        <option value={lesson.id} key={lesson.id}>
                          {toArabicNumber(index + 1)}. {lesson.title}
                        </option>
                      ))}
                    </select>
                    {isPending && <LoaderCircle className="spin lesson-spinner" size={17} aria-hidden="true" />}
                  </div>
                  {override && override.lessonId !== defaultId && !isPending && (
                    <span className="modified-badge"><Check size={12} aria-hidden="true" /> درس محفوظ بتعديل</span>
                  )}
                </div>

                <div className="plan-homework">
                  <div className="plan-field-label">
                    <span><ClipboardCheck size={15} aria-hidden="true" /> الواجب</span>
                    {!isEditing && (
                      <button
                        type="button"
                        className="edit-homework"
                        onClick={() => startHomeworkEdit(row.key, homework)}
                        disabled={isPending || exportMode !== null}
                      >
                        <Pencil size={13} aria-hidden="true" /> تعديل الواجب
                      </button>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="homework-editor">
                      <textarea
                        value={homeworkDraft}
                        onChange={(event) => setHomeworkDraft(event.target.value)}
                        maxLength={2000}
                        rows={4}
                        autoFocus
                        aria-label={`تحرير واجب ${row.name}${isTeacherView ? ` لفصل ${row.className}` : ''}`}
                      />
                      <div className="homework-editor-actions">
                        <button
                          type="button"
                          className="save-homework"
                          onClick={() => saveHomework(row, selectedLesson.id)}
                          disabled={isPending}
                        >
                          {isPending ? <LoaderCircle className="spin" size={15} aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
                          {isPending ? 'جارٍ الحفظ…' : 'حفظ الواجب'}
                        </button>
                        <button
                          type="button"
                          className="cancel-homework"
                          onClick={() => setEditingSubject(null)}
                          disabled={isPending}
                        >
                          <X size={15} aria-hidden="true" /> إلغاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p key={`${selectedLesson.id}-${homework}`}>{homework}</p>
                      {hasCustomHomework && (
                        <span className="homework-modified"><Check size={12} aria-hidden="true" /> واجب معدّل يدويًا</span>
                      )}
                    </>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
