import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { createRouter, publicQuery } from './middleware'
import { getSupabase } from './queries/supabase'
import { lookupNamthajaUserByEmail, verifyNamthajaAccessToken } from './queries/namthajaAuth'
import type {
  CurriculumLesson,
  PlatformLoginResult,
  SchoolBootstrap,
  SchoolLinkedAdmin,
  SchoolRegistration,
  SchoolSession,
  SchoolSetupPayload,
  SchoolTeacher,
  WeeklyPlanEntry,
} from '@contracts/lessonPlans'

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().rpc(name, args)
  if (error) {
    throw new TRPCError({
      code: error.code === '42501' ? 'UNAUTHORIZED' : 'BAD_REQUEST',
      message: error.message,
      cause: error,
    })
  }
  return data as T
}

const token = z.string().min(32).max(128)
const platformAccessToken = z.string().min(100).max(8192)
const week = z.number().int().min(1).max(40)
// PostgreSQL UUIDs may be deterministic hashes without RFC version/variant bits.
export const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid UUID')
const scope = z.object({
  token,
  week,
  classIds: z.array(uuid).min(1).max(100),
  subjectIds: z.array(uuid).min(1).max(500),
})

const setupSchema = z.object({
  schoolName: z.string().trim().min(2).max(160).optional(),
  classes: z.array(z.object({
    id: uuid,
    name: z.string().trim().min(1).max(120),
    stage: z.string().trim().min(2).max(80),
    sort_order: z.number().int().min(0),
    subjects: z.array(z.object({
      id: uuid,
      name: z.string().trim().min(1).max(160),
      curriculum_key: z.string().trim().max(240).nullable(),
      sort_order: z.number().int().min(0),
    })).max(40),
  })).max(100),
  teachers: z.array(z.object({
    id: uuid,
    name: z.string().trim().min(2).max(160),
    assignments: z.array(z.object({ class_id: uuid, subject_id: uuid })).max(500),
  })).max(500),
  lessons: z.array(z.object({
    id: uuid.nullable(),
    class_id: uuid,
    subject_id: uuid,
    teacher_id: uuid.nullable(),
    day: z.number().int().min(0).max(4),
    period: z.number().int().min(1).max(7),
  })).max(5000),
  removeLessonIds: z.array(uuid).max(5000).optional(),
})

function platformSecret(ctx: { platformLinkSecret?: string }): string {
  if (!ctx.platformLinkSecret) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'ربط حساب نمذجة غير مهيأ على الخادم.' })
  }
  return ctx.platformLinkSecret
}

