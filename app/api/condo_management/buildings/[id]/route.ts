import { ApiError, errorResponse, id, jsonBody, optionalString } from "@/lib/api";
import { condoService } from "@/lib/condo-service";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await context.params;
    const building = await condoService.building(id(rawId));
    if (!building) throw new ApiError("Building not found", 404);
    return Response.json(building);
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await jsonBody(request); const { id: rawId } = await context.params;
    return Response.json(await condoService.updateBuilding(id(rawId), { buildingName: optionalString(body.buildingName, "buildingName"), ownerName: optionalString(body.ownerName, "ownerName") }));
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await context.params; const buildingId = id(rawId);
    const rooms = await condoService.listRooms(buildingId, undefined, 1, 1);
    if (rooms.total) throw new ApiError(`Cannot delete: building has ${rooms.total} room(s). Delete rooms first.`, 400);
    const { prisma } = await import("@/lib/prisma");
    await prisma.$transaction([prisma.settingBuilding.deleteMany({ where: { buildingId } }), prisma.building.delete({ where: { id: buildingId } })]);
    return Response.json({ id: buildingId, deleted: true });
  } catch (error) { return errorResponse(error); }
}
