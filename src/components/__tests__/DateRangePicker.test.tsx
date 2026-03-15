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
})
