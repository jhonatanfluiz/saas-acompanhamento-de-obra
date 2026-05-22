import { render, screen } from '@testing-library/react'
import Header from '../Header'
import { describe, it, expect, vi } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => {
  const mockRouter = {
    replace: vi.fn(),
    push: vi.fn(),
    prefetch: vi.fn(),
  }
  const mockSearchParams = new URLSearchParams()
  return {
    useRouter: () => mockRouter,
    useSearchParams: () => mockSearchParams,
  }
})

describe('Header Component', () => {
  it('renders the search input', () => {
    render(<Header />)
    const searchInput = screen.getByPlaceholderText(/Buscar obras.../i)
    expect(searchInput).toBeInTheDocument()
  })

  it('renders the user name', () => {
    render(<Header />)
    const userName = screen.getByText(/Eng. João Silva/i)
    expect(userName).toBeInTheDocument()
  })

  it('renders the bell icon', () => {
    render(<Header />)
    const bellButton = screen.getByRole('button', { name: /Notificações/i })
    expect(bellButton).toBeInTheDocument()
  })
})
