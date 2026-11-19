-- حسابات إدارية متعددة مرتبطة بنمذجة، مع الاحتفاظ بالمالك الحالي وكلمة المرور ودخول المعلم.
-- النطاق: كائنات public.lp_* فقط. لا حذف أو تعديل لبيانات المدارس والخطط والجداول.

begin;

create table public.lp_school_admins (
  school_id uuid not null references public.lp_schools(id) on delete restrict,
  platform_user_id uuid not null,
  email text,
  created_at timestamptz not null default now(),
  primary key (school_id, platform_user_id),
  check (
    email is null or (
      email = lower(btrim(email))
      and char_length(email) <= 320
      and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  )
);

create unique index lp_school_admins_email_idx
  on public.lp_school_admins(school_id, email)
  where email is not null;
create index lp_school_admins_user_idx
  on public.lp_school_admins(platform_user_id, school_id);

-- يبقى المالك الحالي ظاهرًا وصالحًا للدخول. يُستكمل بريده عند دخوله التالي بنمذجة.
insert into public.lp_school_admins(school_id, platform_user_id, email, created_at)
select s.id, s.platform_owner_id, null, s.created_at
from public.lp_schools s
where s.platform_owner_id is not null;

alter table public.lp_school_admins enable row level security;
revoke all on table public.lp_school_admins from public, anon, authenticated;
-- لا وصول مباشر للجدول؛ كل العمليات عبر دوال متحققة من جلسة الإدارة.

create or replace function public.lp_platform_login(
  p_code text,
  p_platform_user_id uuid,
  p_platform_email text,
  p_server_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_school public.lp_schools%rowtype;
  v_schools jsonb;
  v_count integer;
  v_email text := nullif(lower(btrim(coalesce(p_platform_email, ''))), '');
begin
  perform public.lp_assert_platform_secret(p_server_secret);
  if p_platform_user_id is null then
    raise exception 'حساب نمذجة غير صالح' using errcode = '42501';
  end if;
  if p_code is not null and btrim(p_code) !~ '^[0-9]{6}$' then
    raise exception 'كود المدرسة غير صالح' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'code', s.code, 'name', s.name
  ) order by s.created_at, s.name), '[]'::jsonb)
  into v_schools
  from public.lp_schools s
  where (
    s.platform_owner_id = p_platform_user_id
    or exists (
      select 1 from public.lp_school_admins a
      where a.school_id = s.id and a.platform_user_id = p_platform_user_id
    )
  )
  and (p_code is null or s.code = btrim(p_code));

  select count(*) into v_count
  from public.lp_schools s
  where (
    s.platform_owner_id = p_platform_user_id
    or exists (
      select 1 from public.lp_school_admins a
      where a.school_id = s.id and a.platform_user_id = p_platform_user_id
    )
  )
  and (p_code is null or s.code = btrim(p_code));

  if v_count = 0 then
    return jsonb_build_object('status', 'not_linked');
  end if;
  if p_code is null and v_count > 1 then
    return jsonb_build_object('status', 'choose_school', 'schools', v_schools);
  end if;

  select * into v_school
  from public.lp_schools s
  where (
    s.platform_owner_id = p_platform_user_id
    or exists (
      select 1 from public.lp_school_admins a
      where a.school_id = s.id and a.platform_user_id = p_platform_user_id
    )
  )
  and (p_code is null or s.code = btrim(p_code))
  order by s.created_at, s.name
  limit 1;

  insert into public.lp_school_admins(school_id, platform_user_id, email)
  values (v_school.id, p_platform_user_id, v_email)
  on conflict (school_id, platform_user_id) do update
    set email = coalesce(excluded.email, public.lp_school_admins.email);

  return jsonb_build_object(
    'status', 'authenticated',
    'school', jsonb_build_object('id', v_school.id, 'code', v_school.code, 'name', v_school.name),
    'session', public.lp_new_session(v_school.id, 'admin')
  );
end;
$$;

-- توافق مؤقت مع الخادم السابق أثناء النشر؛ الدخول يشمل الحسابات الإضافية أيضًا.
create or replace function public.lp_platform_login(
  p_code text,
  p_platform_user_id uuid,
  p_server_secret text
)
returns jsonb
language sql
security definer
set search_path = public, extensions, pg_temp
as $$
  select public.lp_platform_login(p_code, p_platform_user_id, null, p_server_secret);
$$;

