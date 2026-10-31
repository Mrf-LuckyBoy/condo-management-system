import { connection } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  await connection();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return Response.json(
      {
        status: "ok",
        database: "ok",
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return Response.json(
      {
        status: "unavailable",
        database: "unavailable",
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
