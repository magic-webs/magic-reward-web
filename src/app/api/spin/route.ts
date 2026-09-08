import { NextRequest, NextResponse } from "next/server";
import { adminDb, getDefaultCompany } from "@/lib/companies";
import { drawWeightedPrize, type WheelPrize } from "@/lib/wheel";
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

  const { spins } = await adminDb.query({ spins: { $: { where: { token } } } });
  const record = spins[0];
  if (!record) {
    return NextResponse.json(
      { error: "not_found", message: "Your link has expired. Please register again." },
      { status: 404 },
    );
  }

  if (record.prizeId) {
    return NextResponse.json({
      alreadySpun: true,
      prizeId: record.prizeId,
      prizeLabel: record.prizeLabel,
    });
  }

  // Self-healing fallback: a row created in the gap between the migration
  // running and this route's deploy might not have companyId set yet.
  const companyId = record.companyId ?? (await getDefaultCompany())?.id;
  if (!companyId) {
    return NextResponse.json(
      { error: "server_error", message: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  // Query prizes by offerId if present, otherwise fall back to companyId
  const offerId = record.offerId;
  const { prizes } = await adminDb.query({
    prizes: {
      $: {
        where: offerId ? { offerId } : { companyId },
        order: { order: "asc" },
      },
    },
  });

  if (prizes.length === 0) {
    return NextResponse.json(
      { error: "server_error", message: "This game isn't set up yet." },
      { status: 500 },
    );
  }
  const prize = drawWeightedPrize(prizes as WheelPrize[]);

  try {
    await adminDb.transact(
      adminDb.tx.spins[record.id].update({
        prizeId: prize.id,
        prizeLabel: prize.label,
      }),
    );
  } catch {
    return NextResponse.json(
      { error: "server_error", message: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  // Fires only on this path, never on the `alreadySpun` early return
  // above, so re-opening a magic link doesn't re-report the same result.
  const eventData = {
    registration: {
      id: record.id,
      name: record.name,
      phone: record.phone,
      extraFields: (record.extraFields ?? {}) as Record<string, string>,
      createdAt: record.createdAt,
    },
    prize: { id: prize.id, label: prize.label, isWin: prize.isWin },
  };
  scheduleEvent(companyId, "spin.completed", eventData);
  scheduleEvent(companyId, prize.isWin ? "prize.won" : "prize.lost", eventData);

  return NextResponse.json({
    alreadySpun: false,
    prizeId: prize.id,
    prizeLabel: prize.label,
  });
}
