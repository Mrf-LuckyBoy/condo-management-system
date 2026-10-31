import { ApiError, errorResponse, jsonBody, requiredInteger } from "@/lib/api";
import { condoService } from "@/lib/condo-service";

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    if (!Array.isArray(body.roomIds) || body.roomIds.length === 0) throw new ApiError("roomIds must be a non-empty array");
    if (body.isActive !== 0 && body.isActive !== 1) throw new ApiError("isActive must be 0 or 1");
    return Response.json(await condoService.bulkActive(body.roomIds.map((roomId) => requiredInteger(roomId, "roomIds item")), body.isActive));
  } catch (error) { return errorResponse(error); }
}
