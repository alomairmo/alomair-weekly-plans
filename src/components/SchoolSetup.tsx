import { useMemo, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  LoaderCircle,
  Plus,
  Save,
  School,
  Users,
} from 'lucide-react'
import { trpc } from '@/providers/trpc'
import { curriculumGradesForStage, subjectsForClass } from '@/lib/classCurriculum'
import type {
  SchoolBootstrap,
  SchoolClass,
  SchoolLessonSlot,
  SchoolSetupPayload,
  SchoolSubject,
  SchoolTeacher,
  TeacherAssignment,
} from '@contracts/lessonPlans'

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'] as const
const PERIODS = [1, 2, 3, 4, 5, 6, 7] as const
const DEFAULT_STAGES = ['ابتدائية', 'متوسطة', 'ثانوية']

function toArabicNumber(value: number): string {
  return value.toLocaleString('ar-EG')
}

function deriveTeacherClasses(list: TeacherAssignment[]): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  for (const assignment of list) {
    const current = map[assignment.teacherId] ?? []
    if (!current.includes(assignment.classId)) current.push(assignment.classId)
    map[assignment.teacherId] = current
  }
  return map
}

type SchoolSetupProps = {
  token: string
  data: SchoolBootstrap
  onSaved: (data: SchoolBootstrap) => void
}

