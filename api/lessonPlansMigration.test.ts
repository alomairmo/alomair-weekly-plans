import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { uuid as databaseUuid } from './lessonPlansRouter'

const root = path.resolve(import.meta.dirname, '..')
const read = (name: string) => readFileSync(path.join(root, 'db/supabase', name), 'utf8')
const repair = read('005_repair_lesson_plans.sql')
const schoolSeed = read('006_seed_alomair_school.sql')
const prepareImport = read('007_prepare_curriculum_import.sql')
const finishImport = read('008_finish_curriculum_import.sql')
const linkedAdmins = read('009_linked_school_admins.sql')
const accountLookup = readFileSync(path.join(root, 'db/supabase/namthaja/001_weekly_plans_email_lookup.sql'), 'utf8')
const curriculum = JSON.parse(read('tahdiri-curriculum-import.json')) as {
  source_sha256: string
  courses: Array<{ id: string; key: string }>
  lessons: Array<{ course_id: string; objectives: string[]; homework_text: string }>
  week_entries: Array<{ week: number }>
}

describe('ترحيل إصلاح الخطط الأسبوعية', () => {
  it('يحول الجلسات إلى بصمات ولا يعيد الدوال العامة الخطرة', () => {
    expect(repair).toContain("token_hash = digest(token, 'sha256')")
    expect(repair).toContain("where s.token_hash = digest(p_token, 'sha256')")
    expect(repair).toContain('revoke all on function public.lp_new_session(uuid, text, uuid)')
    expect(repair).toContain('revoke all on function public.lp_apply_plan_internal(text, smallint, uuid[], uuid[], boolean)')
    expect(repair).not.toContain('grant execute on function public.lp_new_session')
    expect(repair).not.toContain('grant execute on function public.lp_auth')
    expect(repair).not.toContain('create or replace function public.lp_plan_json')
    expect(repair).not.toContain('create or replace function public.lp_session(')
  })

  it('يقبل معرفات PostgreSQL المولدة ويرفض الصيغ غير الصالحة', () => {
    expect(databaseUuid.safeParse('911652d2-63b1-ff06-b563-01158fdb4a94').success).toBe(true)
    expect(databaseUuid.safeParse('057373b9-a021-a212-3257-ca4c3bcbcc36').success).toBe(true)
    expect(databaseUuid.safeParse('teacher-id-not-a-uuid').success).toBe(false)
  })

  it('يحافظ على بصمة ربط نمذجة الحالية ولا يستخدم البصمة القديمة', () => {
    expect(repair).toContain("server_secret_hash = decode(value, 'hex')")
    expect(repair).not.toContain('c4f40ae7b0644db039175c453a026c19e748c6fe833ce7be4914a7c4bda30dd3')
    expect(repair).toContain('and (s.platform_owner_id is null or s.platform_owner_id = p_platform_user_id)')
    expect(repair).toContain("if p_code is null and v_count > 1 then")
    expect(repair).toContain("'status', 'choose_school'")
  })

  it('يعيد كتابة التعديلات اليدوية عند التوزيع أو تغيير الدرس فقط', () => {
    expect(repair).toContain('objectives = null,')
    expect(repair).toContain('homework_text = null,')
    expect(repair).toContain('on conflict (class_id, subject_id, week) do nothing')
    expect(repair).toContain("'title', coalesce(e.custom_title, cl.title)")
    expect(repair).toContain('where l.id = p_lesson_id and c.key = v_key')
  })

  it('لا يحذف جداول المستخدمين أو يعطل RLS', () => {
    expect(repair).not.toMatch(/\b(drop\s+table|truncate|disable\s+row\s+level\s+security)\b/i)
    expect(repair).toContain('rename to lp_curriculum_lessons_legacy_ad_hoc')
    expect(repair).toContain('enable row level security')
  })
})

