-- =====================================================================
--  마음 특별한 하루 30일  ·  Supabase 스키마
--  사용법: Supabase 대시보드 → SQL Editor → New query → 전체 붙여넣기 → Run
--  (여러 번 실행해도 안전하도록 작성되어 있습니다)
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. 테이블
-- ---------------------------------------------------------------------

-- 학급 (30일 기간 설정 포함)
create table if not exists public.classes (
  id              text primary key,              -- 예: '1-1'
  grade           int  not null,
  class_no        int  not null,
  name            text not null,
  start_date      date not null default ((now() at time zone 'Asia/Seoul')::date),
  total_days      int  not null default 30 check (total_days between 1 and 120),
  include_weekend boolean not null default false
);

insert into public.classes (id, grade, class_no, name) values
  ('1-1', 1, 1, '1학년 1반'),
  ('2-1', 2, 1, '2학년 1반'),
  ('3-1', 3, 1, '3학년 1반')
on conflict (id) do nothing;

-- 가입 코드 (학생/교사). 앱에서는 읽을 수 없습니다.
create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);
insert into public.app_settings (key, value) values
  ('student_code', 'maeum2026'),     -- ★ 학생 등록 코드: 꼭 바꿔 주세요
  ('teacher_code', 'teacher2026')    -- ★ 교사 등록 코드: 꼭 바꿔 주세요
on conflict (key) do nothing;

-- 사용자 정보 (학생/교사)
create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  role       text not null check (role in ('student', 'teacher')),
  class_id   text references public.classes,
  number     int,
  name       text not null check (char_length(name) between 1 and 20),
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_class_number
  on public.profiles (class_id, number) where role = 'student';

-- 마음돌봄 미션
create table if not exists public.missions (
  id     serial primary key,
  text   text not null,
  grp    text not null default 'green' check (grp in ('green', 'yellow', 'purple')),
  active boolean not null default true,
  sort   int not null default 0
);

insert into public.missions (id, text, grp, sort)
select * from (values
  (1,  '대화를 할 때 한 학생의 말을 끝까지 들어보기',            'green',  1),
  (2,  '"좋아, 같이 해보자!" 하고 답해보기',                     'green',  2),
  (3,  '누군가를 대신 할 수 있는 일을 찾고 실행하기',            'green',  3),
  (4,  '눈길이 가는 학생/선생님에게 안부 건네기',                'green',  4),
  (5,  '나와 다른 의견에 "그럴 수도 있겠다"고 말하기',           'yellow', 5),
  (6,  '학급의 문제를 함께 해결하는 시간 갖기',                  'yellow', 6),
  (7,  '"누가" 대신 "무엇을"로 바꾸어 문제 해결하기',            'yellow', 7),
  (8,  '"괜찮아, 그럴 때도 있지" 하고 격려하기',                 'yellow', 8),
  (9,  '누군가의 노력을 구체적으로 칭찬하기',                    'purple', 9),
  (10, '오늘 내 마음의 온도를 숫자로 표현하기',                  'purple', 10),
  (11, '함께 한 시간에 감사하는 표현하기(전하기)',               'purple', 11),
  (12, '나를 다독이는 짧은 메모로 하루 시작하기',                'purple', 12)
) as v(id, text, grp, sort)
where not exists (select 1 from public.missions);
select setval(pg_get_serial_sequence('public.missions', 'id'),
              greatest((select max(id) from public.missions), 1));

-- 하루 기록 (학생 1명 × 하루 1줄 : 아침 → 미션 → 저녁)
create table if not exists public.daily_entries (
  id             bigserial primary key,
  student_id     uuid not null references public.profiles on delete cascade,
  class_id       text not null references public.classes,
  entry_date     date not null,
  -- 아침 조회
  am_weather     smallint check (am_weather between 1 and 5),
  am_temp        smallint check (am_temp between 0 and 100),
  am_reason      text,
  am_at          timestamptz,
  -- 오늘의 미션
  mission_id     int references public.missions,
  pledge         text,
  pledged_at     timestamptz,
  -- 저녁 종례
  pm_weather     smallint check (pm_weather between 1 and 5),
  pm_temp        smallint check (pm_temp between 0 and 100),
  pm_reason      text,
  pm_at          timestamptz,
  mission_result text check (mission_result in ('done', 'partial', 'not')),
  reflection     text,
  updated_at     timestamptz not null default now(),
  unique (student_id, entry_date)
);
create index if not exists daily_entries_class_date on public.daily_entries (class_id, entry_date);