export default function SchoolSetup({ token, data, onSaved }: SchoolSetupProps) {
  const [schoolName, setSchoolName] = useState(data.school.name)
  const [classes, setClasses] = useState<SchoolClass[]>(data.classes)
  const [subjects, setSubjects] = useState<SchoolSubject[]>(data.subjects)
  const [teachers, setTeachers] = useState<SchoolTeacher[]>(data.teachers)
  const [assignments, setAssignments] = useState<TeacherAssignment[]>(data.assignments)
  const [lessons, setLessons] = useState<SchoolLessonSlot[]>(data.lessons)
  const [persistedLessonIds, setPersistedLessonIds] = useState<Set<string>>(
    () => new Set(data.lessons.map((lesson) => lesson.id)),
  )
  const [removeLessonIds, setRemoveLessonIds] = useState<string[]>([])
  const [teacherClasses, setTeacherClasses] = useState<Record<string, string[]>>(() =>
    deriveTeacherClasses(data.assignments),
  )
  const [selectedClassId, setSelectedClassId] = useState<string | null>(
    data.classes[0]?.id ?? null,
  )
  const [newClassName, setNewClassName] = useState('')
  const [newClassStage, setNewClassStage] = useState(DEFAULT_STAGES[0])
  const [newTeacherName, setNewTeacherName] = useState('')
  const [scheduleMode, setScheduleMode] = useState<'class' | 'teacher'>('class')
  const [selectedScheduleTeacherId, setSelectedScheduleTeacherId] = useState(
    data.teachers[0]?.id ?? '',
  )
  const [message, setMessage] = useState('عدّل بيانات المدرسة ثم اضغط «حفظ الإعداد» لتطبيق التغييرات.')
  const [isError, setIsError] = useState(false)

  const saveSetup = trpc.lessonPlans.saveSetup.useMutation({
    onSuccess: (result) => {
      syncDraft(result)
      setIsError(false)
      setMessage('حُفظ الإعداد بنجاح، وستظهر التغييرات في الجدول والخطط.')
      onSaved(result)
    },
    onError: (error) => {
      setIsError(true)
      setMessage(error.message || 'تعذر حفظ الإعداد. تحقق من البيانات ثم حاول مجددًا.')
    },
  })

  const isPending = saveSetup.isPending

  const stageOptions = useMemo(() => {
    const extras = classes
      .map((item) => item.stage.trim())
      .filter((stage) => stage.length > 0 && !DEFAULT_STAGES.includes(stage))
    return [...DEFAULT_STAGES, ...Array.from(new Set(extras))]
  }, [classes])

  const activeClass = classes.find((item) => item.id === selectedClassId) ?? classes[0] ?? null
  const activeScheduleTeacher = teachers.find((item) => item.id === selectedScheduleTeacherId)
    ?? teachers[0]
    ?? null
  const activeTeacherAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.teacherId === activeScheduleTeacher?.id),
    [activeScheduleTeacher?.id, assignments],
  )
  const activeTeacherClasses = useMemo(() => {
    const ids = new Set(activeTeacherAssignments.map((assignment) => assignment.classId))
    return classes.filter((schoolClass) => ids.has(schoolClass.id))
  }, [activeTeacherAssignments, classes])

  function syncDraft(next: SchoolBootstrap) {
    setSchoolName(next.school.name)
    setClasses(next.classes)
    setSubjects(next.subjects)
    setTeachers(next.teachers)
    setAssignments(next.assignments)
    setLessons(next.lessons)
    setPersistedLessonIds(new Set(next.lessons.map((lesson) => lesson.id)))
    setRemoveLessonIds([])
    setTeacherClasses(deriveTeacherClasses(next.assignments))
    setSelectedClassId((current) =>
      current && next.classes.some((item) => item.id === current)
        ? current
        : next.classes[0]?.id ?? null,
    )
    setNewClassName('')
    setNewClassStage(DEFAULT_STAGES[0])
    setNewTeacherName('')
    setSelectedScheduleTeacherId((current) =>
      next.teachers.some((teacher) => teacher.id === current)
        ? current
        : next.teachers[0]?.id ?? '',
    )
  }

  function subjectsOf(classId: string): SchoolSubject[] {
    return subjects
      .filter((subject) => subject.classId === classId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  function assignedTeacherId(classId: string, subjectId: string): string | null {
    return (
      assignments.find(
        (assignment) =>
          assignment.classId === classId && assignment.subjectId === subjectId,
      )?.teacherId ?? null
    )
  }

  function updateClass(id: string, patch: Partial<Pick<SchoolClass, 'name' | 'stage'>>) {
    setClasses((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )
  }

  function addClass() {
    const name = newClassName.trim()
    const stage = newClassStage.trim()
    if (!name || stage.length < 2) return
    const importedSubjects = subjectsForClass(name, stage)
    if (!importedSubjects.length) {
      setIsError(true)
      setMessage('لم يُعثر على هذا الصف في المنهج. اختر اسمه من القائمة أو اكتب الصف والمرحلة كما وردا في المنهج.')
      return
    }

    const id = crypto.randomUUID()
    setClasses((current) => [...current, { id, name, stage, sortOrder: current.length }])
    setSubjects((current) => [
      ...current,
      ...importedSubjects.map((subject, sortOrder) => ({
        id: crypto.randomUUID(),
        classId: id,
        name: subject.name,
        curriculumKey: subject.curriculumKey,
        sortOrder,
      })),
    ])
    setSelectedClassId(id)
    setNewClassName('')
    setNewClassStage(DEFAULT_STAGES[0])
    setIsError(false)
    setMessage(`أُضيف الفصل واستُوردت له ${toArabicNumber(importedSubjects.length)} مادة من المنهج. اضغط «حفظ الإعداد» لتثبيتها.`)
  }

  function updateTeacher(id: string, name: string) {
    setTeachers((current) =>
      current.map((item) => (item.id === id ? { ...item, name } : item)),
    )
  }

  function addTeacher() {
    const name = newTeacherName.trim()
    if (name.length < 2) return
    setTeachers((current) => [...current, { id: crypto.randomUUID(), name }])
    setNewTeacherName('')
  }

  function toggleTeacherClass(teacherId: string, classId: string, checked: boolean) {
    setTeacherClasses((current) => {
      const existing = current[teacherId] ?? []
      const next = checked
        ? [...existing, classId]
        : existing.filter((id) => id !== classId)
      return { ...current, [teacherId]: next }
    })
    if (!checked) {
      setAssignments((current) =>
        current.filter(
          (assignment) =>
            !(assignment.teacherId === teacherId && assignment.classId === classId),
        ),
      )
      setLessons((current) =>
        current.map((lesson) =>
          lesson.classId === classId && lesson.teacherId === teacherId
            ? { ...lesson, teacherId: null }
            : lesson,
        ),
      )
    }
  }

  function assignSubjectTeacher(
    classId: string,
    subjectId: string,
    teacherId: string | null,
  ) {
    const retained = assignments.filter(
      (assignment) => !(assignment.classId === classId && assignment.subjectId === subjectId),
    )
    const nextAssignments = teacherId
      ? [...retained, { id: crypto.randomUUID(), teacherId, classId, subjectId }]
      : retained
    setAssignments(nextAssignments)
    setTeacherClasses((current) => {
      if (!teacherId || (current[teacherId] ?? []).includes(classId)) return current
      return { ...current, [teacherId]: [...(current[teacherId] ?? []), classId] }
    })
    setLessons((current) =>
      current.map((lesson) =>
        lesson.classId === classId && lesson.subjectId === subjectId
          ? { ...lesson, teacherId }
          : lesson,
      ),
    )
  }

  function toggleAssignment(
    teacherId: string,
    classId: string,
    subjectId: string,
    checked: boolean,
  ) {
    assignSubjectTeacher(classId, subjectId, checked ? teacherId : null)
  }

  function removeCellLesson(existing: SchoolLessonSlot) {
    if (persistedLessonIds.has(existing.id)) {
      setRemoveLessonIds((current) =>
        current.includes(existing.id) ? current : [...current, existing.id],
      )
    }
    setLessons((current) => current.filter((lesson) => lesson.id !== existing.id))
  }

  function teacherSlotConflict(
    teacherId: string,
    day: number,
    period: number,
    excludeLessonId?: string,
  ): SchoolLessonSlot | undefined {
    return lessons.find(
      (lesson) =>
        lesson.id !== excludeLessonId &&
        lesson.teacherId === teacherId &&
        lesson.day === day &&
        lesson.period === period,
    )
  }

  function setCellSubject(classId: string, day: number, period: number, subjectId: string) {
    const existing = lessons.find(
      (lesson) => lesson.classId === classId && lesson.day === day && lesson.period === period,
    )
    if (!subjectId) {
      if (existing) removeCellLesson(existing)
      return
    }

    const teacherId = assignedTeacherId(classId, subjectId)
    const conflict = teacherId
      ? teacherSlotConflict(teacherId, day, period, existing?.id)
      : undefined
    if (conflict && teacherId) {
      const teacherName = teachers.find((teacher) => teacher.id === teacherId)?.name ?? 'المعلم'
      const conflictClass = classes.find((schoolClass) => schoolClass.id === conflict.classId)?.name
      setIsError(true)
      setMessage(`لا يمكن إسناد الحصة إلى ${teacherName}؛ لديه حصة في الوقت نفسه${conflictClass ? ` في ${conflictClass}` : ''}.`)
      return
    }

    if (existing) {
      setLessons((current) =>
        current.map((lesson) =>
          lesson.id === existing.id ? { ...lesson, subjectId, teacherId } : lesson,
        ),
      )
      return
    }
    setLessons((current) => [
      ...current,
      { id: crypto.randomUUID(), classId, subjectId, teacherId, day, period },
    ])
  }

  function setTeacherCellClass(day: number, period: number, classId: string) {
    const teacher = activeScheduleTeacher
    if (!teacher) return
    const existing = lessons.find(
      (lesson) => lesson.teacherId === teacher.id && lesson.day === day && lesson.period === period,
    )
    if (!classId) {
      if (existing) removeCellLesson(existing)
      return
    }

    const classSubjects = activeTeacherAssignments
      .filter((assignment) => assignment.classId === classId)
      .map((assignment) => assignment.subjectId)
    const subjectId = existing?.classId === classId && classSubjects.includes(existing.subjectId)
      ? existing.subjectId
      : classSubjects[0]
    if (!subjectId) return

    const classConflict = lessons.find(
      (lesson) =>
        lesson.id !== existing?.id &&
        lesson.classId === classId &&
        lesson.day === day &&
        lesson.period === period,
    )
    if (classConflict) {
      const className = classes.find((schoolClass) => schoolClass.id === classId)?.name ?? 'الفصل'
      setIsError(true)
      setMessage(`لا يمكن نقل حصة ${teacher.name} إلى ${className} في هذا الوقت؛ توجد حصة قائمة للفصل.`)
      return
    }

    if (existing) {
      setLessons((current) => current.map((lesson) =>
        lesson.id === existing.id ? { ...lesson, classId, subjectId } : lesson,
      ))
    } else {
      setLessons((current) => [
        ...current,
        { id: crypto.randomUUID(), classId, subjectId, teacherId: teacher.id, day, period },
      ])
    }
  }

  function setTeacherCellSubject(day: number, period: number, subjectId: string) {
    const teacher = activeScheduleTeacher
    if (!teacher) return
    const existing = lessons.find(
      (lesson) => lesson.teacherId === teacher.id && lesson.day === day && lesson.period === period,
    )
    if (!existing || !activeTeacherAssignments.some((assignment) =>
      assignment.classId === existing.classId && assignment.subjectId === subjectId,
    )) return
    setLessons((current) => current.map((lesson) =>
      lesson.id === existing.id ? { ...lesson, subjectId } : lesson,
    ))
  }

  function validate(): string | null {
    if (classes.some((item) => !item.name.trim())) return 'أدخل اسمًا لكل فصل قبل الحفظ.'
    if (classes.some((item) => item.stage.trim().length < 2)) {
      return 'أدخل مرحلة صحيحة (حرفان على الأقل) لكل فصل.'
    }
    if (subjects.some((item) => !item.name.trim())) return 'أدخل اسمًا لكل مادة قبل الحفظ.'
    if (teachers.some((item) => item.name.trim().length < 2)) {
      return 'أدخل اسمًا صحيحًا (حرفان على الأقل) لكل معلم.'
    }
    return null
  }

  function buildPayload(): SchoolSetupPayload {
    const trimmedName = schoolName.trim()
    return {
      ...(trimmedName.length >= 2 ? { schoolName: trimmedName } : {}),
      classes: classes.map((item, index) => ({
        id: item.id,
        name: item.name.trim(),
        stage: item.stage.trim(),
        sort_order: index,
        subjects: subjectsOf(item.id).map((subject, subjectIndex) => ({
          id: subject.id,
          name: subject.name.trim(),
          curriculum_key: subject.curriculumKey,
          sort_order: subjectIndex,
        })),
      })),
      teachers: teachers.map((teacher) => ({
        id: teacher.id,
        name: teacher.name.trim(),
        assignments: assignments
          .filter((assignment) => assignment.teacherId === teacher.id)
          .map((assignment) => ({
            class_id: assignment.classId,
            subject_id: assignment.subjectId,
          })),
      })),
      lessons: lessons.map((lesson) => ({
        id: persistedLessonIds.has(lesson.id) ? lesson.id : null,
        class_id: lesson.classId,
        subject_id: lesson.subjectId,
        teacher_id: lesson.teacherId,
        day: lesson.day,
        period: lesson.period,
      })),
      ...(removeLessonIds.length > 0 ? { removeLessonIds } : {}),
    }
  }

  function submit() {
    const error = validate()
    if (error) {
      setIsError(true)
      setMessage(error)
      return
    }
    saveSetup.mutate({ token, payload: buildPayload() })
  }

  const saveButton = (
    <button
      type="button"
      onClick={submit}
      disabled={isPending}
      className="inline-flex items-center gap-2 rounded-lg bg-[#155b58] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#123f3e] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? (
        <LoaderCircle className="animate-spin" size={17} aria-hidden="true" />
      ) : (
        <Save size={17} aria-hidden="true" />
      )}
      {isPending ? 'جارٍ الحفظ…' : 'حفظ الإعداد'}
    </button>
  )

  return (
    <div dir="rtl" className="school-setup min-h-screen bg-[#f8f0dc] pb-16 text-neutral-800">
      <header className="sticky top-0 z-10 border-b border-[#155b58]/15 bg-[#f8f0dc]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 text-[#155b58]">
            <School size={22} aria-hidden="true" />
            <h1 className="text-lg font-bold">إعداد المدرسة</h1>
          </div>
          <label className="flex min-w-0 flex-1 items-center gap-2 text-sm sm:max-w-md">
            <span className="whitespace-nowrap text-neutral-500">اسم المدرسة</span>
            <input
              type="text"
              value={schoolName}
              maxLength={160}
              onChange={(event) => setSchoolName(event.target.value)}
              disabled={isPending}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-[#155b58] focus:outline-none"
            />
          </label>
          <div className="ms-auto">{saveButton}</div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-4 py-6 sm:px-6">
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${
            isError
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-[#155b58]/20 bg-[#155b58]/5 text-[#155b58]'
          }`}
          role="status"
          aria-live="polite"
        >
          {isPending ? (
            <LoaderCircle className="animate-spin shrink-0" size={17} aria-hidden="true" />
          ) : (
            <CheckCircle2 className="shrink-0" size={17} aria-hidden="true" />
          )}
          <span>{isPending ? 'جارٍ حفظ الإعداد في قاعدة البيانات…' : message}</span>
        </div>

        <section aria-labelledby="setup-classes-title">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#155b58] text-white">
              <GraduationCap size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 id="setup-classes-title" className="text-base font-bold text-[#155b58]">
                الفصول والمواد
              </h2>
              <p className="text-sm text-neutral-500">
                أضف فصول المدرسة ومرحلاتها فقط؛ تُستورد مواد كل صف تلقائيًا من المنهج، ثم اختر معلم كل مادة.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {classes.map((item) => {
              const classSubjects = subjectsOf(item.id)
              return (
                <div key={item.id} className="rounded-xl border border-[#155b58]/15 bg-white">
                  <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-4 py-3">
                    <label className="min-w-0 flex-1">
                      <span className="sr-only">اسم الفصل</span>
                      <input
                        type="text"
                        value={item.name}
                        maxLength={120}
                        onChange={(event) => updateClass(item.id, { name: event.target.value })}
                        disabled={isPending}
                        placeholder="اسم الفصل"
                        className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold focus:border-[#155b58] focus:outline-none"
                      />
                    </label>
                    <label className="w-32 shrink-0">
                      <span className="sr-only">المرحلة</span>
                      <input
                        type="text"
                        list="stage-options"
                        value={item.stage}
                        maxLength={80}
                        onChange={(event) => updateClass(item.id, { stage: event.target.value })}
                        disabled={isPending}
                        placeholder="المرحلة"
                        className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-[#155b58] focus:outline-none"
                      />
                    </label>
                  </div>

                  <ul className="divide-y divide-neutral-100">
                    {classSubjects.map((subject, index) => (
                      <li key={subject.id} className="flex items-center gap-3 px-4 py-1.5">
                        <span className="w-6 shrink-0 text-sm font-semibold text-[#155b58]">
                          {toArabicNumber(index + 1)}
                        </span>
                        <span className="min-w-0 flex-1 px-2 py-1.5 text-sm font-medium">
                          {subject.name}
                        </span>
                        <label className="w-40 shrink-0 sm:w-48">
                          <span className="sr-only">المعلم المسند إلى {subject.name} في {item.name}</span>
                          <select
                            value={assignedTeacherId(item.id, subject.id) ?? ''}
                            onChange={(event) =>
                              assignSubjectTeacher(item.id, subject.id, event.target.value || null)
                            }
                            disabled={isPending}
                            className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs focus:border-[#155b58] focus:outline-none disabled:opacity-60"
                          >
                            <option value="">— بدون معلم —</option>
                            {teachers.map((teacher) => (
                              <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                            ))}
                          </select>
                        </label>
                      </li>
                    ))}
                    {classSubjects.length === 0 && (
                      <li className="px-4 py-3 text-sm text-neutral-400">
                        لا توجد مواد مرتبطة بهذا الفصل في المنهج.
                      </li>
                    )}
                  </ul>
                </div>
              )
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-[#155b58]/30 bg-white px-4 py-3">
            <input
              type="text"
              value={newClassName}
              maxLength={120}
              onChange={(event) => setNewClassName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addClass()
                }
              }}
              disabled={isPending}
              placeholder="اختر الصف من المنهج، مثل: الصف الرابع الابتدائي"
              list="grade-options"
              aria-label="اسم الفصل الجديد"
              className="min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-[#155b58] focus:outline-none sm:max-w-xs"
            />
            <input
              type="text"
              list="stage-options"
              value={newClassStage}
              maxLength={80}
              onChange={(event) => setNewClassStage(event.target.value)}
              disabled={isPending}
              placeholder="المرحلة"
              aria-label="مرحلة الفصل الجديد"
              className="w-36 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-[#155b58] focus:outline-none"
            />
            <button
              type="button"
              onClick={addClass}
              disabled={isPending || !newClassName.trim() || newClassStage.trim().length < 2}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#155b58] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#123f3e] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={16} aria-hidden="true" />
              إضافة فصل
            </button>
          </div>
          <datalist id="grade-options">
            {curriculumGradesForStage(newClassStage).map((grade) => (
              <option key={grade} value={grade} />
            ))}
          </datalist>
          <datalist id="stage-options">
            {stageOptions.map((stage) => (
              <option key={stage} value={stage} />
            ))}
          </datalist>
        </section>

        <section aria-labelledby="setup-teachers-title">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#155b58] text-white">
              <Users size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 id="setup-teachers-title" className="text-base font-bold text-[#155b58]">
                المعلمون والتعيينات
              </h2>
              <p className="text-sm text-neutral-500">
                أضف المعلم باسمه، حدّد فصوله، ثم اختر مادة أو أكثر يدرّسها في كل فصل.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {teachers.map((teacher) => {
              const selectedIds = teacherClasses[teacher.id] ?? []
              return (
                <div key={teacher.id} className="rounded-xl border border-[#155b58]/15 bg-white">
                  <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
                    <span className="whitespace-nowrap text-sm text-neutral-500">اسم المعلم</span>
                    <label className="min-w-0 flex-1 sm:max-w-sm">
                      <span className="sr-only">اسم المعلم</span>
                      <input
                        type="text"
                        value={teacher.name}
                        maxLength={160}
                        onChange={(event) => updateTeacher(teacher.id, event.target.value)}
                        disabled={isPending}
                        className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold focus:border-[#155b58] focus:outline-none"
                      />
                    </label>
                  </div>

                  <div className="space-y-3 px-4 py-3">
                    <div>
                      <p className="mb-2 text-sm font-semibold text-neutral-600">
                        الفصول التي يدرّسها
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {classes.map((item) => {
                          const checked = selectedIds.includes(item.id)
                          return (
                            <label
                              key={item.id}
                              className={`inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-sm transition ${
                                checked
                                  ? 'border-[#155b58] bg-[#155b58] font-semibold text-white'
                                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-[#155b58]/50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={checked}
                                onChange={(event) =>
                                  toggleTeacherClass(teacher.id, item.id, event.target.checked)
                                }
                                disabled={isPending}
                              />
                              {item.name}
                            </label>
                          )
                        })}
                        {classes.length === 0 && (
                          <span className="text-sm text-neutral-400">
                            أضف فصلًا أولًا من قسم الفصول والمواد.
                          </span>
                        )}
                      </div>
                    </div>

                    {selectedIds.map((classId) => {
                      const klass = classes.find((item) => item.id === classId)
                      if (!klass) return null
                      const klassSubjects = subjectsOf(classId)
                      return (
                        <div
                          key={classId}
                          className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3"
                        >
                          <span className="text-sm font-semibold text-[#155b58]">
                            {klass.name}:
                          </span>
                          {klassSubjects.length === 0 && (
                            <span className="text-sm text-neutral-400">
                              لا توجد مواد لهذا الفصل بعد.
                            </span>
                          )}
                          {klassSubjects.map((subject) => {
                            const checked = assignments.some(
                              (assignment) =>
                                assignment.teacherId === teacher.id &&
                                assignment.classId === classId &&
                                assignment.subjectId === subject.id,
                            )
                            return (
                              <label
                                key={subject.id}
                                className={`inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-sm transition ${
                                  checked
                                    ? 'border-[#155b58] bg-[#155b58]/10 font-semibold text-[#155b58]'
                                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-[#155b58]/50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="sr-only"
                                  checked={checked}
                                  onChange={(event) =>
                                    toggleAssignment(
                                      teacher.id,
                                      classId,
                                      subject.id,
                                      event.target.checked,
                                    )
                                  }
                                  disabled={isPending}
                                />
                                {subject.name}
                              </label>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {teachers.length === 0 && (
              <p className="rounded-xl border border-dashed border-[#155b58]/30 bg-white px-4 py-6 text-center text-sm text-neutral-400">
                لا يوجد معلمون بعد، أضف أول معلم من الأسفل.
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-[#155b58]/30 bg-white px-4 py-3">
            <input
              type="text"
              value={newTeacherName}
              maxLength={160}
              onChange={(event) => setNewTeacherName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addTeacher()
                }
              }}
              disabled={isPending}
              placeholder="اسم المعلم الجديد"
              aria-label="اسم المعلم الجديد"
              className="min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-[#155b58] focus:outline-none sm:max-w-xs"
            />
            <button
              type="button"
              onClick={addTeacher}
              disabled={isPending || newTeacherName.trim().length < 2}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#155b58] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#123f3e] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={16} aria-hidden="true" />
              إضافة معلم
            </button>
          </div>
        </section>

        <section aria-labelledby="setup-schedule-title">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#155b58] text-white">
              <CalendarDays size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 id="setup-schedule-title" className="text-base font-bold text-[#155b58]">
                الجدول الأسبوعي
              </h2>
              <p className="text-sm text-neutral-500">
                {scheduleMode === 'class'
                  ? 'اختر مادة كل حصة من مواد الفصل؛ يُختار المعلم المعيّن تلقائيًا، واختيار «فارغة» يفرغ الخلية.'
                  : 'اختر الفصل أولًا ثم المادة من المواد المسندة إلى المعلم في ذلك الفصل؛ اختيار «فارغة» يفرغ الخلية.'}
              </p>
            </div>
          </div>

          {classes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#155b58]/30 bg-white px-4 py-6 text-center text-sm text-neutral-400">
              أضف فصلًا أولًا لتتمكن من تعبئة الجدول.
            </p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="flex rounded-lg border border-neutral-200 bg-white p-1" role="tablist" aria-label="طريقة إدخال الجدول">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={scheduleMode === 'class'}
                    onClick={() => setScheduleMode('class')}
                    className={scheduleMode === 'class'
                      ? 'rounded-md bg-[#155b58] px-4 py-2 text-sm font-semibold text-white'
                      : 'rounded-md px-4 py-2 text-sm text-neutral-600'}
                  >
                    بحسب الفصل
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={scheduleMode === 'teacher'}
                    onClick={() => setScheduleMode('teacher')}
                    className={scheduleMode === 'teacher'
                      ? 'rounded-md bg-[#155b58] px-4 py-2 text-sm font-semibold text-white'
                      : 'rounded-md px-4 py-2 text-sm text-neutral-600'}
                  >
                    بحسب المعلم
                  </button>
                </div>
                {scheduleMode === 'teacher' && (
                  <label className="flex min-w-56 items-center gap-2 text-sm">
                    <span className="text-neutral-500">المعلم</span>
                    <select
                      value={activeScheduleTeacher?.id ?? ''}
                      onChange={(event) => setSelectedScheduleTeacherId(event.target.value)}
                      disabled={isPending}
                      className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-[#155b58] focus:outline-none"
                    >
                      {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              {scheduleMode === 'class' && (
                <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="اختيار الفصل">
                  {classes.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={activeClass?.id === item.id}
                      onClick={() => setSelectedClassId(item.id)}
                      className={
                        activeClass?.id === item.id
                          ? 'rounded-lg bg-[#155b58] px-4 py-2 text-sm font-semibold text-white'
                          : 'rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-600 transition hover:border-[#155b58]/50'
                      }
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              )}

              {scheduleMode === 'class' && activeClass && subjectsOf(activeClass.id).length === 0 && (
                <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
                  لا توجد مواد مرتبطة بهذا الفصل في المنهج.
                </p>
              )}
              {scheduleMode === 'teacher' && activeScheduleTeacher && activeTeacherClasses.length === 0 && (
                <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
                  لا توجد فصول أو مواد مسندة إلى {activeScheduleTeacher.name}؛ عيّنها أولًا من قسم الفصول والمواد أو المعلمين والتعيينات.
                </p>
              )}

              {(scheduleMode === 'class' ? activeClass : activeScheduleTeacher) && (
                <div className="overflow-x-auto rounded-xl border border-[#155b58]/15 bg-white">
                  <table className="w-full min-w-[720px] border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#155b58] text-white">
                        <th className="px-3 py-2.5 text-start font-semibold">الحصة</th>
                        {DAYS.map((day) => (
                          <th key={day} className="px-2 py-2.5 text-center font-semibold">
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {PERIODS.map((period) => (
                        <tr key={period}>
                          <th
                            scope="row"
                            className="whitespace-nowrap bg-[#155b58]/5 px-3 py-2 text-start font-semibold text-[#155b58]"
                          >
                            {toArabicNumber(period)}
                          </th>
                          {DAYS.map((_, day) => {
                            if (scheduleMode === 'class') {
                              if (!activeClass) return null
                              const lesson = lessons.find(
                                (item) =>
                                  item.classId === activeClass.id &&
                                  item.day === day &&
                                  item.period === period,
                              )
                              const teacher = lesson?.teacherId
                                ? teachers.find((item) => item.id === lesson.teacherId) ?? null
                                : null
                              return (
                                <td key={day} className="border-s border-neutral-100 p-1.5 align-top">
                                  <select
                                    value={lesson?.subjectId ?? ''}
                                    onChange={(event) =>
                                      setCellSubject(
                                        activeClass.id,
                                        day,
                                        period,
                                        event.target.value,
                                      )
                                    }
                                    disabled={isPending}
                                    aria-label={`حصة ${DAYS[day]} رقم ${toArabicNumber(period)} في ${activeClass.name}`}
                                    className="w-full rounded-md border border-neutral-200 bg-white px-1.5 py-1.5 text-xs focus:border-[#155b58] focus:outline-none disabled:opacity-60"
                                  >
                                    <option value="">— فارغة —</option>
                                    {subjectsOf(activeClass.id).map((subject) => (
                                      <option key={subject.id} value={subject.id}>
                                        {subject.name}
                                      </option>
                                    ))}
                                  </select>
                                  {lesson && (
                                    <span
                                      className={`mt-1 block px-1 text-[11px] ${
                                        teacher ? 'text-neutral-600' : 'text-amber-600'
                                      }`}
                                    >
                                      {teacher ? teacher.name : 'بدون معلم معيّن'}
                                    </span>
                                  )}
                                </td>
                              )
                            }

                            if (!activeScheduleTeacher) return null
                            const lesson = lessons.find(
                              (item) =>
                                item.teacherId === activeScheduleTeacher.id &&
                                item.day === day &&
                                item.period === period,
                            )
                            const cellSubjects = lesson
                              ? activeTeacherAssignments
                                .filter((assignment) => assignment.classId === lesson.classId)
                                .map((assignment) => subjects.find((subject) => subject.id === assignment.subjectId))
                                .filter((subject): subject is SchoolSubject => Boolean(subject))
                              : []
                            return (
                              <td key={day} className="border-s border-neutral-100 p-1.5 align-top">
                                <select
                                  value={lesson?.classId ?? ''}
                                  onChange={(event) => setTeacherCellClass(day, period, event.target.value)}
                                  disabled={isPending}
                                  aria-label={`فصل حصة ${DAYS[day]} رقم ${toArabicNumber(period)} للمعلم ${activeScheduleTeacher.name}`}
                                  className="w-full rounded-md border border-neutral-200 bg-white px-1.5 py-1.5 text-xs focus:border-[#155b58] focus:outline-none disabled:opacity-60"
                                >
                                  <option value="">— فارغة —</option>
                                  {activeTeacherClasses.map((schoolClass) => (
                                    <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>
                                  ))}
                                </select>
                                <select
                                  value={lesson?.subjectId ?? ''}
                                  onChange={(event) => setTeacherCellSubject(day, period, event.target.value)}
                                  disabled={isPending || !lesson}
                                  aria-label={`مادة حصة ${DAYS[day]} رقم ${toArabicNumber(period)} للمعلم ${activeScheduleTeacher.name}`}
                                  className="mt-1 w-full rounded-md border border-neutral-200 bg-white px-1.5 py-1.5 text-[11px] focus:border-[#155b58] focus:outline-none disabled:opacity-60"
                                >
                                  {!lesson && <option value="">اختر الفصل أولًا</option>}
                                  {cellSubjects.map((subject) => (
                                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                                  ))}
                                </select>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#155b58]/15 pt-5">
          <p className="text-sm text-neutral-500">
            تُحفظ الفصول والمواد والمعلمون والتعيينات والجدول دفعة واحدة.
          </p>
          {saveButton}
        </div>
      </main>
    </div>
  )
}
