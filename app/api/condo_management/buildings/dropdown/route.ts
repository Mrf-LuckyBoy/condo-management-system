import { errorResponse } from "@/lib/api";
import { condoService } from "@/lib/condo-service";

export async function GET() {
  try { return Response.json(await condoService.buildingDropdown()); } catch (error) { return errorResponse(error); }
}
