import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import MarkdownRenderer from '../components/MarkdownRenderer'
import { copyToClipboard } from '../utils/clipboard'

vi.mock('../utils/clipboard', () => ({
  copyToClipboard: vi.fn(async () => true),
  copyCode: vi.fn(async () => true),
}))

beforeEach(() => { vi.mocked(copyToClipboard).mockClear(); vi.mocked(copyToClipboard).mockResolvedValue(true) })
afterEach(() => { vi.useRealTimers() })

/**
 * A settled chat table sorts by a header click, right-aligns its numeric
 * columns, and draws one of them as a bar chart from the action row. None of
 * it edits the message: the copy actions keep the source order, and a table
 * that is still streaming, or has one row, renders as it always did.
 */
const TABLE = [
  '| Service | Runs | Errors | p95 ms | Cost |',
  '| --- | --- | --- | --- | --- |',
  '| gateway | 1,250 | 3 | 48.5 | $12.10 |',
  '| indexer | 980 | 0 | 112 | $4.75 |',
  '| `mailer` | 15 | 12 | 9.4 | $0.80 |',
  '| search | 2,210 |  | 61.25 | $18.00 |',
].join('\n')

const bodyFirstCells = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('tbody tr')).map(tr => tr.querySelector('td')?.textContent?.trim())

