import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connection: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("next/server", () => ({ connection: mocks.connection }));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: mocks.queryRaw } }));

import { GET } from "@/app/api/healthcheck/route";

describe("GET /api/healthcheck", () => {
  beforeEach(() => {
    mocks.connection.mockResolvedValue(undefined);
    mocks.queryRaw.mockResolvedValue([{ healthy: 1 }]);
  });

  it("reports a healthy database without caching the response", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({ status: "ok", database: "ok" });
    expect(mocks.connection).toHaveBeenCalledOnce();
    expect(mocks.queryRaw).toHaveBeenCalledOnce();
  });

  it("returns 503 when the database query fails", async () => {
    mocks.queryRaw.mockRejectedValueOnce(new Error("database unavailable"));

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ status: "unavailable", database: "unavailable" });
  });
});
