import { waiversApi } from '../src/api/waivers'
import { apiClient } from '../src/api/client'

jest.mock('../src/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}))

describe('waiversApi', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('listForClient calls GET /api/v1/clients/{id}/waivers and returns the response data', async () => {
    const mockWaivers = [
      {
        id: 1,
        location_id: 1,
        title: 'Liability Waiver',
        body: 'I agree...',
        version: 2,
        requires_before_booking: true,
        is_active: true,
        created_at: '2026-01-01T00:00:00',
        updated_at: '2026-01-01T00:00:00',
        is_signed: false,
        signed_at: null,
      },
    ]
    ;(apiClient.get as jest.Mock).mockResolvedValue({ data: mockWaivers })

    const result = await waiversApi.listForClient(42)

    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/clients/42/waivers')
    expect(result).toEqual(mockWaivers)
  })

  it('sign calls POST /api/v1/waivers/{id}/sign with signed_name and returns the response data', async () => {
    const mockSignature = {
      id: 5,
      waiver_id: 1,
      client_id: 42,
      waiver_version: 2,
      signed_name: 'Jane Client',
      signed_at: '2026-07-14T10:00:00',
    }
    ;(apiClient.post as jest.Mock).mockResolvedValue({ data: mockSignature })

    const result = await waiversApi.sign(1, 'Jane Client')

    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/waivers/1/sign', {
      signed_name: 'Jane Client',
    })
    expect(result).toEqual(mockSignature)
  })
})
