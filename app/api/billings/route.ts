import { ApiError, errorResponse, jsonBody, optionalNumber, queryInteger, queryOptionalInteger, requiredInteger } from "@/lib/api";
import { condoService } from "@/lib/condo-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    return Response.json(await condoService.listBillings(
      queryOptionalInteger(searchParams.get("buildingId"), "buildingId"),
      queryOptionalInteger(searchParams.get("roomId"), "roomId"),
      searchParams.get("date"),
      queryInteger(searchParams.get("page"), "page", 1),
      queryInteger(searchParams.get("pageSize"), "pageSize", 10, 100),
    ));
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const roomId = requiredInteger(body.roomId, "roomId");
    if (await condoService.billingExistsThisMonth(roomId)) {
      throw new ApiError("Billing already exists for this room in the current month", 400);
    }
    return Response.json(await condoService.createBilling({
      roomId,
      electricity: optionalNumber(body.electricity, "electricity"), water: optionalNumber(body.water, "water"),
      maintain: optionalNumber(body.maintain, "maintain"), trashMaintain: optionalNumber(body.trashMaintain, "trashMaintain"),
      meterMaintain: optionalNumber(body.meterMaintain, "meterMaintain"),
    }));
  } catch (error) { return errorResponse(error); }
}
