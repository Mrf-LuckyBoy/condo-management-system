import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as condo from '@/lib/frontend/condo-management'
import * as billing from '@/lib/frontend/billing'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockResolvedValue(Response.json({ id: 7 }))
})
afterEach(() => vi.unstubAllGlobals())

describe('frontend API connection', () => {
  const cases: Array<{ name: string; call: () => Promise<unknown>; path: string; method?: string; body?: unknown }> = [
    { name: 'buildings', call: () => condo.listBuildings(), path: '/api/condo_management/buildings' },
    { name: 'building detail', call: () => condo.fetchBuildingDetail(7), path: '/api/condo_management/buildings/7' },
    { name: 'create building', call: () => condo.createBuilding({ buildingName: 'A' }), path: '/api/condo_management/buildings', method: 'POST', body: { buildingName: 'A' } },
    { name: 'update building', call: () => condo.updateBuilding(7, { ownerName: null }), path: '/api/condo_management/buildings/7', method: 'PATCH', body: { ownerName: null } },
    { name: 'delete building', call: () => condo.deleteBuilding(7), path: '/api/condo_management/buildings/7', method: 'DELETE' },
    { name: 'building settings', call: () => condo.fetchBuildingSetting(7), path: '/api/condo_management/buildings/7/setting' },
    { name: 'save settings', call: () => condo.upsertBuildingSetting(7, { electricityPerUnit: 8 }), path: '/api/condo_management/buildings/7/setting', method: 'PUT', body: { electricityPerUnit: 8 } },
    { name: 'room filters', call: () => condo.listRooms({ buildingId: 7, activeOnly: false, page: 2, pageSize: 10 }), path: '/api/condo_management/rooms?buildingId=7&activeOnly=false&page=2&pageSize=10' },
    { name: 'room detail', call: () => condo.fetchRoom(7), path: '/api/condo_management/rooms/7' },
    { name: 'create room', call: () => condo.createRoom({ buildingId: 7, roomNumber: 101 }), path: '/api/condo_management/rooms', method: 'POST', body: { buildingId: 7, roomNumber: 101 } },
    { name: 'update room', call: () => condo.updateRoom(7, { isActive: 0 }), path: '/api/condo_management/rooms/7', method: 'PATCH', body: { isActive: 0 } },
    { name: 'delete room', call: () => condo.deleteRoom(7), path: '/api/condo_management/rooms/7', method: 'DELETE' },
    { name: 'meter logs', call: () => condo.fetchRoomMeterLogs(7, { pageSize: 2 }), path: '/api/condo_management/rooms/7/meter-logs?pageSize=2' },
    { name: 'meter export', call: () => condo.exportBuildingMeterRooms(7), path: '/api/condo_management/buildings/7/rooms/meter/export' },
    { name: 'bulk meters', call: () => condo.bulkUpdateMeters([{ roomId: 7, waterUnit: 0 }]), path: '/api/condo_management/rooms/meter/bulk-update', method: 'POST', body: { items: [{ roomId: 7, waterUnit: 0 }] } },
    { name: 'bulk activation', call: () => condo.bulkSetRoomsActive([7], 0), path: '/api/condo_management/rooms/bulk-active', method: 'POST', body: { roomIds: [7], isActive: 0 } },
    { name: 'generate bills', call: () => condo.generateBillsForBuilding(7), path: '/api/condo_management/buildings/7/bills/generate', method: 'POST' },
    { name: 'billing filters', call: () => billing.listBillings({ buildingId: 7, roomId: 8, date: '2026-10-01', page: 2, pageSize: 10 }), path: '/api/billings?buildingId=7&roomId=8&date=2026-10-01&page=2&pageSize=10' },
    { name: 'create bill', call: () => billing.createBilling({ roomId: 7, water: 25 }), path: '/api/billings', method: 'POST', body: { roomId: 7, water: 25 } },
    { name: 'update bill', call: () => billing.updateBilling(7, { water: null }), path: '/api/billings/7', method: 'PATCH', body: { water: null } },
    { name: 'pay rent', call: () => billing.payBilling(7, 'rent'), path: '/api/billings/7/pay?target=rent', method: 'PATCH' },
    { name: 'pay utilities', call: () => billing.payBilling(7), path: '/api/billings/7/pay?target=other', method: 'PATCH' },
  ]

  it.each(cases)('$name uses the matching same-origin API route', async ({ call, path, method = 'GET', body }) => {
    await expect(call()).resolves.toEqual({ id: 7 })
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe(path)
    expect(options).toMatchObject({ mode: 'same-origin', credentials: 'same-origin', cache: 'no-store' })
    expect(options?.method ?? 'GET').toBe(method)
    expect(options?.body).toBe(body === undefined ? undefined : JSON.stringify(body))
    if (body !== undefined) expect(options?.headers).toEqual({ 'Content-Type': 'application/json' })
  })

  it('converts real dropdown responses to combobox items', async () => {
    fetchMock.mockResolvedValueOnce(Response.json([{ id: 7, buildingName: 'A' }]))
    await expect(condo.fetchBuildings()).resolves.toEqual([{ id: 7, label: 'A' }])
    expect(fetchMock.mock.calls[0][0]).toBe('/api/condo_management/buildings/dropdown')
    fetchMock.mockResolvedValueOnce(Response.json([{ id: 8, roomNumber: 101 }]))
    await expect(condo.fetchRooms({ buildingId: 7, activeOnly: true })).resolves.toEqual([{ id: 8, label: 'Room 101' }])
    expect(fetchMock.mock.calls[1][0]).toBe('/api/condo_management/rooms/dropdown?buildingId=7&activeOnly=true')
  })

  it('displays API validation errors without reporting successful saves', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ message: 'Building not found' }, { status: 404 }))
    await expect(condo.upsertBuildingSetting(7, {})).rejects.toThrow('Building not found')
    fetchMock.mockResolvedValueOnce(Response.json({ message: 'Billing already exists' }, { status: 400 }))
    await expect(billing.createBilling({ roomId: 7 })).rejects.toThrow('Billing already exists')
  })

  it('handles plain-text server errors and network failures', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Service unavailable', { status: 503 }))
    await expect(condo.listBuildings()).rejects.toThrow('Service unavailable')
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(billing.payBilling(7)).rejects.toThrow('Failed to fetch')
  })
})
