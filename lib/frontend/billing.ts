import { apiRequest, throwFromResponse } from './http'

const BILLING_API_BASE = '/api'

// Wire booleans are integer 0/1 to match SQLite storage.
export type BoolInt = 0 | 1

export type Billing = {
  id: number
  roomId: number
  electricity: number | null
  water: number | null
  maintain: number | null
  trashMaintain: number | null
  meterMaintain: number | null
  isPayRent: BoolInt | null
  isPaid: BoolInt | null
  createdAt: string | null
  updatedAt: string | null
}

export type BillingBody = {
  roomId: number
  electricity?: number | null
  water?: number | null
  maintain?: number | null
  trashMaintain?: number | null
  meterMaintain?: number | null
}

export type BillingPatch = {
  electricity?: number | null
  water?: number | null
  maintain?: number | null
  trashMaintain?: number | null
  meterMaintain?: number | null
}

export type ListBillingsParams = {
  buildingId?: number
  roomId?: number
  date?: string
  page?: number
  pageSize?: number
}

export type ListBillingsResponse = {
  data: Billing[]
  total: number
  page: number
  pageSize: number
}

export type PayTarget = 'rent' | 'other'

export async function createBilling(body: BillingBody): Promise<Billing> {
  const res = await apiRequest(`${BILLING_API_BASE}/billings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) await throwFromResponse(res)
  return res.json() as Promise<Billing>
}

export async function listBillings(
  params: ListBillingsParams = {},
): Promise<ListBillingsResponse> {
  const query = new URLSearchParams()
  if (params.buildingId != null) query.set('buildingId', String(params.buildingId))
  if (params.roomId != null) query.set('roomId', String(params.roomId))
  if (params.date != null) query.set('date', params.date)
  if (params.page != null) query.set('page', String(params.page))
  if (params.pageSize != null) query.set('pageSize', String(params.pageSize))

  const qs = query.toString()
  const url = `${BILLING_API_BASE}/billings${qs ? `?${qs}` : ''}`
  const res = await apiRequest(url)
  if (!res.ok) await throwFromResponse(res)
  return res.json() as Promise<ListBillingsResponse>
}

export async function updateBilling(id: number, patch: BillingPatch): Promise<Billing> {
  const res = await apiRequest(`${BILLING_API_BASE}/billings/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) await throwFromResponse(res)
  return res.json() as Promise<Billing>
}

// Mark a portion of a billing paid.
// target='rent'  → sets isPayRent = 1
// target='other' (default) → sets isPaid = 1
export async function payBilling(id: number, target: PayTarget = 'other'): Promise<Billing> {
  const url = `${BILLING_API_BASE}/billings/${id}/pay?target=${encodeURIComponent(target)}`
  const res = await apiRequest(url, { method: 'PATCH' })
  if (!res.ok) await throwFromResponse(res)
  return res.json() as Promise<Billing>
}
