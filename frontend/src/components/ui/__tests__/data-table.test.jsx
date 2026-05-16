import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DataTable } from '@/components/ui/data-table'

vi.mock('@/components/ui/date-range-picker', () => ({
  DateRangePicker: ({ dateRange, onDateRangeChange, onDateFieldChange, dateFields }) => (
    <div data-testid="date-range-picker">
      <button data-testid="set-range" onClick={() => onDateRangeChange({ from: new Date('2026-01-01'), to: new Date('2026-01-31') })}>
        Set Range
      </button>
      <button data-testid="clear-range" onClick={() => onDateRangeChange({ from: undefined, to: undefined })}>
        Clear Range
      </button>
      <button data-testid="change-field" onClick={() => onDateFieldChange('updated_at')}>
        Change Field
      </button>
    </div>
  ),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const map = {
        'table.searchPlaceholder': 'Search all columns...',
        'table.search': 'Search',
        'table.loading': 'Loading...',
        'table.noRecords': 'No records to show',
        'history.previous': 'Previous',
        'history.next': 'Next',
        'history.pageStatus': 'Page {{page}} / {{pageCount}}',
      }
      return map[key] || key
    },
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}))

const columns = [
  { accessorKey: 'title', header: 'Title' },
  { accessorKey: 'status', header: 'Status' },
]

function mockResponse(results, count) {
  return { data: { results, count, page_size: 15 } }
}

function makeFetch(fn) {
  return vi.fn(fn)
}

