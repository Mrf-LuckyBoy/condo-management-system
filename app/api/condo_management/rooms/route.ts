import { errorResponse, jsonBody, optionalInteger, optionalNumber, optionalString, queryBoolean, queryInteger, queryOptionalInteger, requiredInteger } from "@/lib/api";
import { condoService } from "@/lib/condo-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    return Response.json(await condoService.listRooms(queryOptionalInteger(searchParams.get("buildingId"), "buildingId"), queryBoolean(searchParams.get("activeOnly"), "activeOnly"), queryInteger(searchParams.get("page"), "page", 1), queryInteger(searchParams.get("pageSize"), "pageSize", 50, 200)));
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    return Response.json(await condoService.createRoom({
      buildingId: requiredInteger(body.buildingId, "buildingId"), roomNumber: optionalInteger(body.roomNumber, "roomNumber"), rentName: optionalString(body.rentName, "rentName"), rentPrice: optionalNumber(body.rentPrice, "rentPrice"),
      electricityUnit: optionalInteger(body.electricityUnit, "electricityUnit", 0), waterUnit: optionalInteger(body.waterUnit, "waterUnit", 0), isOwner: optionalInteger(body.isOwner, "isOwner", 0), isActive: optionalInteger(body.isActive, "isActive", 0),
    }));
  } catch (error) { return errorResponse(error); }
}
