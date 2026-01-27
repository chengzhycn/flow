-- todos
create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  due_date timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.todos enable row level security;

create policy "Users can manage own todos"
  on public.todos
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- pomodoro_sessions
create table if not exists public.pomodoro_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  duration_minutes int not null,
  type text not null check (type in ('work', 'short_break', 'long_break')),
  completed boolean not null default false,
  todo_id uuid references public.todos(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.pomodoro_sessions enable row level security;

create policy "Users can manage own pomodoro_sessions"
  on public.pomodoro_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- optional: updated_at trigger for todos
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger todos_updated_at
  before update on public.todos
  for each row execute function public.set_updated_at();
