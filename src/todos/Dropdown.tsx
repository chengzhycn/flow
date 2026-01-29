import { useState, useRef, useEffect } from 'react'

export type DropdownOption = {
    value: string
    label: string
    className?: string
    color?: string
}

type DropdownProps = {
    value: string | null
    onChange: (value: string) => void
    options: DropdownOption[]
    placeholder?: string
    className?: string
}

export function Dropdown({ value, onChange, options, placeholder = '请选择', className = '' }: DropdownProps) {
    const [isOpen, setIsOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const selectedOption = options.find((o) => o.value === value)

    const handleSelect = (option: DropdownOption) => {
        onChange(option.value)
        setIsOpen(false)
    }

    return (
        <div className={`relative ${className}`} ref={ref}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${selectedOption
                        ? 'bg-[var(--color-bg)] text-[var(--color-text)] border-[var(--color-border)]'
                        : 'bg-[var(--color-bg)] text-[var(--color-text-muted)] border-[var(--color-border)]'
                    } hover:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 ${selectedOption?.color ? '!text-white !border-transparent' : ''
                    }`}
                style={selectedOption?.color ? { backgroundColor: selectedOption.color } : undefined}
            >
                <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
                <svg
                    className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''} ${selectedOption?.color ? 'text-white' : 'text-[var(--color-text-muted)]'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg shadow-xl overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100 origin-top">
                    {options.map((option) => {
                        const isSelected = option.value === value
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => handleSelect(option)}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors ${isSelected
                                        ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium'
                                        : 'text-[var(--color-text)] hover:bg-[var(--color-accent)]/5'
                                    }`}
                            >
                                {option.color && (
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: option.color }}></span>
                                )}
                                {option.label}
                                {isSelected && (
                                    <svg className="w-3 h-3 ml-auto text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
