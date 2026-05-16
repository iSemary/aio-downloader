import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DateRangePicker } from '@/components/ui/date-range-picker'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}))

const dateFields = [
  { value: 'created_at', label: 'Created' },
  { value: 'updated_at', label: 'Updated' },
]

describe('DateRangePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders trigger button with default label', () => {
    render(
      <DateRangePicker
        dateField="created_at"
        onDateFieldChange={() => {}}
        dateFields={dateFields}
        dateRange={{ from: undefined, to: undefined }}
        onDateRangeChange={() => {}}
      />,
    )
    expect(screen.getByRole('button')).toBeInTheDocument()
    expect(screen.getByText('Pick date range')).toBeInTheDocument()
  })

  it('shows formatted date range when range is selected', () => {
    render(
      <DateRangePicker
        dateField="created_at"
        onDateFieldChange={() => {}}
        dateFields={dateFields}
        dateRange={{ from: new Date(2026, 0, 1), to: new Date(2026, 4, 15) }}
        onDateRangeChange={() => {}}
      />,
    )
    expect(screen.getByText(/Jan 1, 2026.*May 15, 2026/)).toBeInTheDocument()
  })

  it('opens popover on trigger click', async () => {
    render(
      <DateRangePicker
        dateField="created_at"
        onDateFieldChange={() => {}}
        dateFields={dateFields}
        dateRange={{ from: undefined, to: undefined }}
        onDateRangeChange={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })
  })

  it('shows clear button when range is selected', async () => {
    render(
      <DateRangePicker
        dateField="created_at"
        onDateFieldChange={() => {}}
        dateFields={dateFields}
        dateRange={{ from: new Date(2026, 0, 1), to: new Date(2026, 4, 15) }}
        onDateRangeChange={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('Clear')).toBeInTheDocument()
    })
  })

  it('calls onDateRangeChange with undefined when clear is clicked', async () => {
    const onRangeChange = vi.fn()
    render(
      <DateRangePicker
        dateField="created_at"
        onDateFieldChange={() => {}}
        dateFields={dateFields}
        dateRange={{ from: new Date(2026, 0, 1), to: new Date(2026, 4, 15) }}
        onDateRangeChange={onRangeChange}
      />,
    )
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('Clear')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Clear'))
    expect(onRangeChange).toHaveBeenCalledWith({ from: undefined, to: undefined })
  })
})
