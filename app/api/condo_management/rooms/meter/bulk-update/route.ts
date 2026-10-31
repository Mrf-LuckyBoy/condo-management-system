import { ApiError, errorResponse, jsonBody, optionalInteger, requiredInteger } from "@/lib/api";
import { condoService } from "@/lib/condo-service";

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    if (!Array.isArray(body.items) || body.items.length === 0) throw new ApiError("items must be a non-empty array");
    const items = body.items.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw new ApiError("Each item must be an object");
      const record = item as Record<string, unknown>;
      const electricityUnit = optionalInteger(record.electricityUnit, "electricityUnit", 0);
      const waterUnit = optionalInteger(record.waterUnit, "waterUnit", 0);
      if (electricityUnit === undefined && waterUnit === undefined) throw new ApiError("Each item needs electricityUnit or waterUnit");
      return { roomId: requiredInteger(record.roomId, "roomId"), ...(electricityUnit !== undefined ? { electricityUnit: electricityUnit ?? undefined } : {}), ...(waterUnit !== undefined ? { waterUnit: waterUnit ?? undefined } : {}) };
    });
    return Response.json(await condoService.bulkMeters(items));
  } catch (error) { return errorResponse(error); }
}