describe('markdown table sorting', () => {
  it('cycles a header through ascending, descending and source order, with the arrow on the sorted column', async () => {
    const { container } = render(<MarkdownRenderer content={TABLE} />)
    const headers = screen.getAllByTestId('table-sort')
    expect(headers).toHaveLength(5)
    const runs = headers[1]
    const th = runs.closest('th')!
    expect(th).toHaveAttribute('aria-sort', 'none')

    fireEvent.click(runs)
    expect(th).toHaveAttribute('aria-sort', 'ascending')
    expect(th.querySelector('svg.lucide-chevron-up')).not.toBeNull()
    // Numeric: 15 < 980 < 1,250 < 2,210 (a text sort would put 1,250 first).
    expect(bodyFirstCells(container)).toEqual(['mailer', 'indexer', 'gateway', 'search'])

    fireEvent.click(runs)
    expect(th).toHaveAttribute('aria-sort', 'descending')
    expect(th.querySelector('svg.lucide-chevron-down')).not.toBeNull()
    expect(bodyFirstCells(container)).toEqual(['search', 'gateway', 'indexer', 'mailer'])

    fireEvent.click(runs)
    expect(th).toHaveAttribute('aria-sort', 'none')
    expect(th.querySelector('svg')).toBeNull()
    expect(bodyFirstCells(container)).toEqual(['gateway', 'indexer', 'mailer', 'search'])

    // The rows are the elements react-markdown rendered, reordered: the code
    // chip in the sorted row is still a chip, and the copy ignores the sort.
    fireEvent.click(runs)
    expect(container.querySelector('tbody tr:first-child code')).not.toBeNull()
    await act(async () => { fireEvent.click(screen.getByTestId('table-copy-markdown')) })
    expect(copyToClipboard).toHaveBeenCalledWith(TABLE)
  })

  it('sorts a text column by locale and keeps blank cells last in both directions', () => {
    const { container } = render(<MarkdownRenderer content={TABLE} />)
    const [service, , errors] = screen.getAllByTestId('table-sort')
    fireEvent.click(service)
    expect(bodyFirstCells(container)).toEqual(['gateway', 'indexer', 'mailer', 'search'])
    fireEvent.click(service)
    expect(bodyFirstCells(container)).toEqual(['search', 'mailer', 'indexer', 'gateway'])
    fireEvent.click(errors) // asc: 0, 3, 12, blank
    expect(bodyFirstCells(container)).toEqual(['indexer', 'gateway', 'mailer', 'search'])
    fireEvent.click(errors) // desc: 12, 3, 0, blank
    expect(bodyFirstCells(container)).toEqual(['mailer', 'gateway', 'indexer', 'search'])
  })

  it('is one tab stop: only one header button is tabbable and the arrow keys move between them', () => {
    render(<MarkdownRenderer content={TABLE} />)
    const headers = screen.getAllByTestId('table-sort')
    expect(headers.map(h => h.tabIndex)).toEqual([0, -1, -1, -1, -1])
    headers[0].focus()
    fireEvent.keyDown(headers[0], { key: 'ArrowRight' })
    expect(document.activeElement).toBe(headers[1])
    expect(headers.map(h => h.tabIndex)).toEqual([-1, 0, -1, -1, -1])
    fireEvent.keyDown(headers[1], { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(headers[0])
  })

  it('renders plain headers while the block is still streaming or when there is a single row', () => {
    const { container, rerender } = render(<MarkdownRenderer content={TABLE} streaming />)
    expect(screen.queryByTestId('table-sort')).toBeNull()
    expect(container.querySelector('th')!.getAttribute('aria-sort')).toBeNull()
    rerender(<MarkdownRenderer content={TABLE.split('\n').slice(0, 3).join('\n')} />)
    expect(screen.queryByTestId('table-sort')).toBeNull()
    expect(screen.queryByTestId('table-chart-toggle')).toBeNull()
  })
})

describe('markdown table numeric columns', () => {
  it('right-aligns every cell of a column whose body cells are numbers, blanks, currency or percentages, and leaves text columns alone', () => {
    const { container } = render(<MarkdownRenderer content={`${TABLE}\n| totals | 4,455 | 15 | 112 | 50% |`} />)
    const headerCls = Array.from(container.querySelectorAll('thead th')).map(th => th.className)
    expect(headerCls[0]).not.toMatch(/\btext-right\b/)
    for (const cls of headerCls.slice(1)) expect(cls).toMatch(/\btext-right\b.*\btabular-nums\b|\btabular-nums\b.*\btext-right\b/)
    const firstRow = Array.from(container.querySelectorAll('tbody tr:first-child td')).map(td => td.className)
    expect(firstRow[0]).not.toMatch(/\btext-right\b/)
    for (const cls of firstRow.slice(1)) expect(cls).toMatch(/\btext-right\b/)
    // The text is the author's, byte for byte: nothing is reformatted.
    expect(container.querySelector('tbody tr:first-child td:nth-child(2)')!.textContent).toBe('1,250')
    expect(container.querySelector('tbody tr:nth-child(3) td:nth-child(4)')!.textContent).toBe('9.4')
  })

  it('treats a column with one non-numeric cell as text', () => {
    const { container } = render(<MarkdownRenderer content={`${TABLE}\n| legacy | n/a | 1 | 2 | $3 |`} />)
    const runsHeader = container.querySelectorAll('thead th')[1]
    expect(runsHeader.className).not.toMatch(/\btext-right\b/)
    expect(container.querySelectorAll('thead th')[2].className).toMatch(/\btext-right\b/)
  })
})

describe('markdown table chart', () => {
  it('starts hidden, shows one bar per row for the picked numeric column in the table\'s sort order, and hides again', () => {
    const { container } = render(<MarkdownRenderer content={TABLE} />)
    expect(screen.queryByTestId('table-chart')).toBeNull()
    const toggle = screen.getByTestId('table-chart-toggle')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveAttribute('aria-label', 'Show chart')
    expect(toggle.querySelector('svg.lucide-chart-column')).not.toBeNull()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveAttribute('aria-label', 'Hide chart')
    const bars = screen.getByTestId('table-chart-bars')
    expect(bars).toHaveAttribute('role', 'img')
    expect(bars).toHaveAttribute('aria-label', 'Bar chart of Runs')
    expect(bars.querySelectorAll('rect')).toHaveLength(4)
    expect(bars.querySelector('rect')!.getAttribute('fill')).toBe('var(--accent)')
    const labels = () => Array.from(screen.getByTestId('table-chart').querySelectorAll('ol:first-of-type li')).map(li => li.textContent)
    expect(labels()).toEqual(['gateway', 'indexer', 'mailer', 'search'])
    // The widest bar is the largest value, as a percentage of the chart.
    const widths = Array.from(bars.querySelectorAll('rect')).map(r => parseFloat(r.getAttribute('width')!))
    expect(Math.max(...widths)).toBe(100)
    expect(widths[3]).toBe(100)

    // Sorting the table re-draws the chart in the new order.
    fireEvent.click(screen.getAllByTestId('table-sort')[1])
    expect(labels()).toEqual(['mailer', 'indexer', 'gateway', 'search'])

    fireEvent.click(toggle)
    expect(screen.queryByTestId('table-chart')).toBeNull()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('offers no chart for a table with no numeric column', () => {
    render(<MarkdownRenderer content={'| a | b |\n| --- | --- |\n| x | y |\n| z | w |'} />)
    expect(screen.getAllByTestId('table-sort')).toHaveLength(2)
    expect(screen.queryByTestId('table-chart-toggle')).toBeNull()
  })

  it('draws a blank cell as a label with no bar, and a negative value from a zero line', () => {
    render(<MarkdownRenderer content={'| Day | Delta |\n| --- | --- |\n| Mon | -5 |\n| Tue |  |\n| Wed | 10 |'} />)
    fireEvent.click(screen.getByTestId('table-chart-toggle'))
    const bars = screen.getByTestId('table-chart-bars')
    expect(bars.querySelectorAll('rect')).toHaveLength(2)
    expect(bars.querySelector('line')).not.toBeNull()
    expect(screen.getByTestId('table-chart').querySelectorAll('ol:first-of-type li')).toHaveLength(3)
  })
})
