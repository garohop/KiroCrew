import type { Meta, StoryObj } from '@storybook/react-vite'
import MarkdownRenderer from '../components/MarkdownRenderer'

/**
 * A chat Markdown table once its block has settled: sortable headers, numeric
 * columns right-aligned with tabular figures, and the Show chart action that
 * draws a picked numeric column as bars under the table.
 *
 * The content is a realistic agent reply: one text column and four numeric
 * ones with mixed decimals, a thousands separator, a currency column and a
 * blank cell. Sorting and the chart are interactions, so the captures that
 * show them (kirocrew-contrib/tables-prototype) click a header and the chart
 * toggle on this story rather than mocking the state.
 */
const meta = {
  title: 'Chat/MarkdownTable',
  component: MarkdownRenderer,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof MarkdownRenderer>

export default meta
type Story = StoryObj<typeof meta>

export const RunsBySevice: Story = {
  name: 'Runs by service',
  args: {
    content: [
      'Last night\'s scheduled runs, per service:',
      '',
      '| Service | Runs | Errors | p95 ms | Cost |',
      '| --- | --- | --- | --- | --- |',
      '| gateway | 1,250 | 3 | 48.5 | $12.10 |',
      '| indexer | 980 | 0 | 112 | $4.75 |',
      '| mailer | 15 | 12 | 9.4 | $0.80 |',
      '| search | 2,210 |  | 61.25 | $18.00 |',
      '| memory-ingest | 42 | 1 | 1304.2 | $2.05 |',
      '| lookout | 7 | 0 | 220 | $0.35 |',
      '| weblab-watch | 310 | 2 | 87.75 | $1.60 |',
    ].join('\n'),
  },
}