describe('DataTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders column headers', async () => {
    const fetchData = makeFetch(() =>
      mockResponse(
        [
          { title: 'File A', status: 'done' },
          { title: 'File B', status: 'pending' },
        ],
        2,
      ),
    )
    render(<DataTable columns={columns} fetchData={fetchData} pageSize={15} />)

    await waitFor(() => {
      expect(screen.getByText('Title')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
    })
  })

  it('calls fetchData on mount', async () => {
    const fetchData = makeFetch(() => mockResponse([], 0))
    render(<DataTable columns={columns} fetchData={fetchData} pageSize={15} />)

    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledTimes(1)
      expect(fetchData).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, page_size: 15 }),
      )
    })
  })

  it('renders data rows', async () => {
    const fetchData = makeFetch(() =>
      mockResponse(
        [
          { title: 'My Video', status: 'done' },
          { title: 'My Song', status: 'pending' },
        ],
        2,
      ),
    )
    render(<DataTable columns={columns} fetchData={fetchData} pageSize={15} />)

    await waitFor(() => {
      expect(screen.getByText('My Video')).toBeInTheDocument()
      expect(screen.getByText('My Song')).toBeInTheDocument()
      expect(screen.getByText('done')).toBeInTheDocument()
      expect(screen.getByText('pending')).toBeInTheDocument()
    })
  })

  it('shows empty state when no records', async () => {
    const fetchData = makeFetch(() => mockResponse([], 0))
    render(<DataTable columns={columns} fetchData={fetchData} pageSize={15} />)

    await waitFor(() => {
      expect(screen.getByText('No records to show')).toBeInTheDocument()
    })
  })

  it('shows pagination when there are multiple pages', async () => {
    const items = Array.from({ length: 25 }, (_, i) => ({
      title: `File ${i + 1}`,
      status: 'done',
    }))
    const fetchData = makeFetch(() => mockResponse(items, 25))
    render(<DataTable columns={columns} fetchData={fetchData} pageSize={15} />)

    await waitFor(() => {
      expect(screen.getByText('Next')).toBeInTheDocument()
      expect(screen.getByText('Previous')).toBeInTheDocument()
    })
  })

  it('disables Previous on first page', async () => {
    const items = Array.from({ length: 25 }, (_, i) => ({
      title: `File ${i + 1}`,
      status: 'done',
    }))
    const fetchData = makeFetch(() => mockResponse(items, 25))
    render(<DataTable columns={columns} fetchData={fetchData} pageSize={15} />)

    await waitFor(() => {
      expect(screen.getByText('Previous').closest('button')).toBeDisabled()
      expect(screen.getByText('Next').closest('button')).not.toBeDisabled()
    })
  })

  it('paginates when clicking Next and Previous', async () => {
    const items = Array.from({ length: 25 }, (_, i) => ({
      title: `File ${i + 1}`,
      status: 'done',
    }))
    const fetchData = makeFetch((params) => {
      const p = params.page || 1
      const ps = params.page_size || 15
      const start = (p - 1) * ps
      return mockResponse(items.slice(start, start + ps), items.length)
    })
    render(<DataTable columns={columns} fetchData={fetchData} pageSize={15} />)

    await waitFor(() => {
      expect(screen.getByText('File 1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Next'))

    await waitFor(() => {
      expect(screen.getByText('File 16')).toBeInTheDocument()
    })
  })

  it('fires sort when column header is clicked', async () => {
    const fetchData = makeFetch(() => mockResponse([], 0))
    render(<DataTable columns={columns} fetchData={fetchData} pageSize={15} />)

    await waitFor(() => {
      expect(screen.getByText('Title')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Title'))

    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledWith(
        expect.objectContaining({ ordering: '-title' }),
      )
    })
  })

  it('cycles sort direction on consecutive clicks', async () => {
    const fetchData = makeFetch(() => mockResponse([], 0))
    render(<DataTable columns={columns} fetchData={fetchData} pageSize={15} />)

    await waitFor(() => {
      expect(screen.getByText('Title')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Title'))

    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledWith(
        expect.objectContaining({ ordering: '-title' }),
      )
    })

    fireEvent.click(screen.getByText('Title'))

    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledWith(
        expect.objectContaining({ ordering: 'title' }),
      )
    })
  })

  it('clears sort on third click', async () => {
    const fetchData = makeFetch(() => mockResponse([], 0))
    render(<DataTable columns={columns} fetchData={fetchData} pageSize={15} />)

    await waitFor(() => {
      expect(screen.getByText('Title')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Title'))
    fireEvent.click(screen.getByText('Title'))
    fireEvent.click(screen.getByText('Title'))

    await waitFor(() => {
      const calls = fetchData.mock.calls
      const lastCall = calls[calls.length - 1][0]
      expect(lastCall.ordering).toBeUndefined()
    })
  })

  it('searches when Enter is pressed in search input', async () => {
    const fetchData = makeFetch(() => mockResponse([], 0))
    render(
      <DataTable
        columns={columns}
        fetchData={fetchData}
        searchPlaceholder="Search here"
        pageSize={15}
      />,
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search here')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('Search here')
    fireEvent.change(input, { target: { value: 'video' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'video' }),
      )
    })
  })

  it('searches when Search button is clicked', async () => {
    const fetchData = makeFetch(() => mockResponse([], 0))
    render(
      <DataTable
        columns={columns}
        fetchData={fetchData}
        searchPlaceholder="Search here"
        pageSize={15}
      />,
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search here')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('Search here')
    fireEvent.change(input, { target: { value: 'audio' } })

    fireEvent.click(screen.getByText('Search'))

    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'audio' }),
      )
    })
  })

  it('clears search when X button is clicked', async () => {
    const fetchData = makeFetch(() => mockResponse([], 0))
    render(
      <DataTable
        columns={columns}
        fetchData={fetchData}
        searchPlaceholder="Search here"
        pageSize={15}
      />,
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search here')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('Search here')
    fireEvent.change(input, { target: { value: 'test' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'test' }),
      )
    })

    const xButtons = screen.getAllByRole('button')
    const xBtn = xButtons.find((btn) => btn.innerHTML.includes('X') || btn.querySelector('svg'))
    if (xBtn) fireEvent.click(xBtn)

    await waitFor(() => {
      const calls = fetchData.mock.calls
      const lastCall = calls[calls.length - 1][0]
      expect(lastCall.search).toBeUndefined()
    })
  })

  it('passes externalParams to fetchData', async () => {
    const fetchData = makeFetch(() => mockResponse([], 0))
    render(
      <DataTable
        columns={columns}
        fetchData={fetchData}
        pageSize={15}
        externalParams={{ status: 'done' }}
      />,
    )

    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'done' }),
      )
    })
  })

  it('exposes refresh method via ref', async () => {
    const ref = { current: null }
    const fetchData = makeFetch(() => mockResponse([], 0))
    render(
      <DataTable ref={ref} columns={columns} fetchData={fetchData} pageSize={15} />,
    )

    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledTimes(1)
    })

    ref.current.refresh()

    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledTimes(2)
    })
  })

  it('disables sort on columns with meta.disableSorting', async () => {
    const cols = [
      { accessorKey: 'title', header: 'Title' },
      {
        id: 'actions',
        header: '',
        meta: { disableSorting: true },
        cell: () => null,
      },
    ]
    const fetchData = makeFetch(() => mockResponse([], 0))
    render(<DataTable columns={cols} fetchData={fetchData} pageSize={15} />)

    await waitFor(() => {
      expect(screen.getByText('Title')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Title'))

    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledWith(
        expect.objectContaining({ ordering: '-title' }),
      )
    })
  })

  it('renders search placeholder from prop', async () => {
    const fetchData = makeFetch(() => mockResponse([], 0))
    render(
      <DataTable
        columns={columns}
        fetchData={fetchData}
        searchPlaceholder="Custom search..."
        pageSize={15}
      />,
    )

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('Custom search...'),
      ).toBeInTheDocument()
    })
  })

  it('resets to page 1 when externalParams change', async () => {
    const fetchData = makeFetch(() => mockResponse([], 0))
    const { rerender } = render(
      <DataTable
        columns={columns}
        fetchData={fetchData}
        pageSize={15}
        externalParams={{ status: 'done' }}
      />,
    )

    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, status: 'done' }),
      )
    })

    rerender(
      <DataTable
        columns={columns}
        fetchData={fetchData}
        pageSize={15}
        externalParams={{ status: 'pending' }}
      />,
    )

    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, status: 'pending' }),
      )
    })
  })

  // ── Date filter integration ────────────────────────────────────────

  it('renders date range picker when enableDateFilter is true', async () => {
    const fetchData = makeFetch(() => mockResponse([], 0))
    render(
      <DataTable
        columns={columns}
        fetchData={fetchData}
        pageSize={15}
        enableDateFilter
        dateFields={[{ value: 'created_at', label: 'Created' }]}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId('date-range-picker')).toBeInTheDocument()
    })
  })

  it('does not render date range picker when enableDateFilter is false', async () => {
    const fetchData = makeFetch(() => mockResponse([], 0))
    render(
      <DataTable columns={columns} fetchData={fetchData} pageSize={15} />,
    )

    await waitFor(() => {
      expect(screen.queryByTestId('date-range-picker')).not.toBeInTheDocument()
    })
  })

  it('passes date_from and date_to params when date range is selected', async () => {
    const fetchData = makeFetch(() => mockResponse([], 0))
    render(
      <DataTable
        columns={columns}
        fetchData={fetchData}
        pageSize={15}
        enableDateFilter
        dateFields={[{ value: 'created_at', label: 'Created' }]}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId('date-range-picker')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('set-range'))

    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledWith(
        expect.objectContaining({
          date_from: '2026-01-01',
          date_to: '2026-01-31',
          date_field: 'created_at',
        }),
      )
    })
  })

  it('removes date params when date range is cleared', async () => {
    const fetchData = makeFetch(() => mockResponse([], 0))
    render(
      <DataTable
        columns={columns}
        fetchData={fetchData}
        pageSize={15}
        enableDateFilter
        dateFields={[{ value: 'created_at', label: 'Created' }]}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId('date-range-picker')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('set-range'))

    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledWith(
        expect.objectContaining({ date_from: '2026-01-01' }),
      )
    })

    fireEvent.click(screen.getByTestId('clear-range'))

    await waitFor(() => {
      const calls = fetchData.mock.calls
      const lastCall = calls[calls.length - 1][0]
      expect(lastCall.date_from).toBeUndefined()
      expect(lastCall.date_to).toBeUndefined()
    })
  })

  it('passes date_field param when field is changed while a range is active', async () => {
    const fetchData = makeFetch(() => mockResponse([], 0))
    render(
      <DataTable
        columns={columns}
        fetchData={fetchData}
        pageSize={15}
        enableDateFilter
        dateFields={[
          { value: 'created_at', label: 'Created' },
          { value: 'updated_at', label: 'Updated' },
        ]}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId('date-range-picker')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('set-range'))

    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledWith(
        expect.objectContaining({ date_from: '2026-01-01', date_field: 'created_at' }),
      )
    })

    fireEvent.click(screen.getByTestId('change-field'))

    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledWith(
        expect.objectContaining({ date_field: 'updated_at' }),
      )
    })
  })

  it('does not pass date params when no date range is selected', async () => {
    const fetchData = makeFetch(() => mockResponse([], 0))
    render(
      <DataTable
        columns={columns}
        fetchData={fetchData}
        pageSize={15}
        enableDateFilter
        dateFields={[{ value: 'created_at', label: 'Created' }]}
      />,
    )

    await waitFor(() => {
      const calls = fetchData.mock.calls
      const lastCall = calls[calls.length - 1][0]
      expect(lastCall.date_from).toBeUndefined()
      expect(lastCall.date_to).toBeUndefined()
      expect(lastCall.date_field).toBeUndefined()
    })
  })
})
