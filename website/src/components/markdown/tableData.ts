import type { Element as HastElement, ElementContent } from 'hast'
import { collator } from '../../i18n/format'
import { PLAIN_NUMBER, plainCell } from '../../utils/tableClipboard'

/**
 * What the chat table's view state (sort, numeric alignment, the chart) reads
 * from the hast `<table>` react-markdown hands `MarkdownTable`.
 *
 * Everything here is derived from the parsed tree, never from the DOM, for
 * the same reasons `tableClipboard.ts` gives: inline-code chips carry UI a
 * text walk cannot tell from content, and the hast node is the document as
 * parsed. The cells' plain text is the CSV copy's text, so a column sorts and
 * charts by exactly what a spreadsheet would receive. Cell text is never
 * rewritten: a numeric column changes alignment and sort order only.
 */

/** Fewer body rows than this and there is nothing to sort or chart, so the
 *  table renders exactly as it always did (no sort buttons, no chart). */
export const MIN_ROWS_TO_SORT = 2

export type SortDir = 'asc' | 'desc'

export interface TableModel {
  /** The single header row's cells, one per column. */
  headerCells: HastElement[]
  header: string[]
  /** The body's `<tr>` elements in source order. */
  bodyRows: HastElement[]
  /** `bodyCells[row][col]`; a short row is padded with `null`. */
  bodyCells: (HastElement | null)[][]
  /** `body[row][col]` as plain text; a missing cell is `''`. */
  body: string[][]
}

const tagOf = (n: ElementContent): string | null => (n.type === 'element' ? n.tagName.toLowerCase() : null)
const rowsOf = (section: HastElement): HastElement[] => section.children.filter((c): c is HastElement => tagOf(c) === 'tr')
const cellsOf = (row: HastElement): HastElement[] => row.children.filter((c): c is HastElement => { const t = tagOf(c); return t === 'th' || t === 'td' })

/** A cell that declares a span: hast keeps React's casing (`colSpan`). */
function spans(cell: HastElement): boolean {
  const p = cell.properties ?? {}
  return p.colSpan != null || p.rowSpan != null
}

/**
 * The table as one header row over a list of body rows, the shape every GFM
 * table has: exactly one `<thead>` holding one `<tr>`, at most one `<tbody>`,
 * and no cell spanning another. A raw-HTML table with a second header row, a
 * `<tfoot>` or a `colspan` returns `null` and keeps its static rendering, as
 * `useMarkdownTableColumns` already does for its grips: reordering rows under
 * a spanning cell would tear the span.
 */
export function readTable(table: HastElement): TableModel | null {
  const sections = table.children.filter((c): c is HastElement => c.type === 'element')
  const theads = sections.filter(s => s.tagName.toLowerCase() === 'thead')
  const tbodies = sections.filter(s => s.tagName.toLowerCase() === 'tbody')
  if (theads.length !== 1 || tbodies.length > 1 || sections.length !== theads.length + tbodies.length) return null
  const headerRows = rowsOf(theads[0])
  if (headerRows.length !== 1) return null
  const headerCells = cellsOf(headerRows[0])
  if (headerCells.length === 0) return null
  const bodyRows = tbodies[0] ? rowsOf(tbodies[0]) : []
  const rawCells = bodyRows.map(cellsOf)
  if (headerCells.some(spans) || rawCells.some(cells => cells.some(spans))) return null
  const width = headerCells.length
  const bodyCells = rawCells.map(cells => Array.from({ length: width }, (_, i) => cells[i] ?? null))
  return {
    headerCells,
    header: headerCells.map(plainCell),
    bodyRows,
    bodyCells,
    body: bodyCells.map(cells => cells.map(c => (c ? plainCell(c) : ''))),
  }
}

/** A leading currency symbol (any Unicode `Sc`: `$`, `€`, `£`, `¥`, `₹`),
 *  after an optional sign. Dropped before the number test, so `$1,250.60`
 *  and `-$5` are numbers; `1,250.60 USD` stays text. */
const CURRENCY_PREFIX = /^([+-]?)\p{Sc}/u

/** The number a cell's plain text spells, or `null` when it is not one: the
 *  CSV copy's own `PLAIN_NUMBER` shape (sign, `,` / `_` / space grouping,
 *  fraction, `%`), with a leading currency symbol allowed. A blank cell is
 *  `null` too; callers that admit blanks test for them first. */
export function parseNumeric(text: string): number | null {
  const bare = text.trim().replace(CURRENCY_PREFIX, '$1')
  if (!PLAIN_NUMBER.test(bare) || !/\d/.test(bare)) return null
  const value = Number(bare.replace(/[,_\s%]/g, ''))
  return Number.isFinite(value) ? value : null
}

/**
 * Per column: `true` when every non-blank body cell parses as a number and at
 * least one does. The header is never consulted, so a `Total` column of
 * numbers is numeric and a column of empty cells is not.
 */
export function numericColumns(body: string[][], width: number): boolean[] {
  return Array.from({ length: width }, (_, col) => {
    let seen = false
    for (const row of body) {
      const text = (row[col] ?? '').trim()
      if (text === '') continue
      if (parseNumeric(text) == null) return false
      seen = true
    }
    return seen
  })
}

/**
 * Body row indices in display order for a sort on `col`. A numeric column
 * orders by value, a text column by the app language's collation (digits
 * inside names compare numerically, case and accents are ignored). Blank
 * cells sit last in BOTH directions, and rows that tie keep their source
 * order, so flipping the direction never shuffles equal rows.
 */
export function sortedRowOrder(body: string[][], col: number, dir: SortDir, numeric: boolean): number[] {
  const texts = body.map(row => (row[col] ?? '').trim())
  const flip = dir === 'asc' ? 1 : -1
  let compare: (a: number, b: number) => number
  if (numeric) {
    const values = texts.map(t => (t === '' ? null : parseNumeric(t)))
    compare = (a, b) => {
      const va = values[a]
      const vb = values[b]
      if (va == null || vb == null) return va == null && vb == null ? a - b : va == null ? 1 : -1
      return va === vb ? a - b : flip * (va - vb)
    }
  } else {
    const cmp = collator().compare
    compare = (a, b) => {
      const ta = texts[a]
      const tb = texts[b]
      if (ta === '' || tb === '') return ta === '' && tb === '' ? a - b : ta === '' ? 1 : -1
      const c = cmp(ta, tb)
      return c === 0 ? a - b : flip * c
    }
  }
  return body.map((_, i) => i).sort(compare)
}
