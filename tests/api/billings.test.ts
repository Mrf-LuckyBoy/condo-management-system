import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listBillings: vi.fn(),
  billingExistsThisMonth: vi.fn(),
  createBilling: vi.fn(),
  updateBilling: vi.fn(),
  markPaid: vi.fn(),
}));

vi.mock("@/lib/condo-service", () => ({
  condoService: mocks,
}));

import { GET, POST } from "@/app/api/billings/route";
import { PATCH as updateBilling } from "@/app/api/billings/[id]/route";
import { PATCH as payBilling } from "@/app/api/billings/[id]/pay/route";

describe("/api/billings", () => {
  beforeEach(() => {
    mocks.listBillings.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 10 });
    mocks.billingExistsThisMonth.mockResolvedValue(null);
    mocks.createBilling.mockResolvedValue({ id: 1, roomId: 4 });
    mocks.updateBilling.mockResolvedValue({ id: 1, electricity: 150 });
    mocks.markPaid.mockResolvedValue({ id: 1, isPayRent: 1 });
  });

  it("lists billings with parsed pagination and filters", async () => {
    const response = await GET(new Request("http://test/api/billings?buildingId=2&roomId=4&page=2&pageSize=20"));

    expect(response.status).toBe(200);
    expect(mocks.listBillings).toHaveBeenCalledWith(2, 4, null, 2, 20);
    await expect(response.json()).resolves.toEqual({ data: [], total: 0, page: 1, pageSize: 10 });
  });

  it("rejects an invalid paging value", async () => {
    const response = await GET(new Request("http://test/api/billings?page=0"));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ message: "page must be an integer between 1 and infinity" });
  });

  it("rejects a duplicate bill in the current month", async () => {
    mocks.billingExistsThisMonth.mockResolvedValueOnce({ id: 99 });
    const response = await POST(new Request("http://test/api/billings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: 4 }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: "Billing already exists for this room in the current month" });
    expect(mocks.createBilling).not.toHaveBeenCalled();
  });

  it("creates a bill with valid optional charges", async () => {
    const response = await POST(new Request("http://test/api/billings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: 4, electricity: 120.5, water: 45, maintain: 300 }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.createBilling).toHaveBeenCalledWith({
      roomId: 4, electricity: 120.5, water: 45, maintain: 300,
      trashMaintain: undefined, meterMaintain: undefined,
    });
    await expect(response.json()).resolves.toEqual({ id: 1, roomId: 4 });
  });

  it("updates a bill and marks its rent payment as paid", async () => {
    const context = { params: Promise.resolve({ id: "1" }) };
    const update = await updateBilling(new Request("http://test/api/billings/1", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ electricity: 150 }),
    }), context);
    const pay = await payBilling(new Request("http://test/api/billings/1/pay?target=rent", { method: "PATCH" }), context);

    expect(update.status).toBe(200);
    expect(mocks.updateBilling).toHaveBeenCalledWith(1, expect.objectContaining({ electricity: 150 }));
    expect(pay.status).toBe(200);
    expect(mocks.markPaid).toHaveBeenCalledWith(1, "rent");
  });
});
