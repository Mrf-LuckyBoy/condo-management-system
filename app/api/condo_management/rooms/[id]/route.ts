import { ApiError, errorResponse, id, jsonBody, optionalInteger, optionalNumber, optionalString } from "@/lib/api";
import { condoService } from "@/lib/condo-service";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { const { id: rawId } = await context.params; const room = await condoService.room(id(rawId)); if (!room) throw new ApiError("Room not found", 404); return Response.json(room); } catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await jsonBody(request); const { id: rawId } = await context.params;
    return Response.json(await condoService.updateRoom(id(rawId), {
      roomNumber: optionalInteger(body.roomNumber, "roomNumber"), rentName: optionalString(body.rentName, "rentName"), rentPrice: optionalNumber(body.rentPrice, "rentPrice"),
      electricityUnit: optionalInteger(body.electricityUnit, "electricityUnit", 0), waterUnit: optionalInteger(body.waterUnit, "waterUnit", 0), isOwner: optionalInteger(body.isOwner, "isOwner", 0), isActive: optionalInteger(body.isActive, "isActive", 0),
    }));
  } catch (error) { return errorResponse(error); }
}
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await context.params; const roomId = id(rawId);
    const [bills, logs] = await Promise.all([prisma.billing.count({ where: { roomId } }), prisma.meterLog.count({ where: { roomId } })]);
    if (bills || logs) throw new ApiError(`Cannot delete: room has ${bills} bill(s) and ${logs} meter log(s). Deactivate via isActive=0 instead.`, 400);
    await prisma.room.delete({ where: { id: roomId } }); return Response.json({ id: roomId, deleted: true });
  } catch (error) { return errorResponse(error); }
}
