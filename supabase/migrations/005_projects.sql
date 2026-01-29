-- Projects table
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  color text default '#6366f1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.projects enable row level security;

create policy "Users can manage own projects"
  on public.projects
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Milestones table
create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  due_date timestamptz,
  completed boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.milestones enable row level security;

create policy "Users can manage milestones in own projects"
  on public.milestones
  for all
  using (
    exists (
      select 1 from public.projects
      where projects.id = milestones.project_id
      and projects.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = milestones.project_id
      and projects.user_id = auth.uid()
    )
  );

-- Add project_id and milestone_id to todos
alter table public.todos
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists milestone_id uuid references public.milestones(id) on delete set null;

-- Trigger for updated_at on projects
create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- Trigger for updated_at on milestones
create trigger milestones_updated_at
  before update on public.milestones
  for each row execute function public.set_updated_at();

-- Indexes for performance
create index if not exists idx_projects_user_id on public.projects(user_id);
create index if not exists idx_projects_deleted_at on public.projects(deleted_at);
create index if not exists idx_milestones_project_id on public.milestones(project_id);
create index if not exists idx_todos_project_id on public.todos(project_id);
create index if not exists idx_todos_milestone_id on public.todos(milestone_id);
