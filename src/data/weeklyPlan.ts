import rawCurriculum from './curriculum.json'

export type CurriculumLesson = {
  id: string
  title: string
  homework: string
}

export type PlanWeek = {
  number: number
  dates: string
  start: string
  end: string
  note?: string
}

const curriculum = rawCurriculum as {
  topics: Record<string, string[]>
}

export const planWeeks: PlanWeek[] = [
  { number: 1, dates: '٢٣–٢٧ أغسطس ٢٠٢٦', start: '2026-08-23', end: '2026-08-27' },
  { number: 2, dates: '٣٠ أغسطس–٣ سبتمبر ٢٠٢٦', start: '2026-08-30', end: '2026-09-03' },
  { number: 3, dates: '٦–١٠ سبتمبر ٢٠٢٦', start: '2026-09-06', end: '2026-09-10' },
  { number: 4, dates: '١٣–١٧ سبتمبر ٢٠٢٦', start: '2026-09-13', end: '2026-09-17' },
  { number: 5, dates: '٢٠–٢٤ سبتمبر ٢٠٢٦', start: '2026-09-20', end: '2026-09-24', note: 'يشمل إجازة اليوم الوطني' },
  { number: 6, dates: '٢٧ سبتمبر–١ أكتوبر ٢٠٢٦', start: '2026-09-27', end: '2026-10-01' },
  { number: 7, dates: '٤–٨ أكتوبر ٢٠٢٦', start: '2026-10-04', end: '2026-10-08' },
  { number: 8, dates: '١١–١٥ أكتوبر ٢٠٢٦', start: '2026-10-11', end: '2026-10-15' },
  { number: 9, dates: '١٨–٢٢ أكتوبر ٢٠٢٦', start: '2026-10-18', end: '2026-10-22' },
  { number: 10, dates: '٢٥–٢٩ أكتوبر ٢٠٢٦', start: '2026-10-25', end: '2026-10-29' },
  { number: 11, dates: '١–٥ نوفمبر ٢٠٢٦', start: '2026-11-01', end: '2026-11-05' },
  { number: 12, dates: '٨–١٢ نوفمبر ٢٠٢٦', start: '2026-11-08', end: '2026-11-12' },
  { number: 13, dates: '١٥–١٩ نوفمبر ٢٠٢٦', start: '2026-11-15', end: '2026-11-19' },
  { number: 14, dates: '٢٩ نوفمبر–٣ ديسمبر ٢٠٢٦', start: '2026-11-29', end: '2026-12-03', note: 'يستأنف بعد إجازة الخريف' },
  { number: 15, dates: '٦–١٠ ديسمبر ٢٠٢٦', start: '2026-12-06', end: '2026-12-10' },
  { number: 16, dates: '١٣–١٧ ديسمبر ٢٠٢٦', start: '2026-12-13', end: '2026-12-17', note: 'مراجعة واستعداد للاختبارات' },
]

export function getInitialWeek() {
  const today = new Date().toISOString().slice(0, 10)
  return planWeeks.find((week) => today >= week.start && today <= week.end)?.number
    ?? (today < planWeeks[0].start ? 1 : today > planWeeks[15].end ? 16 : 14)
}

function homeworkFor(subject: string, title: string) {
  if (subject === 'انجليزي') {
    return `أنجز نشاط كتاب النشاط المرتبط بدرس «${title}»، ثم اكتب خمسة أمثلة من إنشائك.`
  }
  if (subject === 'رياضيات') {
    return `حل تمارين درس «${title}» في الكتاب، مع كتابة خطوات الحل لمسألتين.`
  }
  if (subject === 'اللغة العربية') {
    return `أنجز تمارين درس «${title}»، واكتب مثالين من إنشائك مع ضبط العبارات.`
  }
  if (subject === 'الدراسات الإسلامية' || subject === 'قرن وتفسير ١') {
    return `راجع المقرر في درس «${title}» مع تحسين التلاوة، وأجب عن أسئلة الفهم والتقويم.`
  }
  if (['علوم', 'أحياء', 'كيمياء', 'فيزياء', 'علوم الفضاء'].includes(subject)) {
    return `أجب عن أسئلة درس «${title}»، وسجّل ملاحظة أو تطبيقًا آمنًا مرتبطًا بفكرة الدرس.`
  }
  if (['الدراسات الاجتماعية', 'تاريخ'].includes(subject)) {
    return `لخّص أهم أفكار درس «${title}» في خريطة ذهنية، وأجب عن سؤالين من تقويم الدرس.`
  }
  if (['المهارات الرقمية', 'المواطنة الرقمية'].includes(subject)) {
    return `طبّق مهارة درس «${title}» في ملف رقمي قصير، واحفظ عملك باسم واضح مع مراعاة السلامة.`
  }
  if (subject === 'بدنية') {
    return `تدرّب على مهارة «${title}» مدة ١٥ دقيقة مع الإحماء وقواعد السلامة، وسجّل ملاحظتك.`
  }
  if (subject === 'فنية') {
    return `أنجز تطبيقًا فنيًا صغيرًا على درس «${title}» باستخدام الأدوات المتاحة بأمان.`
  }
  if (subject === 'المهارات الأسرية') {
    return `طبّق نشاطًا منزليًا مرتبطًا بدرس «${title}»، وسجّل ما أنجزته في ثلاثة أسطر.`
  }
  if (subject === 'التفكير الناقد') {
    return `حلّل موقفًا جديدًا باستخدام خطوات درس «${title}»، واكتب استنتاجك مع الدليل.`
  }
  return `أنجز تطبيقًا قصيرًا على درس «${title}» في ورقة عمل منظمة، واستعد لمناقشته في الحصة التالية.`
}

export function getCurriculumLessons(classId: string, subject: string): CurriculumLesson[] {
  const topics = curriculum.topics[`${classId}|${subject}`] ?? []
  return topics.map((title, index) => ({
    id: String(index + 1),
    title,
    homework: homeworkFor(subject, title),
  }))
}

export function getDefaultLessonId(week: number) {
  return String(week)
}
