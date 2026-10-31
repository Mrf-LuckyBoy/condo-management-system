import { ApiError, errorResponse, id } from "@/lib/api";
import { condoService } from "@/lib/condo-service";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const target = new URL(request.url).searchParams.get("target");
    if (target && target !== "rent" && target !== "other") throw new ApiError("target must be rent or other");
    const { id: rawId } = await context.params;
    return Response.json(await condoService.markPaid(id(rawId), target ?? undefined));
  } catch (error) { return errorResponse(error); }
}
