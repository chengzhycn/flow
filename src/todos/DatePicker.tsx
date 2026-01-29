import { useState, useRef, useEffect } from 'react'

type DatePickerProps = {
    value: string // ISO date string (YYYY-MM-DD)
    onChange: (value: string) => void
    placeholder?: string
    className?: string
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
    return new Date(year, month, 1).getDay()
}

function formatDisplayDate(dateStr: string): string {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${month}月${day}日`
}

export function DatePicker({ value, onChange, placeholder = '选择日期', className = '' }: DatePickerProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; alignRight: boolean }>({ top: 0, left: 0, alignRight: false })
    const ref = useRef<HTMLDivElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Parse current value or use today
    const currentDate = value ? new Date(value) : new Date()
    const [viewYear, setViewYear] = useState(currentDate.getFullYear())
    const [viewMonth, setViewMonth] = useState(currentDate.getMonth())

    // Update view when value changes
    useEffect(() => {
        if (value) {
            const date = new Date(value)
            setViewYear(date.getFullYear())
            setViewMonth(date.getMonth())
        }
    }, [value])

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Calculate dropdown position when opening
    useEffect(() => {
        if (isOpen && ref.current) {
            const rect = ref.current.getBoundingClientRect()
            const dropdownWidth = 240 // min-w-[240px]
            const dropdownHeight = 340 // approximate height
            const rightSpace = window.innerWidth - rect.left
            const bottomSpace = window.innerHeight - rect.bottom
            const alignRight = rightSpace < dropdownWidth

            // Check if should show above instead of below
            const showAbove = bottomSpace < dropdownHeight && rect.top > dropdownHeight

            setDropdownPosition({
                top: showAbove ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
                left: alignRight ? rect.right - dropdownWidth : rect.left,
                alignRight
            })
        }
    }, [isOpen])

    const handlePrevMonth = () => {
        if (viewMonth === 0) {
            setViewMonth(11)
            setViewYear(viewYear - 1)
        } else {
            setViewMonth(viewMonth - 1)
        }
    }

    const handleNextMonth = () => {
        if (viewMonth === 11) {
            setViewMonth(0)
            setViewYear(viewYear + 1)
        } else {
            setViewMonth(viewMonth + 1)
        }
    }

    const handleSelectDate = (year: number, month: number, day: number) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        onChange(dateStr)
        setIsOpen(false)
    }

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation()
        onChange('')
        setIsOpen(false)
    }

    // Generate calendar days
    const daysInMonth = getDaysInMonth(viewYear, viewMonth)
    const firstDayOfMonth = getFirstDayOfMonth(viewYear, viewMonth)
    const daysInPrevMonth = getDaysInMonth(viewYear, viewMonth - 1)

    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const calendarDays: { day: number; month: number; year: number; isCurrentMonth: boolean }[] = []

    // Previous month days
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i
        const month = viewMonth === 0 ? 11 : viewMonth - 1
        const year = viewMonth === 0 ? viewYear - 1 : viewYear
        calendarDays.push({ day, month, year, isCurrentMonth: false })
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        calendarDays.push({ day, month: viewMonth, year: viewYear, isCurrentMonth: true })
    }

    // Next month days (fill to complete the last week)
    const remainingDays = 42 - calendarDays.length // 6 rows * 7 days
    for (let day = 1; day <= remainingDays; day++) {
        const month = viewMonth === 11 ? 0 : viewMonth + 1
        const year = viewMonth === 11 ? viewYear + 1 : viewYear
        calendarDays.push({ day, month, year, isCurrentMonth: false })
    }

    return (
        <div className={`relative ${className}`} ref={ref}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${value
                    ? 'bg-[var(--color-bg)] text-[var(--color-text)] border-[var(--color-border)]'
                    : 'bg-[var(--color-bg)] text-[var(--color-text-muted)] border-[var(--color-border)]'
                    } hover:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20`}
            >
                <div className="flex items-center gap-2 truncate">
                    <svg className="w-3.5 h-3.5 shrink-0 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="truncate">{value ? formatDisplayDate(value) : placeholder}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {value && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="p-0.5 rounded hover:bg-[var(--color-text)]/10 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                            title="清除"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                    <svg
                        className={`w-3 h-3 transition-transform text-[var(--color-text-muted)] ${isOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </button>

            {isOpen && (
                <div
                    ref={dropdownRef}
                    className="fixed z-[100] min-w-[240px] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                >
                    {/* Header with month/year navigation */}
                    <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="p-1 rounded hover:bg-[var(--color-text)]/5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <span className="text-xs font-medium text-[var(--color-text)]">
                            {viewYear}年 {MONTHS[viewMonth]}
                        </span>
                        <button
                            type="button"
                            onClick={handleNextMonth}
                            className="p-1 rounded hover:bg-[var(--color-text)]/5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>

                    {/* Weekday headers */}
                    <div className="grid grid-cols-7 gap-1 px-2 pt-2">
                        {WEEKDAYS.map((day) => (
                            <div key={day} className="w-7 text-center text-[10px] font-medium text-[var(--color-text-muted)] py-1">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar days */}
                    <div className="grid grid-cols-7 gap-1 p-2">
                        {calendarDays.map((item, index) => {
                            const dateStr = `${item.year}-${String(item.month + 1).padStart(2, '0')}-${String(item.day).padStart(2, '0')}`
                            const isSelected = dateStr === value
                            const isToday = dateStr === todayStr

                            return (
                                <button
                                    key={index}
                                    type="button"
                                    onClick={() => handleSelectDate(item.year, item.month, item.day)}
                                    className={`w-7 h-7 flex items-center justify-center text-xs rounded-md transition-all ${isSelected
                                        ? 'bg-[var(--color-accent)] text-white font-medium'
                                        : isToday
                                            ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium'
                                            : item.isCurrentMonth
                                                ? 'text-[var(--color-text)] hover:bg-[var(--color-accent)]/5'
                                                : 'text-[var(--color-text-muted)]/50 hover:bg-[var(--color-accent)]/5'
                                        }`}
                                >
                                    {item.day}
                                </button>
                            )
                        })}
                    </div>

                    {/* Today button */}
                    <div className="border-t border-[var(--color-border)] px-2 py-2">
                        <button
                            type="button"
                            onClick={() => handleSelectDate(today.getFullYear(), today.getMonth(), today.getDate())}
                            className="w-full px-3 py-1.5 text-xs font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/5 rounded-md transition-colors"
                        >
                            今天
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
