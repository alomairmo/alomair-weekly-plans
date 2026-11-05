import html2canvas from 'html2canvas-pro'
import { jsPDF } from 'jspdf'
import JSZip from 'jszip'
import { getCurriculumLessons, planWeeks } from '@/data/weeklyPlan'

type ScheduleLesson = {
  teacherId: number
  classId: string
  subject: string
}

type Teacher = { id: number; name: string }
type SchoolClass = { id: string; name: string }

export type PlanOverride = {
  classId: string
  subject: string
  week: number
  lessonId: string
  homeworkText: string | null
  objectives: string[] | null
}

type ExportInput = {
  schoolClass: SchoolClass
  week: number
  lessons: ScheduleLesson[]
  teachers: Teacher[]
  overrides: PlanOverride[]
}

const arabicDigits = '٠١٢٣٤٥٦٧٨٩'
const toArabicNumber = (value: number) =>
  String(value).replace(/\d/g, (digit) => arabicDigits[Number(digit)])

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character]!)
}

function planRows({ schoolClass, week, lessons, teachers, overrides }: ExportInput) {
  const classLessons = lessons.filter((lesson) => lesson.classId === schoolClass.id)
  const subjects = [...new Set(classLessons.map((lesson) => lesson.subject))]
  return subjects.map((subject) => {
    const subjectLessons = classLessons.filter((lesson) => lesson.subject === subject)
    const override = overrides.find(
      (item) => item.classId === schoolClass.id && item.subject === subject && item.week === week,
    )
    const lessonId = override?.lessonId ?? String(week)
    const curriculumLessons = getCurriculumLessons(schoolClass.id, subject)
    const lesson = curriculumLessons.find((item) => item.id === lessonId)
      ?? curriculumLessons[week - 1]
    const homework = override?.lessonId === lesson.id && override.homeworkText
      ? override.homeworkText
      : lesson.homework
    const objectives = override?.lessonId === lesson.id && override.objectives?.length
      ? override.objectives.slice(0, 3)
      : lesson.objectives
    const teacherNames = [...new Set(subjectLessons.map((item) => item.teacherId))]
      .map((id) => teachers[id]?.name)
      .filter(Boolean)
      .join('، ')
    return { subject, lesson, objectives, homework, teacherNames, periods: subjectLessons.length }
  })
}

function planFileName(schoolClass: SchoolClass, week: number) {
  return `الخطة الأسبوعية - ${schoolClass.name} - الأسبوع ${toArabicNumber(week)}.pdf`
}

const classFileIds: Record<string, string> = {
  'ب٤': 'b4',
  'ب٥': 'b5',
  'ب٦': 'b6',
  'م١': 'm1',
  'م٢': 'm2',
  'م٣': 'm3',
  'ث١': 't1',
  'ث٢': 't2',
  'ث٣': 't3',
}

function planDownloadFileName(schoolClass: SchoolClass, week: number) {
  return `weekly-plan-${classFileIds[schoolClass.id] ?? 'class'}-week-${week}.pdf`
}

