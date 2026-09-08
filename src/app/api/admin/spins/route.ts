import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthenticated } from "@/lib/adminAuth";
import { api, convex } from "@/lib/convex";

export async function GET(req: NextRequest) {
  if (!isAdminRequestAuthenticated(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ spins: await convex.query(api.spins.listAll, {}) });
}