export const lessonPlansRouter = createRouter({
  registerSchool: publicQuery
    .input(z.object({
      name: z.string().trim().min(2).max(160),
      password: z.string().min(8).max(128),
      platformAccessToken: platformAccessToken.optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (input.platformAccessToken) {
        const user = await verifyNamthajaAccessToken(input.platformAccessToken)
        return rpc<SchoolRegistration>('lp_register_school_platform', {
          p_name: input.name,
          p_password: input.password,
          p_platform_user_id: user.id,
          p_server_secret: platformSecret(ctx),
        })
      }
      return rpc<SchoolRegistration>('lp_register_school', { p_name: input.name, p_password: input.password })
    }),

  schoolTeachers: publicQuery
    .input(z.object({ code: z.string().trim().regex(/^\d{6}$/) }))
    .query(({ input }) => rpc<SchoolTeacher[]>('lp_school_teachers', { p_code: input.code })),

  login: publicQuery
    .input(z.object({
      code: z.string().trim().regex(/^\d{6}$/),
      role: z.enum(['admin', 'teacher']),
      teacherId: uuid.nullable().optional(),
      password: z.string().max(128).nullable().optional(),
    }))
    .mutation(({ input }) => rpc<SchoolSession>('lp_login', {
      p_code: input.code,
      p_role: input.role,
      p_teacher_id: input.teacherId ?? null,
      p_password: input.password ?? null,
    })),

  platformLogin: publicQuery
    .input(z.object({
      accessToken: platformAccessToken,
      code: z.string().trim().regex(/^\d{6}$/).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = await verifyNamthajaAccessToken(input.accessToken)
      return rpc<PlatformLoginResult>('lp_platform_login', {
        p_code: input.code ?? null,
        p_platform_user_id: user.id,
        p_platform_email: user.email ?? null,
        p_server_secret: platformSecret(ctx),
      })
    }),

  claimPlatformSchool: publicQuery
    .input(z.object({ token, accessToken: platformAccessToken }))
    .mutation(async ({ input, ctx }) => {
      const user = await verifyNamthajaAccessToken(input.accessToken)
      return rpc<boolean>('lp_claim_school', {
        p_token: input.token,
        p_platform_user_id: user.id,
        p_server_secret: platformSecret(ctx),
      })
    }),

  linkedAdmins: publicQuery
    .input(z.object({ token }))
    .query(({ input }) => rpc<SchoolLinkedAdmin[]>('lp_list_school_admins', {
      p_token: input.token,
    })),

  addLinkedAdmin: publicQuery
    .input(z.object({
      token,
      email: z.string().trim().toLowerCase().email('أدخل بريدًا إلكترونيًا صالحًا').max(320),
    }))
    .mutation(async ({ input, ctx }) => {
      const account = await lookupNamthajaUserByEmail(input.email, platformSecret(ctx))
      if (!account) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'لا يوجد حساب مسجل في نمذجة التعلم بهذا البريد.',
        })
      }
      return rpc<SchoolLinkedAdmin>('lp_add_school_admin', {
        p_token: input.token,
        p_platform_user_id: account.id,
        p_email: account.email ?? input.email,
        p_server_secret: platformSecret(ctx),
      })
    }),

  logout: publicQuery
    .input(z.object({ token }))
    .mutation(({ input }) => rpc<boolean>('lp_logout', { p_token: input.token })),

  bootstrap: publicQuery
    .input(z.object({ token }))
    .query(({ input }) => rpc<SchoolBootstrap>('lp_bootstrap', { p_token: input.token })),

  saveSetup: publicQuery
    .input(z.object({ token, payload: setupSchema }))
    .mutation(({ input }) => rpc<SchoolBootstrap>('lp_save_setup', {
      p_token: input.token,
      p_payload: input.payload satisfies SchoolSetupPayload,
    })),

  curriculum: publicQuery
    .input(z.object({ token, subjectId: uuid }))
    .query(({ input }) => rpc<CurriculumLesson[]>('lp_curriculum', {
      p_token: input.token,
      p_subject_id: input.subjectId,
    })),

  plan: publicQuery
    .input(z.object({ token, week }))
    .query(({ input }) => rpc<WeeklyPlanEntry[]>('lp_get_plan', {
      p_token: input.token,
      p_week: input.week,
    })),

  applyPlan: publicQuery
    .input(scope)
    .mutation(({ input }) => rpc<{ inserted: number; reset: number; plan: WeeklyPlanEntry[] }>('lp_apply_plan', {
      p_token: input.token,
      p_week: input.week,
      p_class_ids: input.classIds,
      p_subject_ids: input.subjectIds,
    })),

  setPlanLesson: publicQuery
    .input(z.object({
      token,
      classId: uuid,
      subjectId: uuid,
      week,
      lessonId: uuid.nullable(),
    }))
    .mutation(({ input }) => rpc<WeeklyPlanEntry[]>('lp_set_plan_lesson', {
      p_token: input.token,
      p_class_id: input.classId,
      p_subject_id: input.subjectId,
      p_week: input.week,
      p_lesson_id: input.lessonId,
    })),

  updatePlan: publicQuery
    .input(z.object({
      token,
      classId: uuid,
      subjectId: uuid,
      week,
      patch: z.object({
        title: z.string().max(1000).optional(),
        objectives: z.array(z.string().max(1000)).max(3).optional(),
        homework: z.string().max(4000).optional(),
      }).refine((value) => Object.keys(value).length > 0, 'لا توجد تعديلات'),
    }))
    .mutation(({ input }) => rpc<WeeklyPlanEntry[]>('lp_update_plan', {
      p_token: input.token,
      p_class_id: input.classId,
      p_subject_id: input.subjectId,
      p_week: input.week,
      p_patch: input.patch,
    })),

  bulkHomework: publicQuery
    .input(scope.extend({ homework: z.string().trim().min(1).max(4000) }))
    .mutation(({ input }) => rpc<{ updated: number; plan: WeeklyPlanEntry[] }>('lp_bulk_homework', {
      p_token: input.token,
      p_week: input.week,
      p_class_ids: input.classIds,
      p_subject_ids: input.subjectIds,
      p_homework: input.homework,
    })),
})