async function createPlanPdf(input: ExportInput) {
  const { schoolClass, week } = input
  const rows = planRows(input)
  const currentWeek = planWeeks[week - 1]
  const host = document.createElement('div')
  host.dir = 'rtl'
  host.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    'width:1400px',
    'background:#ffffff',
    'color:#202020',
    'font-family:Tajawal,Tahoma,Arial,sans-serif',
    'padding:30px',
    'box-sizing:border-box',
    'z-index:-1',
  ].join(';')

  const rowsHtml = rows.map((row) => `
    <div style="display:grid;grid-template-columns:170px 310px 400px 400px;gap:20px;align-items:center;min-height:68px;padding:9px 12px;border-bottom:1px solid #dedede;box-sizing:border-box;">
      <div>
        <div style="font-size:19px;font-weight:800;line-height:1.4;">${escapeHtml(row.subject)}</div>
        <div style="font-size:13px;color:#6b6b6b;line-height:1.5;">${escapeHtml(row.teacherNames)}</div>
        <div style="font-size:12px;color:#a01768;font-weight:700;">${toArabicNumber(row.periods)} ${row.periods === 1 ? 'حصة' : 'حصص'} هذا الأسبوع</div>
      </div>
      <div style="font-size:15px;font-weight:700;line-height:1.5;">${escapeHtml(row.lesson.title)}</div>
      <ol style="margin:0;padding-right:21px;font-size:13px;line-height:1.5;">${row.objectives.map((objective) => `<li style="margin-bottom:4px;">${escapeHtml(objective)}</li>`).join('')}</ol>
      <div style="font-size:14px;line-height:1.55;white-space:pre-wrap;">${escapeHtml(row.homework)}</div>
    </div>
  `).join('')

  host.innerHTML = `
    <div style="border:2px solid #202020;padding:0;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:30px;padding:18px 22px 14px;border-bottom:2px solid #202020;">
        <div>
          <div style="font-size:14px;color:#6b6b6b;">مجمع العماير — الفصل الأول ١٤٤٨هـ</div>
          <div style="font-size:30px;font-weight:800;line-height:1.35;">الخطة الأسبوعية — ${escapeHtml(schoolClass.name)}</div>
          <div style="font-size:16px;color:#a01768;font-weight:700;">${escapeHtml(schoolClass.id)} · الأسبوع ${toArabicNumber(week)} من ١٦ · ${escapeHtml(currentWeek.dates)}</div>
        </div>
        <div style="font-size:14px;color:#6b6b6b;white-space:nowrap;">${toArabicNumber(rows.length)} مواد</div>
      </div>
      <div style="padding:7px 22px;background:#fff5fa;color:#6b6b6b;font-size:12px;border-bottom:1px solid #dedede;">
        توزيع استرشادي قابل للتعديل، وليس توزيعًا رسميًا صادرًا عن المدرسة. يشمل التعديلات المحفوظة حتى لحظة التنزيل.
      </div>
      <div style="display:grid;grid-template-columns:170px 310px 400px 400px;gap:20px;padding:9px 12px;background:#f5f5f5;border-bottom:1px solid #202020;font-size:14px;font-weight:800;box-sizing:border-box;">
        <div>المادة والمعلم</div><div>الدرس المفترض</div><div>أهداف الدرس</div><div>الواجب المرتبط</div>
      </div>
      ${rowsHtml}
      <div style="display:flex;justify-content:space-between;padding:9px 22px;color:#6b6b6b;font-size:11px;">
        <span>الدروس والأهداف والواجبات قابلة للتحديث من صفحة الجدول</span><span>صفحة واحدة</span>
      </div>
    </div>
  `

  document.body.appendChild(host)
  try {
    await document.fonts.ready
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const canvas = await html2canvas(host, {
      scale: 1.5,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    })
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
    pdf.setProperties({ title: planFileName(schoolClass, week), subject: 'الخطة الأسبوعية للفصل' })
    const maxWidth = 287
    const maxHeight = 200
    const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height)
    const width = canvas.width * ratio
    const height = canvas.height * ratio
    pdf.addImage(
      canvas.toDataURL('image/png'),
      'PNG',
      (297 - width) / 2,
      (210 - height) / 2,
      width,
      height,
      undefined,
      'FAST',
    )
    return pdf
  } finally {
    host.remove()
  }
}

export async function downloadClassPlanPdf(input: ExportInput) {
  const pdf = await createPlanPdf(input)
  pdf.save(planDownloadFileName(input.schoolClass, input.week))
}

export async function downloadAllPlansZip({
  classes,
  week,
  lessons,
  teachers,
  overrides,
  onProgress,
}: {
  classes: SchoolClass[]
  week: number
  lessons: ScheduleLesson[]
  teachers: Teacher[]
  overrides: PlanOverride[]
  onProgress?: (completed: number, total: number) => void
}) {
  const zip = new JSZip()
  for (const [index, schoolClass] of classes.entries()) {
    const pdf = await createPlanPdf({ schoolClass, week, lessons, teachers, overrides })
    zip.file(planFileName(schoolClass, week), pdf.output('arraybuffer'))
    onProgress?.(index + 1, classes.length)
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `weekly-plans-week-${week}.zip`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
