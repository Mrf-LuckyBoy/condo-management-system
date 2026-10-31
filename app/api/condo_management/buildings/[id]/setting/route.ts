import { ApiError, errorResponse, id, jsonBody, optionalNumber } from "@/lib/api";
import { condoService } from "@/lib/condo-service";

const settingData = (body: Record<string, unknown>) => ({
  electricityPerUnit: optionalNumber(body.electricityPerUnit, "electricityPerUnit"), waterPerUnit: optionalNumber(body.waterPerUnit, "waterPerUnit"),
  baseMaintain: optionalNumber(body.baseMaintain, "baseMaintain"), trashMaintain: optionalNumber(body.trashMaintain, "trashMaintain"), meterMaintain: optionalNumber(body.meterMaintain, "meterMaintain"),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await context.params; const setting = await condoService.setting(id(rawId));
    if (!setting) throw new ApiError("Setting not found for this building", 404);
    return Response.json(setting);
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await jsonBody(request); const { id: rawId } = await context.params; const buildingId = id(rawId);
    if (!await condoService.building(buildingId)) throw new ApiError("Building not found", 404);
    return Response.json(await condoService.upsertSetting(buildingId, settingData(body)));
  } catch (error) { return errorResponse(error); }
}
