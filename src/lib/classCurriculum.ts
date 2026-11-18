import catalog from '@/data/curriculumCatalog.json'

export type CurriculumCatalogCourse = {
  key: string
  stage: string
  grade: string
  name: string
}

export type ImportedClassSubject = {
  name: string
  curriculumKey: string
}

const courses = catalog as CurriculumCatalogCourse[]

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{Script=Arabic}\p{Letter}\p{Number}\x2F]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeGrade(value: string): string {
  const normalized = normalizeText(value)
  const grade = normalized.split('/').map((part) => part.trim()).filter(Boolean).at(-1) ?? normalized
  const withoutStage = grade
    .replace(/^مرحلة (?:الروضة|الابتدائية|المتوسطة|الثانوية|التعليم المستمر|التأهيلية)\s*/, '')
    .replace(/^المرحلة (?:الابتدائية|المتوسطة|الثانوية|التأهيلية)\s*/, '')
  return withoutStage.replace(/^الصف\s+/, '')
}

function stageKind(value: string): string {
  const stage = normalizeText(value)
  if (stage.includes('روضة')) return 'روضة'
  if (stage.includes('بتد')) return 'ابتدائية'
  if (stage.includes('متوسط')) return 'متوسطة'
  if (stage.includes('ثانوي')) return 'ثانوية'
  if (stage.includes('تعليم مستمر')) return 'التعليم المستمر'
  if (stage.includes('تأهيل')) return 'تأهيلية'
  return stage.replace(/^المرحلة\s+/, '').replace(/^مرحلة\s+/, '')
}

export function curriculumGradesForStage(stage: string): string[] {
  const kind = stageKind(stage)
  return [...new Set(
    courses
      .filter((course) => stageKind(course.stage) === kind)
      .map((course) => course.grade),
  )].sort((a, b) => a.localeCompare(b, 'ar'))
}

export function subjectsForClass(className: string, stage: string): ImportedClassSubject[] {
  const name = normalizeText(className)
  const grade = normalizeGrade(className)
  const kind = stageKind(stage)
  if (!name || !grade || !kind) return []

  const matches = courses.filter(
    (course) => stageKind(course.stage) === kind && normalizeGrade(course.grade) === grade,
  )
  if (!matches.length) return []

  const selectedGrade = matches
    .map((course) => course.grade)
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort((a, b) => {
      const exactDifference = Number(normalizeText(b) === name) - Number(normalizeText(a) === name)
      return exactDifference || a.length - b.length || a.localeCompare(b, 'ar')
    })[0]

  const selectedCourses = matches.filter((course) => course.grade === selectedGrade)
  const seen = new Set<string>()
  const subjects: ImportedClassSubject[] = []
  for (const course of selectedCourses) {
    const subjectName = normalizeText(course.name)
    if (!subjectName || seen.has(subjectName)) continue
    seen.add(subjectName)
    subjects.push({ name: course.name, curriculumKey: course.key })
  }
  return subjects
}
