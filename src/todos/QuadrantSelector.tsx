import type { Quadrant } from '@/api/todos'

type QuadrantOption = {
  value: Quadrant
  label: string
  shortLabel: string
  color: string
  bgColor: string
}

const options: QuadrantOption[] = [
  { 
    value: 'important_urgent', 
    label: '重要且紧急', 
    shortLabel: '重急',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
  },
  { 
    value: 'important_not_urgent', 
    label: '重要不紧急', 
    shortLabel: '重缓',
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800'
  },
  { 
    value: 'not_important_urgent', 
    label: '不重要但紧急', 
    shortLabel: '轻急',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
  },
  { 
    value: 'not_important_not_urgent', 
    label: '不重要不紧急', 
    shortLabel: '轻缓',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700'
  },
  { 
    value: null, 
    label: '无', 
    shortLabel: '无',
    color: 'text-[var(--color-text-muted)]',
    bgColor: 'bg-[var(--color-bg-elevated)] border-[var(--color-border)]'
  },
]

export function QuadrantSelector({
  value,
  onChange,
  compact = false,
}: {
  value: Quadrant
  onChange: (value: Quadrant) => void
  compact?: boolean
}) {
  return (
    <div className="space-y-2">
      {!compact && (
        <label className="block text-sm font-medium text-[var(--color-text)]">四象限</label>
      )}
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const isSelected = value === opt.value
          return (
            <button
              key={opt.value ?? 'none'}
              type="button"
              onMouseDown={(e) => e.preventDefault()} // 阻止 blur 事件，避免在 quadrant 更新前保存
              onClick={() => onChange(opt.value)}
              className={`rounded-lg border-2 px-3 py-2 text-xs font-medium transition-all ${
                isSelected
                  ? `${opt.bgColor} border-[var(--color-accent)] ${opt.color}`
                  : 'border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text)] hover:border-[var(--color-text-muted)] hover:bg-[var(--color-bg)]'
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                {opt.value && (
                  <span className={`h-2 w-2 rounded-full ${
                    opt.value === 'important_urgent' ? 'bg-red-500' :
                    opt.value === 'important_not_urgent' ? 'bg-yellow-500' :
                    opt.value === 'not_important_urgent' ? 'bg-blue-500' :
                    'bg-gray-400'
                  }`} />
                )}
                <span>{compact ? opt.shortLabel : opt.label}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
