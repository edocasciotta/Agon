import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { OnboardingPage } from '../../../src/renderer/src/pages/Onboarding/index'

vi.mock('../../../src/renderer/src/api/studio', () => ({
  studioApi: {
    update: vi.fn().mockResolvedValue({}),
    saveAiKey: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('OnboardingPage', () => {
  it('renders onboarding wizard with 6 steps', () => {
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    )

    // 6 step circles should be present (each shows its step number or a checkmark)
    const stepCircles = screen.getAllByText(/^[1-6]$/)
    expect(stepCircles).toHaveLength(6)
  })
})
