// أدوات نقية لتبويب «المشاركة»: بناء رابط الدخول المباشر ورسالة المشاركة ونسخ النصوص.
// الرابط العام لا يتضمن كلمة مرور أو أي أسرار؛ كود المدرسة وحده يكفي للدخول كمعلم.

export const SCHOOL_DIRECT_LINK_BASE = 'https://namthaja.app/Lesson-Plan'

export function toArabicNumber(value: number): string {
  return value.toLocaleString('ar-EG')
}

export function buildSchoolDirectLink(code: string): string {
  const normalized = code.trim()
  return `${SCHOOL_DIRECT_LINK_BASE}?code=${encodeURIComponent(normalized)}`
}

export type TeacherShareMessageInput = {
  schoolName: string
  week: number
  link: string
  weekDates?: string
}

export function buildTeacherShareMessage({
  schoolName,
  week,
  link,
  weekDates,
}: TeacherShareMessageInput): string {
  const weekLabel = `الأسبوع ${toArabicNumber(week)}${weekDates ? ` (${weekDates})` : ''}`
  return [
    'السلام عليكم ورحمة الله وبركاته،',
    '',
    `زملائي معلمي ${schoolName}،`,
    '',
    `نرجو منكم تعبئة الخطة الأسبوعية لـ${weekLabel} عبر الرابط التالي:`,
    link,
    '',
    'خطوات التعبئة:',
    `${toArabicNumber(1)}. افتح الرابط، وسيُدخل كود المدرسة تلقائيًا دون الحاجة لكتابته.`,
    `${toArabicNumber(2)}. اختر الدخول بصفة «معلم» ثم اختر اسمك من القائمة.`,
    `${toArabicNumber(3)}. اختر الأسبوع المطلوب والفصول المسندة إليك.`,
    `${toArabicNumber(4)}. اضغط «توزيع تلقائي» لتوزيع الدروس على حصصك وفق الجدول الدراسي.`,
    `${toArabicNumber(5)}. عدّل عناوين الدروس والأهداف كما يناسب خطتك.`,
    `${toArabicNumber(6)}. خصّص الواجبات لكل فصل على حدة، أو استخدم «توحيد الواجب للفصول والمواد المحددة».`, 
    '',
    'شكرًا لتعاونكم.',
  ].join('\n')
}
