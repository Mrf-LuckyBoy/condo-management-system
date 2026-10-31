import { errorResponse, id, jsonBody, optionalNumber } from "@/lib/api";
import { condoService } from "@/lib/condo-service";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await jsonBody(request);
    const { id: rawId } = await context.params;
    return Response.json(await condoService.updateBilling(id(rawId), {
      electricity: optionalNumber(body.electricity, "electricity"), water: optionalNumber(body.water, "water"),
      maintain: optionalNumber(body.maintain, "maintain"), trashMaintain: optionalNumber(body.trashMaintain, "trashMaintain"),
      meterMaintain: optionalNumber(body.meterMaintain, "meterMaintain"),
    }));
  } catch (error) { return errorResponse(error); }
}
