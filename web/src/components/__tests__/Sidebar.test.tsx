import { render, screen } from '@testing-library/react'
import Sidebar from '../Sidebar'
import { describe, it, expect, vi } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/dashboard'),
}))

describe('Sidebar Component', () => {
  it('renders the logo and app name', () => {
    render(<Sidebar />)
    expect(screen.getAllByText(/Obra/i)[0]).toBeInTheDocument()
    expect(screen.getAllByText(/SaaS/i)[0]).toBeInTheDocument()
  })

  it('renders all menu items', () => {
    render(<Sidebar />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Obras')).toBeInTheDocument()
    expect(screen.getByText('Fases')).toBeInTheDocument()
    expect(screen.getByText('Perguntas')).toBeInTheDocument()
  })

  it('highlights the active menu item', () => {
    render(<Sidebar />)
    const dashboardLink = screen.getByRole('link', { name: /Dashboard/i })
    expect(dashboardLink).toHaveClass('bg-indigo-50')
    expect(dashboardLink).toHaveClass('text-indigo-700')
  })
})
