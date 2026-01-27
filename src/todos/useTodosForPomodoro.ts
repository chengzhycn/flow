import { useQuery } from '@tanstack/react-query'
import { fetchTodos } from '@/api/todos'

export function useTodosForPomodoro(userId: string) {
  return useQuery({
    queryKey: ['todos', userId],
    queryFn: () => fetchTodos(userId),
    enabled: !!userId,
    select: (todos) => todos.filter((t) => !t.completed),
  })
}