-- ---------------------------------------------------------------------
-- 2. 도우미 함수
-- ---------------------------------------------------------------------

create or replace function public.kst_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Seoul')::date $$;

create or replace function public.is_teacher() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher')
$$;

-- 랜덤 미션: 최근 (활성 미션 수 ÷ 2)일 동안 받은 미션은 제외하고 뽑기
create or replace function public.pick_mission(p_student uuid) returns int
language sql volatile security definer set search_path = public as $$
  select m.id from public.missions m
  where m.active
    and m.id not in (
      select de.mission_id from public.daily_entries de
      where de.student_id = p_student and de.mission_id is not null
      order by de.entry_date desc
      limit (select count(*) / 2 from public.missions where active)
    )
  order by random()
  limit 1
$$;

-- ---------------------------------------------------------------------
-- 3. 가입 (학급 코드 / 교사 코드 확인)
-- ---------------------------------------------------------------------

create or replace function public.check_signup(
  p_role text, p_code text, p_class_id text default null, p_number int default null)
returns text language plpgsql security definer set search_path = public as $$
begin
  if p_role = 'teacher' then
    if p_code is distinct from (select value from public.app_settings where key = 'teacher_code') then
      return '교사 코드가 올바르지 않아요.';
    end if;
    return null;
  end if;
  if p_code is distinct from (select value from public.app_settings where key = 'student_code') then
    return '학급 코드가 올바르지 않아요. 선생님께 확인해 주세요.';
  end if;
  if not exists (select 1 from public.classes where id = p_class_id) then
    return '학급을 선택해 주세요.';
  end if;
  if p_number is null or p_number < 1 or p_number > 60 then
    return '번호를 확인해 주세요.';
  end if;
  if exists (select 1 from public.profiles where class_id = p_class_id and number = p_number and role = 'student') then
    return '이미 등록된 번호예요. 비밀번호를 잊었다면 선생님께 말씀해 주세요.';
  end if;
  return null;
end $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m   jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  msg text;
begin
  msg := public.check_signup(m->>'role', m->>'join_code', m->>'class_id', nullif(m->>'number', '')::int);
  if msg is not null then raise exception '%', msg; end if;

  if m->>'role' = 'teacher' then
    insert into public.profiles (id, role, name)
    values (new.id, 'teacher', coalesce(nullif(m->>'name', ''), '선생님'));
  else
    insert into public.profiles (id, role, class_id, number, name)
    values (new.id, 'student', m->>'class_id', (m->>'number')::int, m->>'name');
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 4. 학생 기록 함수 (날짜는 서버가 한국 시간으로 정함 → 조작 불가)
-- ---------------------------------------------------------------------

create or replace function public.submit_morning(p_weather int, p_temp int, p_reason text)
returns public.daily_entries language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  e  public.daily_entries;
begin
  select * into me from public.profiles where id = auth.uid() and role = 'student';
  if not found then raise exception '학생 계정만 기록할 수 있어요.'; end if;
  if p_weather is null or p_weather not between 1 and 5 then raise exception '마음 날씨를 골라 주세요.'; end if;

  insert into public.daily_entries
    (student_id, class_id, entry_date, am_weather, am_temp, am_reason, am_at, mission_id)
  values
    (me.id, me.class_id, public.kst_today(), p_weather,
     least(greatest(coalesce(p_temp, 50), 0), 100), left(p_reason, 500), now(),
     public.pick_mission(me.id))
  on conflict (student_id, entry_date) do update set
    am_weather = excluded.am_weather,
    am_temp    = excluded.am_temp,
    am_reason  = excluded.am_reason,
    am_at      = coalesce(daily_entries.am_at, now()),
    mission_id = coalesce(daily_entries.mission_id, excluded.mission_id),
    updated_at = now()
  returning * into e;
  return e;
end $$;

create or replace function public.set_pledge(p_pledge text)
returns public.daily_entries language plpgsql security definer set search_path = public as $$
declare e public.daily_entries;
begin
  update public.daily_entries
     set pledge = left(p_pledge, 300), pledged_at = coalesce(pledged_at, now()), updated_at = now()
   where student_id = auth.uid() and entry_date = public.kst_today() and mission_id is not null
  returning * into e;
  if not found then raise exception '아침 마음을 먼저 등록해 주세요.'; end if;
  return e;
