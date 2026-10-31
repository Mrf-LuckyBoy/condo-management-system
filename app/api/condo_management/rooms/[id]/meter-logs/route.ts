import { errorResponse, id, queryInteger } from "@/lib/api";
import { condoService } from "@/lib/condo-service";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await context.params; const query = new URL(request.url).searchParams;
    return Response.json(await condoService.meterLogs(id(rawId), queryInteger(query.get("page"), "page", 1), queryInteger(query.get("pageSize"), "pageSize", 50, 200)));
  } catch (error) { return errorResponse(error); }
}
