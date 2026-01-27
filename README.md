# Flow

Cross-platform personal workflow app: to-do list and Pomodoro timer. Uses Supabase for auth and data.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In **Project Settings → API**, copy the **Project URL** and **anon public** key.
3. Copy `.env.example` to `.env` and set:

   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

4. Run the database migrations in the Supabase SQL Editor (**SQL Editor → New query**). Run them in order:
   - `supabase/migrations/001_initial.sql` (creates tables)
   - `supabase/migrations/002_add_todo_fields.sql` (adds quadrant, start_date, inbox fields)
   - `supabase/migrations/003_add_description_and_parent_id.sql` (adds description and parent_id for nested todos)
   - `supabase/migrations/004_add_deleted_at.sql` (adds deleted_at for soft delete)

5. In **Authentication → Providers**, ensure **Email** is enabled (default).

### 3. Run locally

```bash
npm run dev
```

Open the URL shown (e.g. http://localhost:5173). Sign up with email/password, then use Todos and Pomodoro.

### Build

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## Features

- **To-do list**:
  - Add, edit, complete, delete tasks
  - Task descriptions for detailed notes
  - Nested sub-todos (parent-child relationships)
  - Four-quadrant labels (重要且紧急 / 重要不紧急 / 不重要但紧急 / 不重要不紧急)
  - Start date and due date
  - Inbox, Today, Last 7 days, and All views in sidebar
  - Data stored in Supabase
- **Pomodoro**: 25 min work / 5 min short break / 15 min long break. Optional link to a task. Sessions saved to Supabase.
- **Settings**: Theme (light / dark / system), Pomodoro defaults description, history (today and last 7 days completed work sessions).
- **Theme**: Light and dark mode with persistence.

## Tech

- React 18, TypeScript, Vite
- Tailwind CSS, Zustand, TanStack Query
- Supabase (Auth + PostgreSQL)
- Optional: Tauri 2 for desktop builds (see below)

## Desktop (Tauri 2)

Rust and a system C/C++ toolchain are required. See [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```bash
# Development (runs Vite and opens the Tauri window)
npm run tauri:dev

# Production build and installers
npm run build
npm run tauri:build
```

Installers will be in `src-tauri/target/release/bundle/`.
