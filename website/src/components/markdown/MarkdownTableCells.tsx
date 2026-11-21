import React, { useContext } from 'react'
import type { Element as HastElement } from 'hast'
import { SortArrow } from '../SortableHeader'
import { MarkdownTableCtx } from './contexts'
import { spa } from './elements'
import { MD_TABLE_CELL_CLS, MD_TABLE_HEAD_CELL_CLS } from './typography'

/**
 * The `th` / `td` overrides of a chat table, with the table's view state
 * applied: a header cell holds a sort button, and a cell in a numeric column
 * is right-aligned with tabular figures. Cell text is never changed.
 *
 * Outside a `MarkdownTableCtx` (a table `readTable` could not model, one still
 * streaming, one with a single row, or a host that renders cells on their
 * own) both render the plain cell they always did: same element, same
 * classes, same forwarded attributes.
 */

/** A numeric column's cells: right-aligned, digits of equal width so the
 *  decimal points line up down the column. */
const NUMERIC_CELL_CLS = 'text-right tabular-nums'

/** The sort button restates the header's type scale rather than inheriting
 *  it, for the reason `SortableTableHead` gives: Tailwind's preflight resets a
 *  button's `font-size` to the browser default, not the cell's. */
const SORT_BTN_CLS = 'inline-flex max-w-full items-center gap-1 cursor-pointer bg-transparent border-none p-0 text-[13px] font-semibold text-text-strong hover:text-accent'

/** Every sort button of the row the event came from, in column order. */
function rowSortButtons(from: HTMLElement): HTMLButtonElement[] {
  return Array.from(from.closest('tr')?.querySelectorAll<HTMLButtonElement>('th > button[data-testid="table-sort"]') ?? [])
}

export function MdTableHeadCell({ node, children }: { node?: HastElement; children?: React.ReactNode }) {
  const view = useContext(MarkdownTableCtx)
  const col = node ? view?.headerIndex.get(node) : undefined
  const numeric = node != null && view?.numericCells.has(node) === true
  const className = `${MD_TABLE_HEAD_CELL_CLS} whitespace-nowrap${numeric ? ` ${NUMERIC_CELL_CLS}` : ''}`
  if (view == null || col == null) return <th {...spa('th', node)} className={className}>{children}</th>
  const active = view.sort.key === String(col) && view.sort.dir != null
  // ArrowLeft / ArrowRight walk the header's buttons; only one of them takes
  // Tab, so a wide table costs the keyboard one stop, not one per column.
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    const buttons = rowSortButtons(e.currentTarget)
    const at = buttons.indexOf(e.currentTarget)
    const next = buttons[at + (e.key === 'ArrowRight' ? 1 : -1)]
    if (!next) return
    e.preventDefault()
    next.focus()
  }
  // The header's accessible name stays its own text (the button holds it), and
  // `aria-sort` carries the order, as the dashboard's `SortableHeader` does.
  return (
    <th {...spa('th', node)} className={className} aria-sort={active ? (view.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={SORT_BTN_CLS} data-testid="table-sort"
        tabIndex={col === view.focusCol ? 0 : -1}
        onFocus={() => view.setFocusCol(col)} onKeyDown={onKeyDown} onClick={() => view.toggleSort(col)}>
        {children}
        {active && <SortArrow dir={view.sort.dir} />}
      </button>
    </th>
  )
}

export function MdTableCell({ node, children }: { node?: HastElement; children?: React.ReactNode }) {
  const view = useContext(MarkdownTableCtx)
  const numeric = node != null && view?.numericCells.has(node) === true
  return <td {...spa('td', node)} className={numeric ? `${MD_TABLE_CELL_CLS} ${NUMERIC_CELL_CLS}` : MD_TABLE_CELL_CLS}>{children}</td>
}
