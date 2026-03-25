import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DateRangePicker from '../DateRangePicker'

vi.mock('../DateRangePicker.css', () => ({}))

const start = new Date('2024-03-04T00:00:00')
const end = new Date('2024-03-08T00:00:00')

function setup(props?: Partial<React.ComponentProps<typeof DateRangePicker>>) {
  const defaults = {
    initialStart: start,
    initialEnd: end,
    onApply: vi.fn(),
    onCancel: vi.fn(),
  }
  return { user: userEvent.setup(), ...render(<DateRangePicker {...defaults} {...props} />) }
}

describe('DateRangePicker', () => {
  it('renders the current month and year', () => {
    setup()
    expect(screen.getByText('March 2024')).toBeInTheDocument()
  })

  it('renders day-of-week headers', () => {
    setup()
    expect(screen.getByText('Su')).toBeInTheDocument()
    expect(screen.getByText('Sa')).toBeInTheDocument()
  })

  it('renders Cancel and Copy buttons', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
  })

  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn()
    const { user } = setup({ onCancel })
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onApply with start and end dates when Copy is clicked', async () => {
    const onApply = vi.fn()
    const { user } = setup({ onApply })
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    expect(onApply).toHaveBeenCalledWith(
      expect.any(Date),
      expect.any(Date),
    )
  })

  it('navigates to previous month on ‹ click', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: '‹' }))
    expect(screen.getByText('February 2024')).toBeInTheDocument()
  })

  it('navigates to next month on › click', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: '›' }))
    expect(screen.getByText('April 2024')).toBeInTheDocument()
  })

  it('displays the selected date range label', () => {
    setup()
    // Range Mar 4 - Mar 8 should appear somewhere in footer
    expect(screen.getByText(/Mar 4/)).toBeInTheDocument()
    expect(screen.getByText(/Mar 8/)).toBeInTheDocument()
  })

  // ─── Date-selection interactions ─────────────────────────────────────────

  it('two-phase selection: clicking start then end calls onApply with correct dates', async () => {
    const onApply = vi.fn()
    const { user } = setup({ onApply })
    // Phase 1: pick start = March 10
    await user.click(screen.getAllByRole('button', { name: '10' })[0])
    // Phase 2: pick end = March 14
    await user.click(screen.getAllByRole('button', { name: '14' })[0])
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    const [s, e] = onApply.mock.calls[0] as [Date, Date]
    expect(s.getDate()).toBe(10)
    expect(s.getMonth()).toBe(2) // March = 2
    expect(e.getDate()).toBe(14)
  })

  it('reverses the range when end click is before start', async () => {
    const onApply = vi.fn()
    const { user } = setup({ onApply })
    // Click 20 first (start phase), then 10 (end phase — before start)
    await user.click(screen.getAllByRole('button', { name: '20' })[0])
    await user.click(screen.getAllByRole('button', { name: '10' })[0])
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    const [s, e] = onApply.mock.calls[0] as [Date, Date]
    expect(s.getDate()).toBe(10)
    expect(e.getDate()).toBe(20)
  })

  it('single-day selection: start equals end when same day clicked twice', async () => {
    const onApply = vi.fn()
    const { user } = setup({ onApply })
    await user.click(screen.getAllByRole('button', { name: '15' })[0]) // phase 1 → start+end = 15
    await user.click(screen.getAllByRole('button', { name: '15' })[0]) // phase 2 → end = 15
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    const [s, e] = onApply.mock.calls[0] as [Date, Date]
    expect(s.getDate()).toBe(15)
    expect(e.getDate()).toBe(15)
  })

  it('caps the end date at MAX_DAYS (14) from the start', async () => {
    const onApply = vi.fn()
    const { user } = setup({ onApply })
    // Start = March 1, End attempt = March 31 → should be capped at March 14
    await user.click(screen.getAllByRole('button', { name: '1' })[0])
    await user.click(screen.getAllByRole('button', { name: '31' })[0])
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    const [s, e] = onApply.mock.calls[0] as [Date, Date]
    expect(s.getDate()).toBe(1)
    expect(e.getDate()).toBe(14) // March 1 + 13 days = March 14
  })

  it('updates the range label after selecting new dates', async () => {
    const { user } = setup()
    await user.click(screen.getAllByRole('button', { name: '12' })[0])
    await user.click(screen.getAllByRole('button', { name: '16' })[0])
    expect(screen.getByText(/Mar 12/)).toBeInTheDocument()
    expect(screen.getByText(/Mar 16/)).toBeInTheDocument()
  })
})
