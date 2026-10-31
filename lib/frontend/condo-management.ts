import { apiRequest, throwFromResponse } from './http'

const API_BASE = '/api/condo_management'

export type BoolInt = 0 | 1

// ============================================================================
// Domain types
// ============================================================================

export type Building = {
  id: number
  buildingName: string | null
  ownerName: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type SettingBuilding = {
  id: number
  buildingId: number
  electricityPerUnit: number | null
  waterPerUnit: number | null
  baseMaintain: number | null
  trashMaintain: number | null
  meterMaintain: number | null
  createdAt: string | null
  updatedAt: string | null
}

export type Room = {
  id: number
  buildingId: number
  roomNumber: number | null
  rentName: string | null
  rentPrice: number | null
  electricityUnit: number | null
  waterUnit: number | null
  isOwner: BoolInt | null
  isActive: BoolInt | null
  createdAt: string | null
  updatedAt: string | null
}

export type BuildingDetail = Building & {
  setting: SettingBuilding | null
  rooms: Room[]
}

export type MeterLog = {
  id: number
  roomId: number
  oldElectricityUnit: number | null
  newElectricityUnit: number | null
  oldWaterUnit: number | null
  newWaterUnit: number | null
  createdAt: string | null
  updatedAt: string | null
}

export type Paginated<T> = {
  data: T[]
  total: number
  page: number
  pageSize: number
}

// Kept for existing screens that render building/room comboboxes.
export type DropdownItem = { id: number; label: string }

type BuildingDropdownDTO = { id: number; buildingName?: string | null }
type RoomDropdownDTO = { id: number; roomNumber?: string | number | null }

// ============================================================================
// Shared helpers
// ============================================================================

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) await throwFromResponse(res)
  return res.json() as Promise<T>
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue
    search.set(key, String(value))
  }
  const s = search.toString()
  return s ? `?${s}` : ''
}

// ============================================================================
// Buildings
// ============================================================================

export async function listBuildings(): Promise<Building[]> {
  return jsonOrThrow<Building[]>(await apiRequest(`${API_BASE}/buildings`))
}

export async function fetchBuildingDetail(id: number): Promise<BuildingDetail> {
  return jsonOrThrow<BuildingDetail>(await apiRequest(`${API_BASE}/buildings/${id}`))
}

