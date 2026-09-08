import { after } from "next/server";
import { dispatchWebhookEvent } from "@/lib/webhooks";
import { dispatchPushEvent } from "@/lib/push";
import type { WebhookEnvelope, WebhookEventId } from "@/lib/webhookEvents";

// One place an event leaves the system from. Both channels read the same
// WEBHOOK_EVENTS catalog and the same payload, so adding an event there
// wires it up for webhooks and push at once.
//
// Queued to run *after* the response has been sent, so a slow receiver or
// a slow push service never adds latency to a customer registering or
// spinning. Falls back to a floating promise outside a request scope,
// where `after` is unavailable.
export function scheduleEvent(
  companyId: string,
  // Which offer the event happened on. Webhooks are per-offer now, so an
  // event with no offer has no endpoint to reach; push is still scoped by
  // company and admin role, so it goes out either way.
  offerId: string | null,
  event: WebhookEventId,
  data: WebhookEnvelope["data"],
): void {
  // allSettled, not all: a webhook endpoint being down must not stop the
  // push from going out, or the other way round.
  const run = async () => {
    await Promise.allSettled([
      dispatchWebhookEvent(companyId, offerId, event, data),
      dispatchPushEvent(companyId, event, data),
    ]);
  };

  try {
    after(run);
  } catch {
    void run();
  }
}
