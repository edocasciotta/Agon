import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { SetPassword } from '../../../src/renderer/src/pages/SetPassword'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../../../src/renderer/src/api/auth', () => ({
  authApi: {
    validateInvite: vi.fn(),
    resetPassword: vi.fn(),
  },
}))

import { authApi } from '../../../src/renderer/src/api/auth'

const mockValidateInvite = authApi.validateInvite as ReturnType<typeof vi.fn>
const mockResetPassword = authApi.resetPassword as ReturnType<typeof vi.fn>

function renderWithToken(token = 'valid-token') {
  return render(
    <MemoryRouter initialEntries={[`/set-password?token=${token}`]}>
      <SetPassword />
    </MemoryRouter>
  )
}

describe('SetPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state initially', () => {
    mockValidateInvite.mockReturnValue(new Promise(() => {}))
    renderWithToken()
    expect(screen.getByText(/Verifying your invite link/i)).toBeTruthy()
  })

  it('shows form after valid token validation', async () => {
    mockValidateInvite.mockResolvedValue({
      client_id: 1,
      email: 'test@example.com',
      full_name: 'Test User',
      token_valid: true,
    })
    renderWithToken()
    await waitFor(() => {
      expect(screen.getByText('Set your password')).toBeTruthy()
    })
    expect(screen.getByText('test@example.com')).toBeTruthy()
  })

  it('shows invalid error for bad token', async () => {
    mockValidateInvite.mockRejectedValue({ code: 'INVITATION_NOT_FOUND' })
    renderWithToken()
    await waitFor(() => {
      expect(screen.getByText(/invalid or has already been used/i)).toBeTruthy()
    })
  })

  it('shows expired error for expired token', async () => {
    mockValidateInvite.mockRejectedValue({ code: 'INVITATION_EXPIRED' })
    renderWithToken()
    await waitFor(() => {
      expect(screen.getByText(/invitation link has expired/i)).toBeTruthy()
    })
  })

  it('shows invalid state when no token in URL', async () => {
    render(
      <MemoryRouter initialEntries={['/set-password']}>
        <SetPassword />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText(/invalid or has already been used/i)).toBeTruthy()
    })
  })

  it('validates password length client-side', async () => {
    mockValidateInvite.mockResolvedValue({
      client_id: 1,
      email: 'test@example.com',
      full_name: 'Test',
      token_valid: true,
    })
    renderWithToken()
    await waitFor(() => screen.getByText('Set your password'))

    fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), { target: { value: 'short' } })
    fireEvent.change(screen.getByPlaceholderText('Repeat your password'), { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: 'Set password' }))

    expect(screen.getByText(/at least 8 characters/i)).toBeTruthy()
    expect(mockResetPassword).not.toHaveBeenCalled()
  })

  it('validates password match client-side', async () => {
    mockValidateInvite.mockResolvedValue({
      client_id: 1,
      email: 'test@example.com',
      full_name: 'Test',
      token_valid: true,
    })
    renderWithToken()
    await waitFor(() => screen.getByText('Set your password'))

    fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByPlaceholderText('Repeat your password'), { target: { value: 'different123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Set password' }))

    expect(screen.getByText(/Passwords do not match/i)).toBeTruthy()
    expect(mockResetPassword).not.toHaveBeenCalled()
  })

  it('submits and shows success state', async () => {
    mockValidateInvite.mockResolvedValue({
      client_id: 1,
      email: 'test@example.com',
      full_name: 'Test',
      token_valid: true,
    })
    mockResetPassword.mockResolvedValue({ message: 'Password updated' })
    renderWithToken()
    await waitFor(() => screen.getByText('Set your password'))

    fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), { target: { value: 'newpassword1' } })
    fireEvent.change(screen.getByPlaceholderText('Repeat your password'), { target: { value: 'newpassword1' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Set password' }))
    })

    await waitFor(() => {
      expect(screen.getByText('Password set!')).toBeTruthy()
    })
    expect(mockResetPassword).toHaveBeenCalledWith('valid-token', 'newpassword1')
  })

  it('navigates to login on success button click', async () => {
    mockValidateInvite.mockResolvedValue({
      client_id: 1,
      email: 'test@example.com',
      full_name: 'Test',
      token_valid: true,
    })
    mockResetPassword.mockResolvedValue({ message: 'Password updated' })
    renderWithToken()
    await waitFor(() => screen.getByText('Set your password'))

    fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), { target: { value: 'newpassword1' } })
    fireEvent.change(screen.getByPlaceholderText('Repeat your password'), { target: { value: 'newpassword1' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Set password' }))
    })

    await waitFor(() => screen.getByText('Go to login'))
    fireEvent.click(screen.getByText('Go to login'))

    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
  })
})
