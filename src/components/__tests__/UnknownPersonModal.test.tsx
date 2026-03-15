import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UnknownPersonModal from '../UnknownPersonModal'

// CSS import in the component is a no-op in jsdom
vi.mock('../UnknownPersonModal.css', () => ({}))

function setup(props?: Partial<React.ComponentProps<typeof UnknownPersonModal>>) {
  const defaults = {
    name: 'John Doe',
    peopleCount: 0,
    onIgnore: vi.fn(),
    onAdd: vi.fn(),
  }
  return { user: userEvent.setup(), ...render(<UnknownPersonModal {...defaults} {...props} />) }
}

describe('UnknownPersonModal', () => {
  it('renders the person name in the heading', () => {
    setup({ name: 'John Doe' })
    expect(screen.getByText('Invite John Doe?')).toBeInTheDocument()
  })

  it('Add button is disabled when email is empty', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
  })

  it('Add button enables after typing an email', async () => {
    const { user } = setup()
    await user.type(screen.getByPlaceholderText('Email address'), 'john@example.com')
    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled()
  })

  it('calls onAdd with trimmed email and saveToDefaults on submit', async () => {
    const onAdd = vi.fn()
    const { user } = setup({ onAdd })
    await user.type(screen.getByPlaceholderText('Email address'), '  john@example.com  ')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(onAdd).toHaveBeenCalledWith('john@example.com', expect.any(Boolean))
  })

  it('calls onIgnore when Ignore is clicked', async () => {
    const onIgnore = vi.fn()
    const { user } = setup({ onIgnore })
    await user.click(screen.getByRole('button', { name: 'Ignore' }))
    expect(onIgnore).toHaveBeenCalledOnce()
  })

  it('shows eviction note when people list is full and saveToDefaults is checked', async () => {
    const { user } = setup({ peopleCount: 10 })
    // saveToDefaults starts unchecked when full; check it
    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)
    expect(screen.getByText(/Least recently used contact will be removed/)).toBeInTheDocument()
  })
})
