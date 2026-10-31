import { errorResponse, jsonBody, optionalString } from "@/lib/api";
import { condoService } from "@/lib/condo-service";

export async function GET() {
  try { return Response.json(await condoService.listBuildings()); } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    return Response.json(await condoService.createBuilding({ buildingName: optionalString(body.buildingName, "buildingName"), ownerName: optionalString(body.ownerName, "ownerName") }));
  } catch (error) { return errorResponse(error); }
}
