import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyAccess } from "@/lib/companies";
import { api, asPrizeId, convex } from "@/lib/convex";
import { uploadToStorage } from "@/lib/uploadImage";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: prizeId } = await params;

  const prize = await convex.query(api.prizes.get, { prizeId: asPrizeId(prizeId) });
  if (!prize) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!(await resolveCompanyAccess(req, prize.companyId))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "invalid_input", message: "No file provided." }, { status: 400 });
  }

  const storageId = await uploadToStorage(file);
  await convex.mutation(api.prizes.setIcon, { prizeId: asPrizeId(prizeId), storageId });

  return NextResponse.json({ ok: true });
}
