/**
 * Calendar utility functions for date calculations
 */

export interface CalendarDay {
  date: Date
  dayOfMonth: number
  isCurrentMonth: boolean
  isToday: boolean
}

/**
 * Get the start and end dates of a week (Sunday to Saturday)
 */
export function getWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date)
  const day = d.getDay()
  
  // Get Sunday (start of week)
  const start = new Date(d)
  start.setDate(d.getDate() - day)
  start.setHours(0, 0, 0, 0)
  
  // Get Saturday (end of week)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  
  return { start, end }
}

/**
 * Get ISO week number for a date
 */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

/**
 * Get the days array for a month calendar view (includes days from prev/next month to fill the grid)
 */
export function getMonthCalendarDays(year: number, month: number): CalendarDay[] {
  const days: CalendarDay[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  // First day of the month
  const firstDay = new Date(year, month, 1)
  // Last day of the month
  const lastDay = new Date(year, month + 1, 0)
  
  // Get the day of week for the first day (0 = Sunday)
  const startDayOfWeek = firstDay.getDay()
  
  // Add days from previous month
  const prevMonthLastDay = new Date(year, month, 0).getDate()
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, prevMonthLastDay - i)
    days.push({
      date,
      dayOfMonth: date.getDate(),
      isCurrentMonth: false,
      isToday: date.getTime() === today.getTime(),
    })
  }
  
  // Add days of current month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day)
    days.push({
      date,
      dayOfMonth: day,
      isCurrentMonth: true,
      isToday: date.getTime() === today.getTime(),
    })
  }
  
  // Add days from next month to complete the grid (6 rows * 7 days = 42)
  const remainingDays = 42 - days.length
  for (let day = 1; day <= remainingDays; day++) {
    const date = new Date(year, month + 1, day)
    days.push({
      date,
      dayOfMonth: day,
      isCurrentMonth: false,
      isToday: date.getTime() === today.getTime(),
    })
  }
  
  return days
}

/**
 * Format week title: "2026年第5周（1月26日 - 2月1日）"
 */
export function formatWeekTitle(date: Date): string {
  const { start, end } = getWeekRange(date)
  const weekNum = getWeekNumber(date)
  const year = start.getFullYear()
  
  const startMonth = start.getMonth() + 1
  const startDay = start.getDate()
  const endMonth = end.getMonth() + 1
  const endDay = end.getDate()
  
  return `${year}年第${weekNum}周（${startMonth}月${startDay}日 - ${endMonth}月${endDay}日）`
}

/**
 * Format month title: "2026年1月"
 */
export function formatMonthTitle(date: Date): string {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  return `${year}年${month}月`
}

/**
 * Get an array of dates for a week (Sunday to Saturday)
 */
export function getWeekDays(date: Date): Date[] {
  const { start } = getWeekRange(date)
  const days: Date[] = []
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d)
  }
  
  return days
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

/**
 * Check if a date falls within a range (inclusive)
 */
export function isDateInRange(date: Date, start: Date, end: Date): boolean {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const s = new Date(start)
  s.setHours(0, 0, 0, 0)
  const e = new Date(end)
  e.setHours(23, 59, 59, 999)
  
  return d >= s && d <= e
}

/**
 * Format a date as "M月D日"
 */
export function formatShortDate(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

/**
 * Get day name in Chinese
 */
export function getDayName(dayIndex: number): string {
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return names[dayIndex]
}

/**
 * Navigate to previous week
 */
export function getPreviousWeek(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - 7)
  return d
}

/**
 * Navigate to next week
 */
export function getNextWeek(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + 7)
  return d
}

/**
 * Navigate to previous month
 */
export function getPreviousMonth(date: Date): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() - 1)
  return d
}

/**
 * Navigate to next month
 */
export function getNextMonth(date: Date): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + 1)
  return d
}

/**
 * Convert a Date to ISO string preserving local date (not UTC)
 * This ensures the date stored is the same as what the user sees
 */
export function toLocalISOString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}T00:00:00.000Z`
}
