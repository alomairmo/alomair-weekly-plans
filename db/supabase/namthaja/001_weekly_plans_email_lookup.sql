-- تحقق خادمي محدود لأداة الخطط الأسبوعية من وجود حساب نمذجة بالبريد.
-- لا ينشئ حسابًا ولا يغيّر بيانات المستخدمين، ولا يكشف البحث للعامة دون سر الخادم.
-- القيمة المخزنة أدناه هي بصمة SHA-256 الحالية لسر الربط، وليست السر نفسه.

begin;

create table public.nl_weekly_plans_access_config (
  id smallint primary key default 1 check (id = 1),
  server_secret_hash bytea not null,
  updated_at timestamptz not null default now()
);

insert into public.nl_weekly_plans_access_config(id, server_secret_hash)
values (1, decode('c4f40ae7b0644db039175c453a026c19e748c6fe833ce7be4914a7c4bda30dd3', 'hex'));

alter table public.nl_weekly_plans_access_config enable row level security;
-- لا سياسات وصول مباشر؛ القراءة الداخلية تتم في الدالة المتحققة فقط.

create function public.nl_weekly_plans_lookup_email(
  p_email text,
  p_server_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_user_id uuid;
  v_account_email text;
begin
  if p_server_secret is null or char_length(p_server_secret) < 32 or not exists (
    select 1 from public.nl_weekly_plans_access_config c
    where c.id = 1 and c.server_secret_hash = digest(p_server_secret, 'sha256')
  ) then
    raise exception 'تعذر التحقق من ربط أداة الخطط' using errcode = '42501';
  end if;

  if char_length(v_email) > 320
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'أدخل بريدًا إلكترونيًا صالحًا' using errcode = '22023';
  end if;

  select u.id, lower(u.email)
  into v_user_id, v_account_email
  from auth.users u
  where u.deleted_at is null
    and lower(u.email) = v_email
  limit 1;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object(
    'found', true,
    'userId', v_user_id,
    'email', v_account_email
  );
end;
$$;

revoke all on function public.nl_weekly_plans_lookup_email(text, text) from public;
grant execute on function public.nl_weekly_plans_lookup_email(text, text) to anon, authenticated;

commit;