end $$;

create or replace function public.submit_evening(
  p_weather int, p_temp int, p_reason text, p_result text, p_reflection text)
returns public.daily_entries language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  e  public.daily_entries;
begin
  select * into me from public.profiles where id = auth.uid() and role = 'student';
  if not found then raise exception '학생 계정만 기록할 수 있어요.'; end if;
  if p_weather is null or p_weather not between 1 and 5 then raise exception '마음 날씨를 골라 주세요.'; end if;
  if p_result is not null and p_result not in ('done', 'partial', 'not') then raise exception '미션 결과가 올바르지 않아요.'; end if;

  insert into public.daily_entries
    (student_id, class_id, entry_date, pm_weather, pm_temp, pm_reason, pm_at, reflection)
  values
    (me.id, me.class_id, public.kst_today(), p_weather,
     least(greatest(coalesce(p_temp, 50), 0), 100), left(p_reason, 500), now(), left(p_reflection, 500))
  on conflict (student_id, entry_date) do update set
    pm_weather     = excluded.pm_weather,
    pm_temp        = excluded.pm_temp,
    pm_reason      = excluded.pm_reason,
    pm_at          = coalesce(daily_entries.pm_at, now()),
    mission_result = case when daily_entries.mission_id is null then null else p_result end,
    reflection     = excluded.reflection,
    updated_at     = now()
  returning * into e;
  return e;
end $$;

-- 교사: 학생 비밀번호 재설정 (기록은 그대로 유지)
create or replace function public.teacher_reset_pin(p_student uuid, p_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_teacher() then raise exception '권한이 없어요.'; end if;
  if p_pin is null or char_length(p_pin) < 6 then raise exception '비밀번호는 6자리 이상이어야 해요.'; end if;
  if not exists (select 1 from public.profiles where id = p_student and role = 'student') then
    raise exception '학생을 찾을 수 없어요.';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(p_pin, extensions.gen_salt('bf')), updated_at = now()
   where id = p_student;
end $$;

-- 함수 실행 권한 정리
revoke execute on function public.pick_mission(uuid)                         from public, anon, authenticated;
revoke execute on function public.handle_new_user()                         from public, anon, authenticated;
revoke execute on function public.submit_morning(int, int, text)            from public, anon;
revoke execute on function public.set_pledge(text)                          from public, anon;
revoke execute on function public.submit_evening(int, int, text, text, text) from public, anon;
revoke execute on function public.teacher_reset_pin(uuid, text)             from public, anon;
grant  execute on function public.submit_morning(int, int, text)            to authenticated;
grant  execute on function public.set_pledge(text)                          to authenticated;
grant  execute on function public.submit_evening(int, int, text, text, text) to authenticated;
grant  execute on function public.teacher_reset_pin(uuid, text)             to authenticated;
grant  execute on function public.check_signup(text, text, text, int)       to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. 권한 (RLS) : 학생은 자기 것만, 교사는 전체 읽기
-- ---------------------------------------------------------------------

alter table public.classes       enable row level security;
alter table public.app_settings  enable row level security;   -- 정책 없음 = 아무도 못 읽음
alter table public.profiles      enable row level security;
alter table public.missions      enable row level security;
alter table public.daily_entries enable row level security;

drop policy if exists classes_read          on public.classes;
drop policy if exists classes_teacher_write on public.classes;
create policy classes_read          on public.classes for select to anon, authenticated using (true);
create policy classes_teacher_write on public.classes for update to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_teacher());

drop policy if exists missions_read           on public.missions;
drop policy if exists missions_teacher_insert on public.missions;
drop policy if exists missions_teacher_update on public.missions;
create policy missions_read           on public.missions for select to authenticated using (true);
create policy missions_teacher_insert on public.missions for insert to authenticated with check (public.is_teacher());
create policy missions_teacher_update on public.missions for update to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- 기록은 읽기만 허용. 쓰기는 위의 submit_* 함수로만 가능.
drop policy if exists entries_read on public.daily_entries;
create policy entries_read on public.daily_entries for select to authenticated
  using (student_id = auth.uid() or public.is_teacher());

-- ---------------------------------------------------------------------
-- 6. 실시간 (교사 화면에 학생 기록이 바로 반영)
-- ---------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.daily_entries;
exception when duplicate_object then null;
end $$;

-- 완료! 학급 코드 변경 예:
--   update public.app_settings set value = '새코드' where key = 'student_code';
