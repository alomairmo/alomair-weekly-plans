import rawCurriculum from './curriculum.json'

export type CurriculumLesson = {
  id: string
  title: string
  objectives: string[]
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

export function objectivesFor(subject: string, title: string): string[] {
  if (subject === 'انجليزي') {
    return [
      `يتعرف المفردات والتراكيب الواردة في درس «${title}».`,
      'يستخدم ما تعلمه في جمل قصيرة صحيحة.',
      'يقرأ ويكتب عبارات مرتبطة بموضوع الدرس.',
    ]
  }
  if (subject === 'رياضيات') {
    return [
      `يفهم المفاهيم والقواعد الأساسية في درس «${title}».`,
      'يطبق خطوات الحل على تمارين متنوعة.',
      'يفسر إجاباته ويتحقق من صحة النتائج.',
    ]
  }
  if (subject === 'اللغة العربية') {
    return [
      `يحدد الأفكار والمهارات اللغوية في درس «${title}».`,
      'يطبق ما تعلمه في أمثلة من إنشائه.',
      'يعبر عن أفكاره بلغة سليمة ومنظمة.',
    ]
  }
  if (subject === 'الدراسات الإسلامية' || subject === 'قرن وتفسير ١') {
    return [
      `يحدد المفاهيم والمعاني الأساسية في درس «${title}».`,
      'يستخرج الفوائد والدروس المستفادة من النصوص.',
      'يربط ما تعلمه بسلوكه ومواقف حياته.',
    ]
  }
  if (['علوم', 'أحياء', 'كيمياء', 'فيزياء', 'علوم الفضاء'].includes(subject)) {
    return [
      `يفسر المفاهيم والظواهر العلمية في درس «${title}».`,
      'يربط بين الأدلة والنتائج في مواقف علمية.',
      'يطبق معارفه في نشاط أو موقف حياتي آمن.',
    ]
  }
  if (['الدراسات الاجتماعية', 'تاريخ'].includes(subject)) {
    return [
      `يحدد الحقائق والمفاهيم الأساسية في درس «${title}».`,
      'يربط بين الأحداث والأماكن والنتائج المترتبة عليها.',
      'يلخص أهم ما تعلمه في خريطة أو عرض منظم.',
    ]
  }
  if (['المهارات الرقمية', 'المواطنة الرقمية'].includes(subject)) {
    return [
      `يشرح المفاهيم والمهارات الرقمية في درس «${title}».`,
      'ينفذ تطبيقًا رقميًا يوضح ما تعلمه.',
      'يلتزم قواعد السلامة والاستخدام المسؤول.',
    ]
  }
  if (subject === 'بدنية') {
    return [
      `يؤدي المهارات الحركية المرتبطة بدرس «${title}».`,
      'يطور أداءه من خلال التدريب المنظم.',
      'يلتزم قواعد السلامة والتعاون أثناء الممارسة.',
    ]
  }
  if (subject === 'فنية') {
    return [
      `يتعرف العناصر والأساليب الفنية في درس «${title}».`,
      'ينفذ عملًا فنيًا يوظف ما تعلمه.',
      'يناقش أعماله ويعبر عن أحكامه الفنية.',
    ]
  }
  if (subject === 'المهارات الأسرية') {
    return [
      `يحدد المعارف والمهارات الأسرية في درس «${title}».`,
      'يطبق ما تعلمه في موقف منزلي مناسب.',
      'يلتزم قواعد السلامة وتنظيم الأدوات والوقت.',
    ]
  }
  if (subject === 'التفكير الناقد') {
    return [
      `يحلل الأفكار والمواقف باستخدام درس «${title}».`,
      'يميز بين الآراء والأدلة والاستنتاجات.',
      'يبرر حكمه بأسباب منطقية وواضحة.',
    ]
  }
  return [
    `يحدد المفاهيم والمهارات الأساسية في درس «${title}».`,
    'يطبق ما تعلمه في أمثلة ومواقف متنوعة.',
    'يراجع أداءه ويشرح النتائج التي توصل إليها.',
  ]
}

export function getCurriculumLessons(classId: string, subject: string): CurriculumLesson[] {
  const topics = curriculum.topics[`${classId}|${subject}`] ?? []
  return topics.map((title, index) => ({
    id: String(index + 1),
    title,
    objectives: objectivesFor(subject, title),
    homework: homeworkFor(subject, title),
  }))
}

export function getDefaultLessonId(week: number) {
  return String(week)
}
