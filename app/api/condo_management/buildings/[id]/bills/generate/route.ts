import { ApiError, errorResponse, id } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await context.params; const buildingId = id(rawId);
    const setting = await prisma.settingBuilding.findUnique({ where: { buildingId } });
    if (!setting) throw new ApiError("No setting_building configured for this building", 400);
    const now = new Date(); const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const rooms = await prisma.room.findMany({ where: { buildingId, isActive: 1 }, include: { meterLogs: { orderBy: { createdAt: "desc" }, take: 1 }, billings: { where: { createdAt: { gte: start, lt: end } }, select: { id: true }, take: 1 } } });
    const skipped: Array<{ roomId: number; reason: string }> = []; const bills: Array<{ roomId: number; electricity: number; water: number; maintain: number; trashMaintain: number; meterMaintain: number }> = [];
    for (const room of rooms) {
      if (room.billings.length) { skipped.push({ roomId: room.id, reason: "billing already exists this month" }); continue; }
      const log = room.meterLogs[0];
      if (!log) { skipped.push({ roomId: room.id, reason: "no meter log found" }); continue; }
      bills.push({ roomId: room.id, electricity: Math.max(0, (log.newElectricityUnit ?? 0) - (log.oldElectricityUnit ?? 0)) * (setting.electricityPerUnit ?? 0), water: Math.max(0, (log.newWaterUnit ?? 0) - (log.oldWaterUnit ?? 0)) * (setting.waterPerUnit ?? 0), maintain: setting.baseMaintain ?? 0, trashMaintain: setting.trashMaintain ?? 0, meterMaintain: setting.meterMaintain ?? 0 });
    }
    if (bills.length) await prisma.$transaction(bills.map((data) => prisma.billing.create({ data })));
    return Response.json({ created: bills.length, skipped });
  } catch (error) { return errorResponse(error); }
}
