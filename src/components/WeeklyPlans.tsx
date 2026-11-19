import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Download,
  FileImage,
  Files,
  LoaderCircle,
  SlidersHorizontal,
  WandSparkles,
} from 'lucide-react'
import { trpc } from '@/providers/trpc'
import type {
  SchoolBootstrap,
  SchoolClass,
  SchoolTeacher,
  WeeklyPlanEntry,
} from '@contracts/lessonPlans'
import { getInitialWeek, planWeeks } from '@/data/weeklyPlan'
import PrintablePlan from './PrintablePlan'
import PlanLessonEditor from './PlanLessonEditor'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './ui/dialog'
import { exportPlanImage, exportPlanPdf } from '@/lib/schoolPlanExport'

export type WeeklyPlansProps = {
  token: string
  data: SchoolBootstrap
}

type ScopeMode = 'all' | 'stage' | 'custom'

export default function WeeklyPlans({ token, data }: WeeklyPlansProps) {
  const utils = trpc.useUtils()
  const [week, setWeek] = useState(getInitialWeek())
  const [view, setView] = useState<'class' | 'teacher'>(data.role === 'teacher' ? 'teacher' : 'class')
  const [selectedClassId, setSelectedClassId] = useState(data.classes[0]?.id ?? '')
  const [selectedTeacherId, setSelectedTeacherId] = useState(data.teacherId ?? data.teachers[0]?.id ?? '')
  const [scopeMode, setScopeMode] = useState<ScopeMode>('all')
  const [stage, setStage] = useState('')
  const [classIds, setClassIds] = useState<string[]>(data.classes.map((item) => item.id))
  const [subjectIds, setSubjectIds] = useState<string[]>(data.subjects.map((item) => item.id))
  const [homework, setHomework] = useState('')
  const [distributionOpen, setDistributionOpen] = useState(true)
  const [editing, setEditing] = useState<{ classId: string; subjectId: string } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [showTeacherName, setShowTeacherName] = useState(true)
  const [notice, setNotice] = useState('')
  const currentSheet = useRef<HTMLElement>(null)
  const exportSheets = useRef(new Map<string, HTMLElement>())

  const planQuery = trpc.lessonPlans.plan.useQuery({ token, week }, { retry: 1 })
  const entries = useMemo(() => planQuery.data ?? [], [planQuery.data])
  const selectedTeacherAssignments = useMemo(
    () => data.assignments.filter((assignment) => assignment.teacherId === selectedTeacherId),
    [data.assignments, selectedTeacherId],
  )
  const scopeClasses = useMemo(() => {
    if (view === 'class') return data.classes
    const assignedClassIds = new Set(selectedTeacherAssignments.map((assignment) => assignment.classId))
    return data.classes.filter((schoolClass) => assignedClassIds.has(schoolClass.id))
  }, [data.classes, selectedTeacherAssignments, view])
  const scopeSubjects = useMemo(() => {
    if (view === 'class') return data.subjects
    const assignedSubjectIds = new Set(selectedTeacherAssignments.map((assignment) => assignment.subjectId))
    return data.subjects.filter((subject) => assignedSubjectIds.has(subject.id))
  }, [data.subjects, selectedTeacherAssignments, view])
  const stages = useMemo(() => [...new Set(scopeClasses.map((item) => item.stage))], [scopeClasses])
  const availableSubjects = useMemo(
    () => scopeSubjects.filter((subject) => classIds.includes(subject.classId)),
    [scopeSubjects, classIds],
  )

  useEffect(() => {
    if (!stages.length) return
    if (!stage || !stages.includes(stage)) setStage(stages[0])
  }, [stages, stage])

  useEffect(() => {
    const sameIds = (current: string[], next: string[]) =>
      current.length === next.length && current.every((id, index) => id === next[index])

    if (scopeMode === 'all') {
      const nextClassIds = scopeClasses.map((item) => item.id)
      const nextSubjectIds = scopeSubjects.map((item) => item.id)
      setClassIds((current) => sameIds(current, nextClassIds) ? current : nextClassIds)
      setSubjectIds((current) => sameIds(current, nextSubjectIds) ? current : nextSubjectIds)
    } else if (scopeMode === 'stage' && stage) {
      const ids = scopeClasses.filter((item) => item.stage === stage).map((item) => item.id)
      const nextSubjectIds = scopeSubjects.filter((item) => ids.includes(item.classId)).map((item) => item.id)
      setClassIds((current) => sameIds(current, ids) ? current : ids)
      setSubjectIds((current) => sameIds(current, nextSubjectIds) ? current : nextSubjectIds)
    } else if (scopeMode === 'custom') {
      const allowedClassIds = new Set(scopeClasses.map((item) => item.id))
      const allowedSubjects = new Map(scopeSubjects.map((item) => [item.id, item.classId]))
      setClassIds((current) => {
        const next = current.filter((id) => allowedClassIds.has(id))
        return sameIds(current, next) ? current : next
      })
      setSubjectIds((current) => {
        const next = current.filter((id) => {
          const classId = allowedSubjects.get(id)
          return Boolean(classId && allowedClassIds.has(classId) && classIds.includes(classId))
        })
        return sameIds(current, next) ? current : next
      })
    }
  }, [scopeMode, stage, scopeClasses, scopeSubjects, classIds])

  useEffect(() => {
    if (!data.classes.some((item) => item.id === selectedClassId)) setSelectedClassId(data.classes[0]?.id ?? '')
    if (!data.teachers.some((item) => item.id === selectedTeacherId)) {
      setSelectedTeacherId(data.teacherId ?? data.teachers[0]?.id ?? '')
    }
  }, [data.classes, data.teachers, data.teacherId, selectedClassId, selectedTeacherId])

  const updatePlan = (nextEntries: WeeklyPlanEntry[]) => {
    utils.lessonPlans.plan.setData({ token, week }, nextEntries)
  }

  const applyPlan = trpc.lessonPlans.applyPlan.useMutation({
    onSuccess: (result) => {
      updatePlan(result.plan)
      setNotice(result.reset > 0
        ? `اكتمل التوزيع التلقائي. أعيدت كتابة ${result.reset} خطة من المنهج العام، واستُبدلت التعديلات اليدوية في النطاق المحدد.`
        : 'لا توجد حصص مطابقة للفصول والمواد المختارة.')
    },
  })

  const bulkHomework = trpc.lessonPlans.bulkHomework.useMutation({
    onSuccess: (result) => {
      updatePlan(result.plan)
      setHomework('')
      setNotice(`عُمّم الواجب على ${result.updated} خطة في النطاق المحدد.`)
    },
  })

  const selectedClass = data.classes.find((item) => item.id === selectedClassId) ?? data.classes[0]
  const selectedTeacher = data.teachers.find((item) => item.id === selectedTeacherId) ?? data.teachers[0]
  const currentTarget = view === 'class' ? selectedClass : selectedTeacher
  const currentEntries = entries.filter((entry) => {
    if (view === 'class') return entry.classId === selectedClass?.id
    return data.assignments.some((assignment) =>
      assignment.teacherId === selectedTeacher?.id
      && assignment.classId === entry.classId
      && assignment.subjectId === entry.subjectId,
    )
  })
  const exportTargets: Array<SchoolClass | SchoolTeacher> = view === 'class'
    ? data.classes.filter((schoolClass) => data.lessons.some((lesson) => lesson.classId === schoolClass.id))
    : data.teachers.filter((teacher) => data.assignments.some((assignment) =>
      assignment.teacherId === teacher.id
      && data.lessons.some((lesson) => lesson.classId === assignment.classId && lesson.subjectId === assignment.subjectId)
    ))

  const toggleClass = (id: string) => {
    const next = classIds.includes(id) ? classIds.filter((item) => item !== id) : [...classIds, id]
    setClassIds(next)
    setSubjectIds((current) => current.filter((subjectId) => {
      const subject = scopeSubjects.find((item) => item.id === subjectId)
      return subject ? next.includes(subject.classId) : false
    }))
    setScopeMode('custom')
  }

  const toggleSubject = (id: string) => {
    setSubjectIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
    setScopeMode('custom')
  }

  const distribute = () => {
    setNotice('')
    applyPlan.mutate({ token, week, classIds, subjectIds })
  }

  const unifyHomework = () => {
    setNotice('')
    bulkHomework.mutate({ token, week, classIds, subjectIds, homework })
  }

  const exportCurrent = async (kind: 'pdf' | 'image') => {
    if (!currentSheet.current || !currentTarget) return
    setExporting(true)
    try {
      const filename = `خطة-${currentTarget.name}-الأسبوع-${week}`
      if (kind === 'image') await exportPlanImage(currentSheet.current, filename)
      else await exportPlanPdf([{ element: currentSheet.current, filename }], { combined: true, zipName: `${filename}.pdf` })
    } finally {
      setExporting(false)
    }
  }

  const exportAll = async (combined: boolean) => {
    if (!currentTarget) return
    setExporting(true)
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    try {
      const items = exportTargets.flatMap((target) => {
        const element = exportSheets.current.get(target.id)
        return element ? [{ element, filename: `خطة-${target.name}-الأسبوع-${week}` }] : []
      })
      if (!items.length) throw new Error('لا توجد خطط متاحة للتصدير')
      await exportPlanPdf(items, {
        combined,
        zipName: combined
          ? `جميع-خطط-${view === 'class' ? 'الفصول' : 'المعلمين'}-الأسبوع-${week}.pdf`
          : `خطط-${view === 'class' ? 'الفصول' : 'المعلمين'}-الأسبوع-${week}.zip`,
      })
    } finally {
      setExporting(false)
    }
  }

  const busy = applyPlan.isPending || bulkHomework.isPending
  const mutationError = applyPlan.error?.message || bulkHomework.error?.message

  return (
    <div className="weekly-workspace">
      <section className="workspace-toolbar" aria-label="إعدادات عرض الخطة">
        <label>
          <span>الأسبوع</span>
          <select value={week} onChange={(event) => { setWeek(Number(event.target.value)); setEditing(null); setNotice('') }}>
            {planWeeks.map((item) => <option value={item.number} key={item.number}>الأسبوع {item.number} · {item.dates}</option>)}
          </select>
        </label>
        <div className="segmented-control" aria-label="نوع العرض">
          <button type="button" className={view === 'class' ? 'active' : ''} onClick={() => { setView('class'); setScopeMode('all'); setEditing(null) }}>بحسب الفصل</button>
          <button type="button" className={view === 'teacher' ? 'active' : ''} onClick={() => { setView('teacher'); setScopeMode('all'); setEditing(null) }}>بحسب المعلم</button>
        </div>
        {view === 'class' ? (
          <label>
            <span>الفصل المعروض</span>
            <select value={selectedClass?.id ?? ''} onChange={(event) => { setSelectedClassId(event.target.value); setEditing(null) }}>
              {data.classes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
          </label>
        ) : (
          <label>
            <span>المعلم المعروض</span>
            <select value={selectedTeacher?.id ?? ''} onChange={(event) => { setSelectedTeacherId(event.target.value); setScopeMode('all'); setEditing(null) }}>
              {data.teachers.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
          </label>
        )}
      </section>

      <section className="distribution-panel">
        <button type="button" className="distribution-title" onClick={() => setDistributionOpen((value) => !value)} aria-expanded={distributionOpen}>
          <SlidersHorizontal size={20} />
          <span><strong>التوزيع التلقائي من المنهج وتعميم الواجب</strong><small>اختر الأسبوع والفصول والمواد بدقة</small></span>
          <b>{classIds.length} فصول · {subjectIds.length} مواد</b>
        </button>
        {distributionOpen && (
          <div className="distribution-body">
            <div className="scope-switch" aria-label="نطاق التوزيع">
              <button type="button" className={scopeMode === 'all' ? 'active' : ''} onClick={() => setScopeMode('all')}>جميع الفصول</button>
              <button type="button" className={scopeMode === 'stage' ? 'active' : ''} onClick={() => setScopeMode('stage')}>مرحلة دراسية</button>
              <button type="button" className={scopeMode === 'custom' ? 'active' : ''} onClick={() => setScopeMode('custom')}>فصول محددة</button>
            </div>
            {scopeMode === 'stage' && (
              <label className="stage-picker"><span>المرحلة</span><select value={stage} onChange={(event) => setStage(event.target.value)}>{stages.map((item) => <option key={item}>{item}</option>)}</select></label>
            )}
            <div className="scope-columns">
              <fieldset>
                <legend>
                  <span>الفصول</span>
                  <label><input
                    type="checkbox"
                    checked={scopeClasses.length > 0 && classIds.length === scopeClasses.length}
                    onChange={() => {
                      const all = classIds.length !== scopeClasses.length
                      const nextClassIds = all ? scopeClasses.map((item) => item.id) : []
                      setClassIds(nextClassIds)
                      setSubjectIds(all
                        ? scopeSubjects.filter((item) => nextClassIds.includes(item.classId)).map((item) => item.id)
                        : [])
                      setScopeMode('custom')
                    }}
                  /> تحديد الكل</label>
                </legend>
                <div className="check-list">
                  {scopeClasses.map((item) => (
                    <label key={item.id}><input type="checkbox" checked={classIds.includes(item.id)} onChange={() => toggleClass(item.id)} /><span>{item.name}<small>{item.stage}</small></span></label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>
                  <span>المواد</span>
                  <label><input
                    type="checkbox"
                    checked={availableSubjects.length > 0 && availableSubjects.every((item) => subjectIds.includes(item.id))}
                    onChange={() => {
                      const allSelected = availableSubjects.every((item) => subjectIds.includes(item.id))
                      const availableIds = availableSubjects.map((item) => item.id)
                      setSubjectIds(allSelected ? subjectIds.filter((id) => !availableIds.includes(id)) : [...new Set([...subjectIds, ...availableIds])])
                      setScopeMode('custom')
                    }}
                  /> تحديد الكل</label>
                </legend>
                <div className="check-list subjects-checklist">
                  {availableSubjects.map((item) => (
                    <label key={item.id}><input type="checkbox" checked={subjectIds.includes(item.id)} onChange={() => toggleSubject(item.id)} /><span>{item.name}<small>{data.classes.find((schoolClass) => schoolClass.id === item.classId)?.name}</small></span></label>
                  ))}
                  {!availableSubjects.length && <p>اختر فصلًا لعرض مواده.</p>}
                </div>
              </fieldset>
            </div>
            <div className="distribution-actions">
              <button type="button" className="primary-button" onClick={distribute} disabled={busy || !classIds.length || !subjectIds.length}>
                {applyPlan.isPending ? <LoaderCircle className="spin" size={19} /> : <WandSparkles size={19} />}
                توزيع تلقائي للأسبوع {week} على المحدد
              </button>
              <span>تُعاد كتابة الدروس والأهداف والواجبات من المنهج العام، وتُستبدل التعديلات اليدوية في النطاق المحدد.</span>
            </div>
            <div className="homework-unifier">
              <label><span>توحيد الواجب للفصول والمواد المحددة</span><textarea value={homework} onChange={(event) => setHomework(event.target.value)} rows={2} placeholder="اكتب واجبًا موحدًا للدروس المختارة…" maxLength={4000} /></label>
              <button type="button" className="secondary-button" onClick={unifyHomework} disabled={busy || !homework.trim() || !classIds.length || !subjectIds.length}>
                {bulkHomework.isPending ? <LoaderCircle className="spin" size={18} /> : <Files size={18} />} تعميم
              </button>
            </div>
          </div>
        )}
      </section>

      {planQuery.isLoading && <div className="page-status"><LoaderCircle className="spin" /> جارٍ تحميل خطة الأسبوع…</div>}
      {(planQuery.error || mutationError) && <p className="form-error" role="alert">{planQuery.error?.message || mutationError}</p>}
      {notice && <p className="form-success" role="status">{notice}</p>}

      <div className="export-toolbar">
        {view === 'class' && (
          <label className="teacher-visibility-toggle">
            <input
              type="checkbox"
              checked={showTeacherName}
              onChange={(event) => setShowTeacherName(event.target.checked)}
            />
            <span><strong>إظهار اسم المعلم</strong><small>في الجدول والملفات المحمّلة</small></span>
          </label>
        )}
        <span>تنزيل {view === 'class' ? 'الفصل' : 'المعلم'} الحالي أو الجميع</span>
        <div>
          <button type="button" onClick={() => exportCurrent('pdf')} disabled={exporting || !currentTarget}><Download size={17} /> PDF الحالي</button>
          <button type="button" onClick={() => exportCurrent('image')} disabled={exporting || !currentTarget}><FileImage size={17} /> صورة</button>
          <button type="button" onClick={() => exportAll(true)} disabled={exporting || !currentTarget}><Files size={17} /> {view === 'class' ? 'لكل الفصول في ملف واحد' : 'لكل المعلمين في ملف واحد'}</button>
          <button type="button" onClick={() => exportAll(false)} disabled={exporting || !currentTarget}><Download size={17} /> {view === 'class' ? 'تنزيل جميع الفصول في ملفات مستقلة' : 'تنزيل جميع المعلمين في ملفات مستقلة'}</button>
        </div>
        {exporting && <small><LoaderCircle className="spin" size={15} /> جارٍ تجهيز الملفات…</small>}
      </div>

      {currentTarget ? (
        <div className="plan-editor-layout">
          <PrintablePlan
            ref={currentSheet}
            data={data}
            entries={currentEntries}
            week={week}
            view={view}
            target={currentTarget}
            interactive
            showTeacherName={showTeacherName}
            onEdit={(classId, subjectId) => setEditing({ classId, subjectId })}
          />
        </div>
      ) : (
        <div className="page-status">لا توجد فصول أو تعيينات متاحة لهذا الحساب.</div>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null) }}>
        <DialogContent
          dir="rtl"
          className="lesson-editor-dialog"
          showCloseButton={false}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            const dialog = event.currentTarget
            if (dialog instanceof HTMLElement) dialog.focus()
          }}
        >
          <DialogTitle className="sr-only">تحرير بيانات الحصة</DialogTitle>
          <DialogDescription className="sr-only">
            عدّل عنوان الدرس وأهدافه وواجبه، ثم اضغط حفظ التعديلات لإغلاق النافذة.
          </DialogDescription>
          {editing && (
            <PlanLessonEditor
              key={`${editing.classId}:${editing.subjectId}:${entries.find((entry) => entry.classId === editing.classId && entry.subjectId === editing.subjectId)?.id ?? 'empty'}`}
              token={token}
              week={week}
              data={data}
              classId={editing.classId}
              subjectId={editing.subjectId}
              entry={entries.find((entry) => entry.classId === editing.classId && entry.subjectId === editing.subjectId)}
              onPlanChange={updatePlan}
              onClose={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <div className="export-sheets" aria-hidden="true">
        {exportTargets.map((target) => {
          const targetEntries = entries.filter((entry) => view === 'class'
            ? entry.classId === target.id
            : data.assignments.some((assignment) => assignment.teacherId === target.id && assignment.classId === entry.classId && assignment.subjectId === entry.subjectId))
          return (
            <PrintablePlan
              key={target.id}
              ref={(element) => {
                if (element) exportSheets.current.set(target.id, element)
                else exportSheets.current.delete(target.id)
              }}
              data={data}
              entries={targetEntries}
              week={week}
              view={view}
              target={target}
              showTeacherName={showTeacherName}
            />
          )
        })}
      </div>
    </div>
  )
}
