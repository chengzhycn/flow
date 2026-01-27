-- Add deleted_at field for soft delete
alter table public.todos
  add column if not exists deleted_at timestamptz;

-- Create index for deleted_at for better query performance
create index if not exists idx_todos_deleted_at on public.todos(deleted_at);
