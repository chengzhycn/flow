import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchScheduleSettings,
  updateScheduleSettings,
  type ScheduleSettings,
} from '@/api/summaries'

const WEEKDAYS = [
  { value: 0, label: '周日' },
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
]

export function ScheduleSettingsSection() {
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['schedule-settings'],
    queryFn: fetchScheduleSettings,
  })

  const mutation = useMutation({
    mutationFn: (newSettings: Partial<ScheduleSettings>) => updateScheduleSettings(newSettings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-settings'] })
    },
  })

  const handleChange = <K extends keyof ScheduleSettings>(key: K, value: ScheduleSettings[K]) => {
    mutation.mutate({ [key]: value })
  }

  if (isLoading || !settings) {
    return (
      <section>
        <h2 className="text-lg font-medium text-[var(--color-text)] mb-2">定时总结</h2>
        <p className="text-sm text-[var(--color-text-muted)]">加载中...</p>
      </section>
    )
  }

  return (
    <section>
      <h2 className="text-lg font-medium text-[var(--color-text)] mb-2">定时总结</h2>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">
        设置自动生成工作总结的时间。仅在应用运行时检查并生成。
      </p>

      <div className="bg-[var(--color-bg-elevated)] rounded-lg p-4 space-y-6">
        {/* 日总结设置 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[var(--color-text)]">每日总结</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.dailySummaryEnabled}
                onChange={(e) => handleChange('dailySummaryEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[var(--color-border)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-accent)] rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-accent)]"></div>
            </label>
          </div>
          <div className={`${settings.dailySummaryEnabled ? '' : 'opacity-50 pointer-events-none'}`}>
            <label className="block text-sm text-[var(--color-text-muted)] mb-1">生成时间</label>
            <input
              type="time"
              value={settings.dailySummaryTime}
              onChange={(e) => handleChange('dailySummaryTime', e.target.value)}
              className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
            />
          </div>
        </div>

        {/* 分割线 */}
        <div className="border-t border-[var(--color-border)]"></div>

        {/* 周总结设置 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[var(--color-text)]">每周总结</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.weeklySummaryEnabled}
                onChange={(e) => handleChange('weeklySummaryEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[var(--color-border)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-accent)] rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-accent)]"></div>
            </label>
          </div>
          <div className={`space-y-3 ${settings.weeklySummaryEnabled ? '' : 'opacity-50 pointer-events-none'}`}>
            <div>
              <label className="block text-sm text-[var(--color-text-muted)] mb-1">生成日期</label>
              <select
                value={settings.weeklySummaryDay}
                onChange={(e) => handleChange('weeklySummaryDay', parseInt(e.target.value, 10))}
                className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
              >
                {WEEKDAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-[var(--color-text-muted)] mb-1">生成时间</label>
              <input
                type="time"
                value={settings.weeklySummaryTime}
                onChange={(e) => handleChange('weeklySummaryTime', e.target.value)}
                className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