export async function createBuilding(body: {
  buildingName?: string | null
  ownerName?: string | null
}): Promise<Building> {
  return jsonOrThrow<Building>(
    await apiRequest(`${API_BASE}/buildings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function updateBuilding(
  id: number,
  patch: { buildingName?: string | null; ownerName?: string | null },
): Promise<Building> {
  return jsonOrThrow<Building>(
    await apiRequest(`${API_BASE}/buildings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  )
}

export async function deleteBuilding(id: number): Promise<{ id: number; deleted: true }> {
  return jsonOrThrow<{ id: number; deleted: true }>(
    await apiRequest(`${API_BASE}/buildings/${id}`, { method: 'DELETE' }),
  )
}

// Dropdown — light shape used by comboboxes.
export async function fetchBuildings(): Promise<DropdownItem[]> {
  const data = await jsonOrThrow<BuildingDropdownDTO[]>(
    await apiRequest(`${API_BASE}/buildings/dropdown`),
  )
  return data.map((b) => ({ id: b.id, label: b.buildingName ?? `Building #${b.id}` }))
}

// ============================================================================
// Building setting (unit prices)
// ============================================================================

export type BuildingSettingPatch = {
  electricityPerUnit?: number | null
  waterPerUnit?: number | null
  baseMaintain?: number | null
  trashMaintain?: number | null
  meterMaintain?: number | null
}

export async function fetchBuildingSetting(buildingId: number): Promise<SettingBuilding> {
  return jsonOrThrow<SettingBuilding>(
    await apiRequest(`${API_BASE}/buildings/${buildingId}/setting`),
  )
}

export async function upsertBuildingSetting(
  buildingId: number,
  body: BuildingSettingPatch,
): Promise<SettingBuilding> {
  return jsonOrThrow<SettingBuilding>(
    await apiRequest(`${API_BASE}/buildings/${buildingId}/setting`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

// ============================================================================
// Rooms
// ============================================================================

export type ListRoomsParams = {
  buildingId?: number
  activeOnly?: boolean
  page?: number
  pageSize?: number
}

export async function listRooms(params: ListRoomsParams = {}): Promise<Paginated<Room>> {
  const query = qs({
    buildingId: params.buildingId,
    // Backend expects the literal strings "true"/"false".
    activeOnly: params.activeOnly == null ? undefined : String(params.activeOnly),
    page: params.page,
    pageSize: params.pageSize,
  })
  return jsonOrThrow<Paginated<Room>>(await apiRequest(`${API_BASE}/rooms${query}`))
}

export async function fetchRoom(id: number): Promise<Room> {
  return jsonOrThrow<Room>(await apiRequest(`${API_BASE}/rooms/${id}`))
}

export type RoomCreateBody = {
  buildingId: number
  roomNumber?: number | null
  rentName?: string | null
  rentPrice?: number | null
  electricityUnit?: number | null
  waterUnit?: number | null
  isOwner?: BoolInt | null
  isActive?: BoolInt | null
}

// buildingId is not editable — rooms can't move between buildings.
export type RoomPatch = Omit<RoomCreateBody, 'buildingId'>

export async function createRoom(body: RoomCreateBody): Promise<Room> {
  return jsonOrThrow<Room>(
    await apiRequest(`${API_BASE}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function updateRoom(id: number, patch: RoomPatch): Promise<Room> {
  return jsonOrThrow<Room>(
    await apiRequest(`${API_BASE}/rooms/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  )
}

export async function deleteRoom(id: number): Promise<{ id: number; deleted: true }> {
  return jsonOrThrow<{ id: number; deleted: true }>(
    await apiRequest(`${API_BASE}/rooms/${id}`, { method: 'DELETE' }),
  )
}

// Meter change history for a room.
export type MeterLogsParams = { page?: number; pageSize?: number }

export async function fetchRoomMeterLogs(
  roomId: number,
  params: MeterLogsParams = {},
): Promise<Paginated<MeterLog>> {
  const query = qs({ page: params.page, pageSize: params.pageSize })
  return jsonOrThrow<Paginated<MeterLog>>(
    await apiRequest(`${API_BASE}/rooms/${roomId}/meter-logs${query}`),
  )
}

// Rooms dropdown — light shape used by comboboxes.
export type FetchRoomsDropdownParams = { buildingId?: number; activeOnly?: boolean }

export async function fetchRooms(
  paramsOrBuildingId?: number | FetchRoomsDropdownParams,
): Promise<DropdownItem[]> {
  const params: FetchRoomsDropdownParams =
    typeof paramsOrBuildingId === 'number'
      ? { buildingId: paramsOrBuildingId }
      : paramsOrBuildingId ?? {}

  const query = qs({
    buildingId: params.buildingId,
    activeOnly: params.activeOnly == null ? undefined : String(params.activeOnly),
  })
  const data = await jsonOrThrow<RoomDropdownDTO[]>(
    await apiRequest(`${API_BASE}/rooms/dropdown${query}`),
  )
  return data.map((r) => ({
    id: r.id,
    label: r.roomNumber != null ? `Room ${r.roomNumber}` : `Room #${r.id}`,
  }))
}

// ============================================================================
// Meter export (active rooms in a building, shape aligned to bulk update)
// ============================================================================

export type MeterExportItem = {
  roomId: number
  roomNumber: number | null
  rentName: string | null
  electricityUnit: number | null
  waterUnit: number | null
}

export type MeterExportResponse = {
  buildingId: number
  items: MeterExportItem[]
}

export async function exportBuildingMeterRooms(
  buildingId: number,
): Promise<MeterExportResponse> {
  return jsonOrThrow<MeterExportResponse>(
    await apiRequest(`${API_BASE}/buildings/${buildingId}/rooms/meter/export`),
  )
}

// ============================================================================
// Bulk operations
// ============================================================================

export type BulkMeterItem = {
  roomId: number
  electricityUnit?: number
  waterUnit?: number
}

export async function bulkUpdateMeters(items: BulkMeterItem[]): Promise<{ updated: number }> {
  return jsonOrThrow<{ updated: number }>(
    await apiRequest(`${API_BASE}/rooms/meter/bulk-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    }),
  )
}

export async function bulkSetRoomsActive(
  roomIds: number[],
  isActive: BoolInt,
): Promise<{ updated: number }> {
  return jsonOrThrow<{ updated: number }>(
    await apiRequest(`${API_BASE}/rooms/bulk-active`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomIds, isActive }),
    }),
  )
}

// ============================================================================
// Auto-generate monthly bills for a whole building
// ============================================================================

export type GenerateBillsResponse = {
  created: number
  skipped: { roomId: number; reason: string }[]
}

export async function generateBillsForBuilding(
  buildingId: number,
): Promise<GenerateBillsResponse> {
  return jsonOrThrow<GenerateBillsResponse>(
    await apiRequest(`${API_BASE}/buildings/${buildingId}/bills/generate`, { method: 'POST' }),
  )
}
