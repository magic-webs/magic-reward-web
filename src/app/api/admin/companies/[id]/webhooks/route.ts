import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyAccess } from "@/lib/companies";
import { listWebhooks, WEBHOOK_EVENTS } from "@/lib/webhooks";

// Read-only overview of every endpoint a company owns, across all of its
// offers — each row carries its `offerId`. Endpoints are configured per
// offer now, so the editable surface is
// /api/admin/offers/[offerId]/webhooks; this route no longer accepts a PUT.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: companyId } = await params;
  if (!(await resolveCompanyAccess(req, companyId))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    webhooks: await listWebhooks(companyId),
    availableEvents: WEBHOOK_EVENTS,
  });
}
