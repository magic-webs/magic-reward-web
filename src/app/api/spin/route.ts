import { NextRequest, NextResponse } from "next/server";
import { api, convex } from "@/lib/convex";
import { scheduleEvent } from "@/lib/notify";

// The spin itself is identified purely by the token from /api/register —
// the name and phone are already on file, so nothing re-enters them here.
// This route is shared by every company: a spins row already knows which
// company it belongs to, so no /api/w/[slug]/spin route is needed.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token.trim() : "";

  if (!token) {
    return NextResponse.json(
      { error: "invalid_input", message: "Missing session token." },
      { status: 400 },
    );
  }

  // Reading the prizes and writing the result now happen in one Convex
  // mutation, so two simultaneous requests on the same token can no longer
  // both draw. The old self-healing companyId fallback is gone with it:
  // companyId is required on every row.
  const result = await convex.mutation(api.spins.recordSpin, { token });

  if (result.status === "not_found") {
    return NextResponse.json(
      { error: "not_found", message: "Your link has expired. Please register again." },
      { status: 404 },
    );
  }

  if (result.status === "no_prizes") {
    return NextResponse.json(
      { error: "server_error", message: "This game isn't set up yet." },
      { status: 500 },
    );
  }

  if (result.status === "already") {
    return NextResponse.json({
      alreadySpun: true,
      prizeId: result.prizeId,
      prizeLabel: result.prizeLabel,
    });
  }

  // Fires only on this path, never on the `already` return above, so
  // re-opening a magic link doesn't re-report the same result.
  const eventData = {
    registration: result.registration,
    prize: { id: result.prizeId, label: result.prizeLabel, isWin: result.isWin },
  };
  scheduleEvent(result.companyId, result.offerId, "spin.completed", eventData);
  scheduleEvent(
    result.companyId,
    result.offerId,
    result.isWin ? "prize.won" : "prize.lost",
    eventData,
  );

  return NextResponse.json({
    alreadySpun: false,
    prizeId: result.prizeId,
    prizeLabel: result.prizeLabel,
  });
}
