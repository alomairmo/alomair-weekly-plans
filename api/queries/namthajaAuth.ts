import { TRPCError } from '@trpc/server'
import { z } from 'zod'

// مشروع حسابات منصة نمذجة. المفتاح العلني مطلوب لواجهة Auth، أما هوية المستخدم
// فلا تُقبل إلا بعد تحقق خادم Auth من رمز الوصول في كل عملية ربط.
const NAMTHAJA_SUPABASE_URL = 'https://xpcejnkeljgxgvrviqcb.supabase.co'
const NAMTHAJA_PUBLISHABLE_KEY = 'sb_publishable_UKWqPe5qU97T8-JM5D7hpg_4pU0gjbu'

const platformUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().nullable().optional(),
})

export type NamthajaPlatformUser = z.infer<typeof platformUserSchema>

const emailLookupSchema = z.discriminatedUnion('found', [
  z.object({ found: z.literal(false) }),
  z.object({
    found: z.literal(true),
    userId: z.string().uuid(),
    email: z.string().email(),
  }),
])

export async function verifyNamthajaAccessToken(accessToken: string): Promise<NamthajaPlatformUser> {
  let response: Response
  try {
    response = await fetch(`${NAMTHAJA_SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: NAMTHAJA_PUBLISHABLE_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'تعذر الاتصال بحسابات نمذجة، حاول مرة أخرى.' })
  }

  if (!response.ok) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'جلسة نمذجة غير صالحة أو منتهية، سجّل الدخول إلى الموقع مجددًا.',
    })
  }

  const parsed = platformUserSchema.safeParse(await response.json())
  if (!parsed.success) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'لم تُرجع منصة نمذجة هوية حساب صالحة.' })
  }
  return parsed.data
}

// البحث عن حساب آخر يتم في الخادم فقط عبر RPC محمي ببصمة سر الربط.
// لا يستخدم مفتاح service role ولا ينشئ حسابات ولا يحاول تسجيل الدخول نيابة عن أحد.
export async function lookupNamthajaUserByEmail(
  email: string,
  serverSecret: string,
): Promise<NamthajaPlatformUser | null> {
  let response: Response
  try {
    response = await fetch(`${NAMTHAJA_SUPABASE_URL}/rest/v1/rpc/nl_weekly_plans_lookup_email`, {
      method: 'POST',
      headers: {
        apikey: NAMTHAJA_PUBLISHABLE_KEY,
        Authorization: `Bearer ${NAMTHAJA_PUBLISHABLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_email: email, p_server_secret: serverSecret }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'تعذر الاتصال بحسابات نمذجة، حاول مرة أخرى.' })
  }

  if (!response.ok) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'تعذر التحقق من البريد في حسابات نمذجة.' })
  }

  const parsed = emailLookupSchema.safeParse(await response.json())
  if (!parsed.success) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'لم تُرجع منصة نمذجة نتيجة تحقق صالحة.' })
  }
  return parsed.data.found
    ? { id: parsed.data.userId, email: parsed.data.email }
    : null
}
