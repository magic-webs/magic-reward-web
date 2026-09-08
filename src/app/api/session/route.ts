import { NextRequest, NextResponse } from "next/server";
import { api, convex } from "@/lib/convex";

// Resolves a magic-link token back to who registered it, so the game page
// can greet a returning visitor by name without ever asking for their
// phone number again.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json(
      { error: "invalid_input", message: "Missing token." },
      { status: 400 },
    );
  }

  const record = await convex.query(api.spins.getByToken, { token });
  if (!record) {
    return NextResponse.json({ error: "not_found", message: "Link not found." }, { status: 404 });
  }

  return NextResponse.json({
    name: record.name,
    // Never surface the private anon-<hex> placeholder minted when
    // askPhone was off at registration time — it's not a real phone number.
    phone: record.phone.startsWith("anon-") ? null : record.phone,
    hasSpun: record.hasSpun,
    prizeId: record.prizeId,
    prizeLabel: record.prizeLabel,
    extraFields: record.extraFields,
  });
}
