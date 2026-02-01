import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchLLMSettings,
  updateLLMSettings,
  testLLMConnection,
  type LLMSettings,
} from '@/api/summaries'

export function LLMSettingsSection() {
  const queryClient = useQueryClient()
  const [testStatus, setTestStatus] = useState<{
    testing: boolean
    result?: { success: boolean; message: string }
  }>({ testing: false })

  const { data: settings, isLoading } = useQuery({
    queryKey: ['llm-settings'],
    queryFn: fetchLLMSettings,
  })

  const mutation = useMutation({
    mutationFn: (newSettings: Partial<LLMSettings>) => updateLLMSettings(newSettings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llm-settings'] })
    },
  })

  const handleChange = (key: keyof LLMSettings, value: string) => {
    mutation.mutate({ [key]: value })
  }

  const handleTestConnection = async () => {
    setTestStatus({ testing: true })
    const result = await testLLMConnection()
    setTestStatus({ testing: false, result })
  }

  if (isLoading || !settings) {
    return (
      <section>
        <h2 className="text-lg font-medium text-[var(--color-text)] mb-2">AI 总结</h2>
        <p className="text-sm text-[var(--color-text-muted)]">加载中...</p>
      </section>
    )
  }

  return (
    <section>
      <h2 className="text-lg font-medium text-[var(--color-text)] mb-2">AI 总结</h2>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">
        配置大模型 API 用于生成工作总结。支持 OpenAI 兼容接口。
      </p>

      <div className="bg-[var(--color-bg-elevated)] rounded-lg p-4 space-y-4">
        {/* API Base URL */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
            API Base URL
          </label>
          <input
            type="text"
            value={settings.baseUrl}
            onChange={(e) => handleChange('baseUrl', e.target.value)}
            placeholder="https://api.openai.com/v1"
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
          />
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            OpenAI 兼容的 API 地址，可使用代理或本地模型
          </p>
        </div>

        {/* API Key */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
            API Key
          </label>
          <input
            type="password"
            value={settings.apiKey}
            onChange={(e) => handleChange('apiKey', e.target.value)}
            placeholder="sk-..."
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
          />
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            API 密钥仅存储在本地，不会同步到云端
          </p>
        </div>

        {/* Model */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
            模型名称
          </label>
          <input
            type="text"
            value={settings.model}
            onChange={(e) => handleChange('model', e.target.value)}
            placeholder="gpt-4o-mini"
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
          />
        </div>

        {/* Test Connection */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testStatus.testing || !settings.apiKey}
            className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testStatus.testing ? '测试中...' : '测试连接'}
          </button>
          {testStatus.result && (
            <span
              className={`text-sm ${
                testStatus.result.success
                  ? 'text-[var(--color-success)]'
                  : 'text-[var(--color-danger)]'
              }`}
            >
              {testStatus.result.message}
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