describe('الحسابات الإدارية المرتبطة', () => {
  it('يحفظ المالك الحالي ويدعم الإداريين الإضافيين دون تغيير بيانات الخطط', () => {
    expect(linkedAdmins).toContain('create table public.lp_school_admins')
    expect(linkedAdmins).toContain('select s.id, s.platform_owner_id, null, s.created_at')
    expect(linkedAdmins).toContain('or exists (')
    expect(linkedAdmins).toContain('create function public.lp_add_school_admin')
    expect(linkedAdmins).toContain('create function public.lp_list_school_admins')
    expect(linkedAdmins).toContain('enable row level security')
    expect(linkedAdmins).toContain('revoke all on table public.lp_school_admins from public, anon, authenticated')
    expect(linkedAdmins).not.toMatch(/\b(drop\s+table|truncate|disable\s+row\s+level\s+security)\b/i)
  })

  it('يتحقق من البريد عبر RPC خادمي محمي ويستبعد الحسابات المحذوفة', () => {
    expect(accountLookup).toContain('from auth.users u')
    expect(accountLookup).toContain('u.deleted_at is null')
    expect(accountLookup).toContain("server_secret_hash = digest(p_server_secret, 'sha256')")
    expect(accountLookup).toContain('revoke all on function public.nl_weekly_plans_lookup_email(text, text) from public')
    expect(accountLookup).not.toContain('service_role')
  })
})

describe('بيانات العماير والمنهج', () => {
  it('يهيئ المدرسة بالكود المطلوب دون تغيير كلمة المرور', () => {
    expect(schoolSeed).toContain("set code = '144601'")
    expect(schoolSeed).toContain('from public.alomair_subjects source')
    expect(schoolSeed).toContain('from public.alomair_schedule_lessons source')
    expect(schoolSeed).not.toContain('admin_password_hash =')
    expect(schoolSeed).not.toMatch(/\b(drop\s+table|truncate)\b/i)
  })

  it('يحفظ جميع صفوف المنهج الأصلية وبصمته', () => {
    expect(curriculum.courses).toHaveLength(391)
    expect(curriculum.lessons).toHaveLength(13946)
    expect(curriculum.week_entries).toHaveLength(10828)
    expect(new Set(curriculum.week_entries.map((entry) => entry.week))).toEqual(
      new Set(Array.from({ length: 17 }, (_, index) => index + 1)),
    )
    const sourceHash = createHash('sha256').update(readFileSync(path.join(root, 'db/supabase/003_tahdiri_curriculum.sql'))).digest('hex')
    expect(curriculum.source_sha256).toBe(sourceHash)
  }, 20_000)

  it('يتضمن أهدافًا وواجبات فعلية لجميع دروس مواد العماير', () => {
    const legacyCurriculum = JSON.parse(readFileSync(path.join(root, 'src/data/curriculum.json'), 'utf8'))
    const topics = new Set<string>(Object.keys(legacyCurriculum.topics))
    const courseIds = new Set(curriculum.courses.filter((course) => topics.has(course.key)).map((course) => course.id))
    const lessons = curriculum.lessons.filter((lesson) => courseIds.has(lesson.course_id))
    expect(courseIds.size).toBe(86)
    expect(lessons).toHaveLength(4455)
    expect(lessons.every((lesson) => lesson.objectives.length > 0 && lesson.objectives.length <= 3)).toBe(true)
    expect(lessons.every((lesson) => lesson.homework_text.trim().length > 0)).toBe(true)
  })
})

describe('قناة الاستيراد المؤقتة', () => {
  it('تحمي الاستيراد ببصمة رمز وتحدد حجم الدفعات', () => {
    expect(prepareImport).toContain("config.secret_hash = digest(p_import_secret, 'sha256')")
    expect(prepareImport).toContain("> 500")
    expect(prepareImport).toContain("> 1000")
    expect(prepareImport).not.toContain('ALOMAIR_ADMIN_PASSWORD')
  })

  it('تغلق القناة وتحذف دالتها العامة بعد الاكتمال', () => {
    expect(finishImport).toContain('set enabled = false')
    expect(finishImport).toContain('drop function public.lp_import_curriculum(text, jsonb)')
  })
})
