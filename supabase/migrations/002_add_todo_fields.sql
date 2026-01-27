-- Add quadrant, start_date, and inbox fields to todos
alter table public.todos
  add column if not exists quadrant text check (quadrant in ('important_urgent', 'important_not_urgent', 'not_important_urgent', 'not_important_not_urgent')),
  add column if not exists start_date timestamptz,
  add column if not exists inbox boolean not null default true;

-- Update existing todos to have inbox = true by default
update public.todos set inbox = true where inbox is null;
