-- Work summaries table
create table if not exists public.work_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('daily', 'weekly')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.work_summaries enable row level security;

create policy "Users can manage own work summaries"
  on public.work_summaries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Indexes for performance
create index if not exists idx_work_summaries_user_id on public.work_summaries(user_id);
create index if not exists idx_work_summaries_type on public.work_summaries(type);
create index if not exists idx_work_summaries_period_start on public.work_summaries(period_start);

-- Unique constraint to prevent duplicate summaries for same period
create unique index if not exists idx_work_summaries_unique_period 
  on public.work_summaries(user_id, type, period_start);
