export type SchoolRole = 'admin' | 'teacher'

export type SchoolSession = {
  token: string
  role: SchoolRole
  teacherId: string | null
}

export type SchoolInfo = {
  id: string
  code: string
  name: string
}

export type SchoolTeacher = {
  id: string
  name: string
}

export type SchoolRegistration = {
  schoolCode: string
  schoolName: string
  session: SchoolSession
}

export type PlatformLoginResult =
  | { status: 'not_linked' }
  | { status: 'choose_school'; schools: SchoolInfo[] }
  | { status: 'authenticated'; school: SchoolInfo; session: SchoolSession }

export type SchoolLinkedAdmin = {
  id: string
  email: string | null
  owner: boolean
  createdAt: string
}

export type SchoolSubject = {
  id: string
  classId: string
  name: string
  curriculumKey: string | null
  sortOrder: number
}

export type SchoolClass = {
  id: string
  name: string
  stage: string
  sortOrder: number
}

export type TeacherAssignment = {
  id: string
  teacherId: string
  classId: string
  subjectId: string
}

export type SchoolLessonSlot = {
  id: string
  classId: string
  subjectId: string
  teacherId: string | null
  day: number
  period: number
}

export type SchoolBootstrap = {
  school: SchoolInfo
  role: SchoolRole
  teacherId: string | null
  classes: SchoolClass[]
  subjects: SchoolSubject[]
  teachers: SchoolTeacher[]
  assignments: TeacherAssignment[]
  lessons: SchoolLessonSlot[]
}

export type CurriculumLesson = {
  id: string
  // دروس المصدر مستقلة عن الأسبوع؛ توزيعها محفوظ في سجل الأسابيع وقد تتكرر.
  week: number | null
  sequence: number
  title: string
  objectives: string[]
  homework: string
}

export type WeeklyPlanEntry = {
  id: string
  classId: string
  subjectId: string
  week: number
  lessonId: string | null
  customTitle: string | null
  objectives: string[] | null
  homework: string | null
  title: string | null
  defaultObjectives: string[]
  defaultHomework: string
  updatedAt: string
}

export type SetupSubjectInput = {
  id: string
  name: string
  curriculum_key: string | null
  sort_order: number
}

export type SetupClassInput = {
  id: string
  name: string
  stage: string
  sort_order: number
  subjects: SetupSubjectInput[]
}

export type SetupTeacherInput = {
  id: string
  name: string
  assignments: Array<{ class_id: string; subject_id: string }>
}

export type SetupLessonInput = {
  id: string | null
  class_id: string
  subject_id: string
  teacher_id: string | null
  day: number
  period: number
}

export type SchoolSetupPayload = {
  schoolName?: string
  classes: SetupClassInput[]
  teachers: SetupTeacherInput[]
  lessons: SetupLessonInput[]
  removeLessonIds?: string[]
}

export type PlanPatch = {
  title?: string
  objectives?: string[]
  homework?: string
}
