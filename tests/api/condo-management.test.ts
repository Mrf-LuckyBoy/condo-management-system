import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  service: {
    listBuildings: vi.fn(), buildingDropdown: vi.fn(), building: vi.fn(), createBuilding: vi.fn(), updateBuilding: vi.fn(),
    setting: vi.fn(), upsertSetting: vi.fn(), listRooms: vi.fn(), room: vi.fn(), createRoom: vi.fn(), updateRoom: vi.fn(),
    roomDropdown: vi.fn(), meterLogs: vi.fn(), exportMeters: vi.fn(), bulkMeters: vi.fn(), bulkActive: vi.fn(),
  },
  prisma: {
    $transaction: vi.fn(),
    building: { delete: vi.fn() },
    settingBuilding: { deleteMany: vi.fn(), findUnique: vi.fn() },
    billing: { count: vi.fn(), create: vi.fn() },
    meterLog: { count: vi.fn() },
    room: { delete: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("@/lib/condo-service", () => ({ condoService: mocks.service }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

import { GET as buildingsGet, POST as buildingsPost } from "@/app/api/condo_management/buildings/route";
import { GET as buildingDropdownGet } from "@/app/api/condo_management/buildings/dropdown/route";
import { DELETE as buildingDelete, GET as buildingGet, PATCH as buildingPatch } from "@/app/api/condo_management/buildings/[id]/route";
import { POST as generateBills } from "@/app/api/condo_management/buildings/[id]/bills/generate/route";
import { GET as exportMeters } from "@/app/api/condo_management/buildings/[id]/rooms/meter/export/route";
import { GET as settingGet, PUT as settingPut } from "@/app/api/condo_management/buildings/[id]/setting/route";
import { GET as roomsGet, POST as roomsPost } from "@/app/api/condo_management/rooms/route";
import { GET as roomDropdownGet } from "@/app/api/condo_management/rooms/dropdown/route";
import { DELETE as roomDelete, GET as roomGet, PATCH as roomPatch } from "@/app/api/condo_management/rooms/[id]/route";
import { GET as logsGet } from "@/app/api/condo_management/rooms/[id]/meter-logs/route";
import { POST as bulkActive } from "@/app/api/condo_management/rooms/bulk-active/route";
import { POST as bulkMeters } from "@/app/api/condo_management/rooms/meter/bulk-update/route";

const context = (id: string) => ({ params: Promise.resolve({ id }) });
const jsonRequest = (url: string, method: string, body: unknown) => new Request(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe("condo management API routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.service.listBuildings.mockResolvedValue([]); mocks.service.buildingDropdown.mockResolvedValue([]); mocks.service.building.mockResolvedValue({ id: 1 });
    mocks.service.createBuilding.mockResolvedValue({ id: 1 }); mocks.service.updateBuilding.mockResolvedValue({ id: 1 }); mocks.service.setting.mockResolvedValue({ id: 1 }); mocks.service.upsertSetting.mockResolvedValue({ id: 1 });
    mocks.service.listRooms.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 50 }); mocks.service.room.mockResolvedValue({ id: 1 }); mocks.service.createRoom.mockResolvedValue({ id: 1 }); mocks.service.updateRoom.mockResolvedValue({ id: 1 });
    mocks.service.roomDropdown.mockResolvedValue([]); mocks.service.meterLogs.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 50 }); mocks.service.exportMeters.mockResolvedValue({ buildingId: 1, items: [] }); mocks.service.bulkMeters.mockResolvedValue({ updated: 1 }); mocks.service.bulkActive.mockResolvedValue({ updated: 2 });
    mocks.prisma.billing.count.mockResolvedValue(0); mocks.prisma.meterLog.count.mockResolvedValue(0); mocks.prisma.settingBuilding.findUnique.mockResolvedValue({ buildingId: 1, electricityPerUnit: 8, waterPerUnit: 25, baseMaintain: 300, trashMaintain: 50, meterMaintain: 20 }); mocks.prisma.room.findMany.mockResolvedValue([]); mocks.prisma.$transaction.mockResolvedValue([]);
  });

  it("lists and creates buildings", async () => {
    expect((await buildingsGet()).status).toBe(200);
    const response = await buildingsPost(jsonRequest("http://test/api/condo_management/buildings", "POST", { buildingName: "Tower A", ownerName: "Somchai" }));
    expect(response.status).toBe(200);
    expect(mocks.service.createBuilding).toHaveBeenCalledWith({ buildingName: "Tower A", ownerName: "Somchai" });
  });

  it("returns building dropdown and detail, including a 404", async () => {
    expect((await buildingDropdownGet()).status).toBe(200);
    expect((await buildingGet(new Request("http://test"), context("1"))).status).toBe(200);
    mocks.service.building.mockResolvedValueOnce(null);
    expect((await buildingGet(new Request("http://test"), context("1"))).status).toBe(404);
  });

  it("updates and safely deletes an empty building", async () => {
    expect((await buildingPatch(jsonRequest("http://test", "PATCH", { buildingName: null }), context("1"))).status).toBe(200);
    expect((await buildingDelete(new Request("http://test"), context("1"))).status).toBe(200);
    expect(mocks.prisma.$transaction).toHaveBeenCalledOnce();
  });

  it("blocks deletion of a building that still has rooms", async () => {
    mocks.service.listRooms.mockResolvedValueOnce({ data: [{}], total: 1, page: 1, pageSize: 1 });
    const response = await buildingDelete(new Request("http://test"), context("1"));
    expect(response.status).toBe(400);
  });

  it("gets and upserts a building setting", async () => {
    expect((await settingGet(new Request("http://test"), context("1"))).status).toBe(200);
    const response = await settingPut(jsonRequest("http://test", "PUT", { electricityPerUnit: 8, waterPerUnit: 25 }), context("1"));
    expect(response.status).toBe(200);
    expect(mocks.service.upsertSetting).toHaveBeenCalledWith(1, expect.objectContaining({ electricityPerUnit: 8, waterPerUnit: 25 }));
  });

  it("lists, creates, and filters rooms", async () => {
    const listResponse = await roomsGet(new Request("http://test/api/condo_management/rooms?buildingId=1&activeOnly=true&page=2"));
    expect(listResponse.status).toBe(200);
    expect(mocks.service.listRooms).toHaveBeenCalledWith(1, true, 2, 50);
    expect((await roomsPost(jsonRequest("http://test", "POST", { buildingId: 1, roomNumber: 101, electricityUnit: 0, waterUnit: 0 }))).status).toBe(200);
    expect((await roomDropdownGet(new Request("http://test?buildingId=1&activeOnly=true"))).status).toBe(200);
  });

  it("gets, updates, and deletes an empty room", async () => {
    expect((await roomGet(new Request("http://test"), context("1"))).status).toBe(200);
    expect((await roomPatch(jsonRequest("http://test", "PATCH", { electricityUnit: 10 }), context("1"))).status).toBe(200);
    expect((await roomDelete(new Request("http://test"), context("1"))).status).toBe(200);
    expect(mocks.prisma.room.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it("blocks deletion of a room that has related data", async () => {
    mocks.prisma.billing.count.mockResolvedValueOnce(1);
    const response = await roomDelete(new Request("http://test"), context("1"));
    expect(response.status).toBe(400);
  });

  it("lists meter logs and exports active room meters", async () => {
    expect((await logsGet(new Request("http://test?page=2&pageSize=10"), context("1"))).status).toBe(200);
    expect(mocks.service.meterLogs).toHaveBeenCalledWith(1, 2, 10);
    expect((await exportMeters(new Request("http://test"), context("1"))).status).toBe(200);
  });

  it("validates and performs bulk meter and active-state updates", async () => {
    const invalid = await bulkMeters(jsonRequest("http://test", "POST", { items: [] }));
    expect(invalid.status).toBe(422);
    expect((await bulkMeters(jsonRequest("http://test", "POST", { items: [{ roomId: 1, electricityUnit: 25 }] }))).status).toBe(200);
    expect((await bulkActive(jsonRequest("http://test", "POST", { roomIds: [1, 2], isActive: 0 }))).status).toBe(200);
    expect(mocks.service.bulkActive).toHaveBeenCalledWith([1, 2], 0);
  });

  it("generates bills and reports a missing building setting", async () => {
    const success = await generateBills(new Request("http://test", { method: "POST" }), context("1"));
    expect(success.status).toBe(200);
    await expect(success.json()).resolves.toEqual({ created: 0, skipped: [] });
    mocks.prisma.settingBuilding.findUnique.mockResolvedValueOnce(null);
    const missing = await generateBills(new Request("http://test", { method: "POST" }), context("1"));
    expect(missing.status).toBe(400);
  });
});
