-- UUID 생성을 위해 Supabase에서 제공하는 pgcrypto 확장을 활성화합니다.
create extension if not exists pgcrypto;

-- BAKEWEB 관리자 계정별 견적서 원본과 목록 메타데이터를 저장합니다.
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quote_number text not null,
  issue_date date,
  status text not null default 'draft' check (status in ('draft', 'sent', 'approved', 'cancelled')),
  project_name text not null default '',
  client_name text not null default '',
  total_amount bigint not null default 0 check (total_amount >= 0),
  quote_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 사용자별 목록 조회와 RLS 검사를 빠르게 처리하기 위한 인덱스입니다.
create index if not exists quotes_user_id_idx on public.quotes using btree (user_id);
create index if not exists quotes_user_updated_idx on public.quotes using btree (user_id, updated_at desc);

-- 브라우저에서 노출되는 public 테이블에 행 수준 보안을 반드시 활성화합니다.
alter table public.quotes enable row level security;

-- 설정 SQL을 다시 실행해도 정책 이름 충돌이 나지 않도록 기존 정책을 정리합니다.
drop policy if exists "Users can view own quotes" on public.quotes;
drop policy if exists "Users can create own quotes" on public.quotes;
drop policy if exists "Users can update own quotes" on public.quotes;
drop policy if exists "Users can delete own quotes" on public.quotes;

-- 인증 사용자는 본인 소유의 견적서만 조회할 수 있습니다.
create policy "Users can view own quotes"
on public.quotes for select
to authenticated
using ((select auth.uid()) = user_id);

-- 인증 사용자는 본인 ID로만 새 견적서를 저장할 수 있습니다.
create policy "Users can create own quotes"
on public.quotes for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- 인증 사용자는 본인 소유 견적서만 수정하고 소유자를 바꿀 수 없습니다.
create policy "Users can update own quotes"
on public.quotes for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- 인증 사용자는 본인 소유 견적서만 삭제할 수 있습니다.
create policy "Users can delete own quotes"
on public.quotes for delete
to authenticated
using ((select auth.uid()) = user_id);

-- 비로그인 역할에는 테이블 권한을 부여하지 않고 인증 역할에 필요한 작업만 허용합니다.
revoke all on table public.quotes from anon;
grant select, insert, update, delete on table public.quotes to authenticated;
