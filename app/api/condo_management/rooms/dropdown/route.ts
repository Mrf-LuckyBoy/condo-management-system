import { errorResponse, queryBoolean, queryOptionalInteger } from "@/lib/api";
import { condoService } from "@/lib/condo-service";

export async function GET(request: Request) {
  try { const query = new URL(request.url).searchParams; return Response.json(await condoService.roomDropdown(queryOptionalInteger(query.get("buildingId"), "buildingId"), queryBoolean(query.get("activeOnly"), "activeOnly"))); } catch (error) { return errorResponse(error); }
}
