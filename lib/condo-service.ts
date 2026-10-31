import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const monthRange = (date: Date) => ({
  start: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)),
  end: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)),
});

export const condoService = {
  listBuildings: () => prisma.building.findMany({ orderBy: { buildingName: "asc" } }),
  buildingDropdown: () => prisma.building.findMany({ select: { id: true, buildingName: true }, orderBy: { buildingName: "asc" } }),
  building: (id: number) => prisma.building.findUnique({ where: { id }, include: { setting: true, rooms: { orderBy: { roomNumber: "asc" } } } }),
  createBuilding: (data: Prisma.BuildingCreateInput) => prisma.building.create({ data }),
  updateBuilding: (id: number, data: Prisma.BuildingUpdateInput) => prisma.building.update({ where: { id }, data }),
  setting: (buildingId: number) => prisma.settingBuilding.findUnique({ where: { buildingId } }),
  upsertSetting: (buildingId: number, data: Omit<Prisma.SettingBuildingUncheckedCreateInput, "buildingId">) =>
    prisma.settingBuilding.upsert({ where: { buildingId }, create: { ...data, buildingId }, update: data }),
  listRooms: async (buildingId: number | undefined, activeOnly: boolean | undefined, page: number, pageSize: number) => {
    const where = { ...(buildingId ? { buildingId } : {}), ...(activeOnly ? { isActive: 1 } : {}) };
    const [data, total] = await Promise.all([
      prisma.room.findMany({ where, orderBy: [{ buildingId: "asc" }, { roomNumber: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
      prisma.room.count({ where }),
    ]);
    return { data, total, page, pageSize };
  },
  room: (id: number) => prisma.room.findUnique({ where: { id } }),
  createRoom: (data: Prisma.RoomUncheckedCreateInput) => prisma.room.create({ data }),
  updateRoom: (id: number, data: Prisma.RoomUpdateInput) => prisma.room.update({ where: { id }, data }),
  roomDropdown: (buildingId?: number, activeOnly?: boolean) => prisma.room.findMany({ where: { ...(buildingId ? { buildingId } : {}), ...(activeOnly ? { isActive: 1 } : {}) }, select: { id: true, roomNumber: true }, orderBy: { roomNumber: "asc" } }),
  meterLogs: async (roomId: number, page: number, pageSize: number) => {
    const where = { roomId };
    const [data, total] = await Promise.all([
      prisma.meterLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.meterLog.count({ where }),
    ]);
    return { data, total, page, pageSize };
  },
  exportMeters: async (buildingId: number) => ({
    buildingId,
    items: await prisma.room.findMany({ where: { buildingId, isActive: 1 }, orderBy: { roomNumber: "asc" }, select: { id: true, roomNumber: true, rentName: true, electricityUnit: true, waterUnit: true } }).then((rooms) => rooms.map(({ id, ...room }) => ({ roomId: id, ...room }))),
  }),
  bulkMeters: async (items: Array<{ roomId: number; electricityUnit?: number; waterUnit?: number }>) => {
    const results = await prisma.$transaction(items.map(({ roomId, electricityUnit, waterUnit }) => prisma.room.update({ where: { id: roomId }, data: { ...(electricityUnit !== undefined ? { electricityUnit } : {}), ...(waterUnit !== undefined ? { waterUnit } : {}) } })));
    return { updated: results.length };
  },
  bulkActive: async (roomIds: number[], isActive: number) => ({ updated: (await prisma.room.updateMany({ where: { id: { in: roomIds } }, data: { isActive } })).count }),
  listBillings: async (buildingId: number | undefined, roomId: number | undefined, date: string | null, page: number, pageSize: number) => {
    const where: Prisma.BillingWhereInput = { ...(roomId ? { roomId } : {}), ...(buildingId ? { room: { buildingId } } : {}) };
    if (date) {
      const parsed = new Date(`${date}T00:00:00.000Z`);
      if (Number.isNaN(parsed.getTime())) throw new Error("Invalid date");
      const { start, end } = monthRange(parsed);
      where.createdAt = { gte: start, lt: end };
    }
    const [data, total] = await Promise.all([
      prisma.billing.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.billing.count({ where }),
    ]);
    return { data, total, page, pageSize };
  },
  billingExistsThisMonth: async (roomId: number) => {
    const { start, end } = monthRange(new Date());
    return prisma.billing.findFirst({ where: { roomId, createdAt: { gte: start, lt: end } }, select: { id: true } });
  },
  createBilling: (data: Prisma.BillingUncheckedCreateInput) => prisma.billing.create({ data }),
  updateBilling: (id: number, data: Prisma.BillingUpdateInput) => prisma.billing.update({ where: { id }, data }),
  markPaid: (id: number, target?: string) => prisma.billing.update({ where: { id }, data: target === "rent" ? { isPayRent: 1 } : { isPaid: 1 } }),
};