create or replace function public.lp_register_school_platform(
  p_name text,
  p_password text,
  p_platform_user_id uuid,
  p_server_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_school public.lp_schools%rowtype;
  v_code text;
begin
  perform public.lp_assert_platform_secret(p_server_secret);
  if p_platform_user_id is null then
    raise exception 'حساب نمذجة غير صالح' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'أدخل اسم المدرسة' using errcode = '22023';
  end if;
  if char_length(coalesce(p_password, '')) < 8 then
    raise exception 'كلمة مرور الإدارة يجب ألا تقل عن ٨ أحرف' using errcode = '22023';
  end if;

  loop
    v_code := lpad(floor(random() * 1000000)::text, 6, '0');
    exit when not exists (select 1 from public.lp_schools where code = v_code);
  end loop;

  insert into public.lp_schools(code, name, admin_password_hash, platform_owner_id)
  values (v_code, btrim(p_name), crypt(p_password, gen_salt('bf')), p_platform_user_id)
  returning * into v_school;

  insert into public.lp_school_admins(school_id, platform_user_id)
  values (v_school.id, p_platform_user_id);

  return jsonb_build_object(
    'schoolCode', v_school.code,
    'schoolName', v_school.name,
    'session', public.lp_new_session(v_school.id, 'admin')
  );
end;
$$;

create or replace function public.lp_claim_school(
  p_token text,
  p_platform_user_id uuid,
  p_server_secret text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v record;
begin
  perform public.lp_assert_platform_secret(p_server_secret);
  if p_platform_user_id is null then
    raise exception 'حساب نمذجة غير صالح' using errcode = '42501';
  end if;
  select * into v from public.lp_auth(p_token);
  if v.role <> 'admin' then
    raise exception 'ربط المدرسة متاح للإدارة فقط' using errcode = '42501';
  end if;

  update public.lp_schools s
  set platform_owner_id = p_platform_user_id
  where s.id = v.school_id
    and (s.platform_owner_id is null or s.platform_owner_id = p_platform_user_id);

  if not found then
    raise exception 'هذه المدرسة مرتبطة بحساب نمذجة آخر' using errcode = '42501';
  end if;

  insert into public.lp_school_admins(school_id, platform_user_id)
  values (v.school_id, p_platform_user_id)
  on conflict (school_id, platform_user_id) do nothing;
  return true;
end;
$$;

create function public.lp_list_school_admins(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v record;
begin
  select * into v from public.lp_auth(p_token);
  if v.role <> 'admin' then
    raise exception 'إدارة الحسابات متاحة للإداري فقط' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.platform_user_id,
      'email', a.email,
      'owner', s.platform_owner_id = a.platform_user_id,
      'createdAt', a.created_at
    ) order by (s.platform_owner_id = a.platform_user_id) desc, a.created_at, a.platform_user_id)
    from public.lp_school_admins a
    join public.lp_schools s on s.id = a.school_id
    where a.school_id = v.school_id
  ), '[]'::jsonb);
end;
$$;

create function public.lp_add_school_admin(
  p_token text,
  p_platform_user_id uuid,
  p_email text,
  p_server_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v record;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_admin jsonb;
begin
  perform public.lp_assert_platform_secret(p_server_secret);
  select * into v from public.lp_auth(p_token);
  if v.role <> 'admin' then
    raise exception 'إضافة الحسابات متاحة للإداري فقط' using errcode = '42501';
  end if;
  if p_platform_user_id is null then
    raise exception 'حساب نمذجة غير صالح' using errcode = '22023';
  end if;
  if char_length(v_email) > 320
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'أدخل بريدًا إلكترونيًا صالحًا' using errcode = '22023';
  end if;

  insert into public.lp_school_admins(school_id, platform_user_id, email)
  values (v.school_id, p_platform_user_id, v_email)
  on conflict (school_id, platform_user_id) do update set email = excluded.email;

  select jsonb_build_object(
    'id', a.platform_user_id,
    'email', a.email,
    'owner', s.platform_owner_id = a.platform_user_id,
    'createdAt', a.created_at
  ) into v_admin
  from public.lp_school_admins a
  join public.lp_schools s on s.id = a.school_id
  where a.school_id = v.school_id and a.platform_user_id = p_platform_user_id;

  return v_admin;
end;
$$;

revoke all on function public.lp_list_school_admins(text) from public;
revoke all on function public.lp_add_school_admin(text, uuid, text, text) from public;
grant execute on function public.lp_platform_login(text, uuid, text) to anon, authenticated;
grant execute on function public.lp_platform_login(text, uuid, text, text) to anon, authenticated;
grant execute on function public.lp_register_school_platform(text, text, uuid, text) to anon, authenticated;
grant execute on function public.lp_claim_school(text, uuid, text) to anon, authenticated;
grant execute on function public.lp_list_school_admins(text) to anon, authenticated;
grant execute on function public.lp_add_school_admin(text, uuid, text, text) to anon, authenticated;

commit;
