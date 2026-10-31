export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status = 422,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ message: error.message }, { status: error.status });
  }

  return Response.json({ message: "Internal server error" }, { status: 500 });
}

export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ApiError("Request body must be a JSON object");
    }
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Request body must be valid JSON");
  }
}

export function id(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new ApiError("Invalid id");
  return parsed;
}

export function optionalNumber(value: unknown, field: string): number | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ApiError(`${field} must be a number or null`);
  }
  return value;
}

export function optionalInteger(value: unknown, field: string, min?: number): number | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== "number" || !Number.isInteger(value) || (min !== undefined && value < min)) {
    throw new ApiError(`${field} must be an integer${min !== undefined ? ` of at least ${min}` : ""} or null`);
  }
  return value;
}

export function requiredInteger(value: unknown, field: string, min = 1): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min) {
    throw new ApiError(`${field} must be an integer of at least ${min}`);
  }
  return value;
}

export function optionalString(value: unknown, field: string): string | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== "string") throw new ApiError(`${field} must be a string or null`);
  return value;
}

export function queryInteger(value: string | null, field: string, fallback: number, max?: number) {
  if (value === null) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || (max !== undefined && parsed > max)) {
    throw new ApiError(`${field} must be an integer between 1 and ${max ?? "infinity"}`);
  }
  return parsed;
}

export function queryOptionalInteger(value: string | null, field: string) {
  if (value === null) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new ApiError(`${field} must be a positive integer`);
  return parsed;
}

export function queryBoolean(value: string | null, field: string) {
  if (value === null) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new ApiError(`${field} must be true or false`);
}
