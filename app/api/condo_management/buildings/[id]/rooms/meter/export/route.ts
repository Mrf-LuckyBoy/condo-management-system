import { errorResponse, id } from "@/lib/api";
import { condoService } from "@/lib/condo-service";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { const { id: rawId } = await context.params; return Response.json(await condoService.exportMeters(id(rawId))); } catch (error) { return errorResponse(error); }
}
