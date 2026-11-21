import { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { i18nT } from '../../i18n/t'
import SimpleSelect from '../SimpleSelect'
import { parseNumeric, type TableModel } from './tableData'

/** One bar's row: the bar's height plus the gap under it. */
const ROW_H = 22
const BAR_H = 14
/** How much of the panel the row labels may take before they ellipsize. */
const LABEL_W = 'w-[9em] max-w-[40%]'

/** The column picker runs at the action row's density, not a settings page's. */
const SELECT_CLS = 'h-6 px-1.5 py-0 text-[12px]'

/**
 * A horizontal bar chart of one numeric column of a chat table, under the
 * table. Labels come from the first column, the bars from `column`, in the
 * table's current display order (`order`), so sorting the table re-draws it.
 *
 * The bars are one inline SVG with percentage geometry, so the chart is as
 * wide as the table and needs no measurement; the labels and the values sit
 * beside it in HTML, one line per bar, so they stay real text at the
 * transcript's size on any width (a `viewBox` would scale them below 10px on
 * a phone). Colours are the theme's variables (`var(--accent)`,
 * `var(--border)`), nothing fixed. The SVG is named for a screen reader as
 * the chart of its column; the label and value lists beside it read as the
 * data. Negative values draw from a zero line to the left; a blank cell lists
 * its label with no bar.
 *
 * The panel fades and grows in under Framer, and appears in place when the
 * reader prefers reduced motion.
 */
export function MarkdownTableChart({ model, numeric, order, column, onColumn }: {
  model: TableModel
  /** Per column, whether it is numeric (`tableData.numericColumns`). */
  numeric: boolean[]
  order: number[]
  column: number
  onColumn: (col: number) => void
}) {
  const pickerId = useId()
  const reduceMotion = useReducedMotion()
  const rows = order.map(i => {
    const text = model.body[i]?.[column] ?? ''
    return { label: model.body[i]?.[0] ?? '', value: parseNumeric(text), shown: text }
  })
  const values = rows.map(r => r.value).filter((v): v is number => v != null)
  const lo = Math.min(0, ...values)
  const hi = Math.max(0, ...values)
  const span = hi - lo || 1
  const pct = (v: number) => ((v - lo) / span) * 100
  const zero = pct(0)
  const height = rows.length * ROW_H
  const numericCols = numeric.map((n, i) => (n ? i : -1)).filter(i => i >= 0)
  const title = model.header[column] ?? ''

  return (
    <motion.div
      className="mt-1.5 overflow-hidden rounded border border-border p-2"
      data-testid="table-chart"
      initial={reduceMotion ? false : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      transition={{ duration: 0.18 }}
    >
      <div className="mb-1.5 flex items-center justify-end gap-1.5 text-[12px] text-muted">
        <label htmlFor={pickerId}>{i18nT('components.markdownRenderer.chart_column')}</label>
        <SimpleSelect id={pickerId} className={SELECT_CLS} options={numericCols.map(String)} optionLabels={numericCols.map(i => model.header[i])}
          value={String(column)} onChange={v => onColumn(Number(v))} />
      </div>
      <div className="flex items-start gap-2 text-[12px] leading-none">
        <ol className={`m-0 list-none p-0 shrink-0 ${LABEL_W}`}>
          {rows.map((r, i) => (
            <li key={order[i]} className="truncate text-text" style={{ height: ROW_H, lineHeight: `${ROW_H}px` }} title={r.label}>{r.label}</li>
          ))}
        </ol>
        <svg className="min-w-0 flex-1" width="100%" height={height} role="img" aria-label={i18nT('components.markdownRenderer.chart_of_column', { column: title })} data-testid="table-chart-bars">
          {lo < 0 && <line x1={`${zero}%`} x2={`${zero}%`} y1={0} y2={height} stroke="var(--border)" strokeWidth={1} />}
          {rows.map((r, i) => r.value == null ? null : (
            <rect
              key={order[i]}
              x={`${Math.min(zero, pct(r.value))}%`}
              y={i * ROW_H + (ROW_H - BAR_H) / 2}
              width={`${Math.abs(pct(r.value) - zero)}%`}
              height={BAR_H}
              rx={2}
              fill="var(--accent)"
            />
          ))}
        </svg>
        <ol className="m-0 list-none p-0 shrink-0 text-right tabular-nums text-text-strong">
          {rows.map((r, i) => (
            <li key={order[i]} style={{ height: ROW_H, lineHeight: `${ROW_H}px` }}>{r.shown}</li>
          ))}
        </ol>
      </div>
    </motion.div>
  )
}
