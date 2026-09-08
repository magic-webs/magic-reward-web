"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Webhook,
} from "lucide-react";
import { SiteHeader } from "@/components/admin/site-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildSamplePayload,
  sampleHeaders,
  WEBHOOK_EVENTS,
  type WebhookEventId,
} from "@/lib/webhookEvents";
import { useCompany, useCompanyCrumbs } from "../company-context";

type WebhookRow = {
  id?: string;
  url: string;
  events: WebhookEventId[];
  isActive: boolean;
  secret: string;
  lastStatus: number | null;
  lastError: string | null;
  lastAttemptAt: number | null;
  regenerateSecret?: boolean;
};

type TestResult = {
  ok: boolean;
  status: number | null;
  statusText: string | null;
  durationMs: number;
  responseBody: string | null;
  responseHeaders: Record<string, string>;
  error: string | null;
};

function emptyRow(): WebhookRow {
  return {
    url: "",
    events: ["registration.created"],
    isActive: true,
    secret: "",
    lastStatus: null,
    lastError: null,
    lastAttemptAt: null,
  };
}

export default function WebhooksPage() {
  const { company } = useCompany();
  const crumbs = useCompanyCrumbs("Webhooks");

  const [rows, setRows] = useState<WebhookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState<number | null>(null);
  const [testing, setTesting] = useState<Record<number, boolean>>({});
  const [results, setResults] = useState<Record<number, TestResult>>({});
  const [previewEvent, setPreviewEvent] = useState<WebhookEventId>("registration.created");

  // Endpoints belong to an offer now, so the page loads the company's
  // offers first and edits one offer's list at a time. Defaults to the
  // newest, matching the order the offers list shows.
  const [offers, setOffers] = useState<Array<{ id: string; title: string; type: string }>>([]);
  const [offerId, setOfferId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/companies/${company.id}/offers`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const list = (data.offers ?? []) as Array<{ id: string; title: string; type: string }>;
        if (cancelled) return;
        setOffers(list);
        setOfferId((current) => current ?? list[0]?.id ?? null);
      } catch {
        // The offer picker just stays empty; the error surface below is
        // driven by the endpoint load.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [company.id]);

  const load = useCallback(async () => {
    if (!offerId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/offers/${offerId}/webhooks`, { cache: "no-store" });
      if (!res.ok) {
        setError("Couldn't load webhooks.");
        return;
      }
      const data = await res.json();
      setRows(data.webhooks ?? []);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }, [offerId]);

  useEffect(() => {
    load();
  }, [load]);

  function updateRow(index: number, patch: Partial<WebhookRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    setSavedAt(null);
  }

  function toggleEvent(index: number, event: WebhookEventId, checked: boolean) {
    setRows((prev) =>
      prev.map((r, i) =>
        i === index
          ? { ...r, events: checked ? [...r.events, event] : r.events.filter((e) => e !== event) }
          : r,
      ),
    );
    setSavedAt(null);
  }

  async function save() {
    setError(null);
    if (rows.some((r) => !r.url.trim())) {
      setError("Every endpoint needs a URL.");
      return;
    }
    if (rows.some((r) => r.events.length === 0)) {
      setError("Every endpoint needs at least one event selected.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/offers/${offerId}/webhooks`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhooks: rows }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message ?? "Couldn't save webhooks.");
        return;
      }
      setRows(data?.webhooks ?? rows);
      setSavedAt(Date.now());
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest(index: number, event: WebhookEventId) {
    const row = rows[index];
    if (!row.url.trim()) return;
    setTesting((prev) => ({ ...prev, [index]: true }));
    setResults((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    try {
      const res = await fetch(`/api/admin/offers/${offerId}/webhooks/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: row.url.trim(), event, webhookId: row.id ?? null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setResults((prev) => ({
          ...prev,
          [index]: {
            ok: false,
            status: null,
            statusText: null,
            durationMs: 0,
            responseBody: null,
            responseHeaders: {},
            error: data?.message ?? "Test failed.",
          },
        }));
        return;
      }
      setResults((prev) => ({ ...prev, [index]: data.result }));
    } finally {
      setTesting((prev) => ({ ...prev, [index]: false }));
    }
  }

  async function copySecret(index: number, secret: string) {
    await navigator.clipboard.writeText(secret);
    setCopied(index);
    setTimeout(() => setCopied(null), 1500);
  }

  const sampleCompany = { id: company.id, slug: company.slug, name: company.name };

  return (
    <>
      <SiteHeader crumbs={crumbs} />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        {/* Endpoints belong to one offer, so which offer is being edited
            has to be explicit before anything below makes sense. */}
        <Card>
          <CardHeader>
            <CardTitle>Offer</CardTitle>
            <CardDescription>
              {offers.length === 0
                ? "Endpoints belong to an offer — create one first."
                : "Each offer has its own endpoints and its own signing secrets."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {offers.map((o) => (
              <Button
                key={o.id}
                type="button"
                size="sm"
                variant={offerId === o.id ? "default" : "outline"}
                onClick={() => setOfferId(o.id)}
              >
                {o.title}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="size-4" /> Endpoints
            </CardTitle>
            <CardDescription>
              POST this offer's registrations and spin results to your own systems as they
              happen. Each delivery is signed so you can verify it really came from us.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-6">
                <Spinner className="size-5 text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No endpoints yet — add one to start receiving events.
              </p>
            ) : (
              rows.map((row, i) => (
                <div key={row.id ?? `new-${i}`} className="space-y-4 rounded-xl border p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Input
                      placeholder="https://example.com/hooks/magic-reward"
                      value={row.url}
                      onChange={(e) => updateRow(i, { url: e.target.value })}
                      className="min-w-60 flex-1 font-mono text-xs"
                    />
                    <Label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Switch
                        checked={row.isActive}
                        onCheckedChange={(checked) => updateRow(i, { isActive: checked })}
                      />
                      Active
                    </Label>
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 />
                    </Button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {WEBHOOK_EVENTS.map((event) => (
                      <Label
                        key={event.id}
                        className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-sm font-normal"
                      >
                        <Checkbox
                          checked={row.events.includes(event.id)}
                          onCheckedChange={(checked) => toggleEvent(i, event.id, Boolean(checked))}
                          className="mt-0.5"
                        />
                        <span className="space-y-0.5">
                          <span className="block font-mono text-xs font-medium">{event.id}</span>
                          <span className="block text-xs text-muted-foreground">
                            {event.description}
                          </span>
                        </span>
                      </Label>
                    ))}
                  </div>

                  {row.id && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Signing secret
                      </span>
                      <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1 font-mono text-xs">
                        {revealed[i] ? row.secret : "•".repeat(24)}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setRevealed((prev) => ({ ...prev, [i]: !prev[i] }))}
                      >
                        {revealed[i] ? <EyeOff /> : <Eye />}
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => copySecret(i, row.secret)}>
                        {copied === i ? <Check /> : <Copy />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateRow(i, { regenerateSecret: !row.regenerateSecret })}
                      >
                        <RefreshCw />
                        {row.regenerateSecret ? "Will regenerate on save" : "Regenerate"}
                      </Button>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                    {row.lastAttemptAt ? (
                      <Badge variant={row.lastStatus && row.lastStatus < 400 ? "default" : "destructive"}>
                        Last delivery: {row.lastStatus || "failed"}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Never delivered</Badge>
                    )}
                    {row.lastError && (
                      <span className="text-xs text-muted-foreground">{row.lastError}</span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto"
                      disabled={!row.url.trim() || testing[i]}
                      onClick={() => sendTest(i, row.events[0] ?? "registration.created")}
                    >
                      {testing[i] ? <Spinner /> : <Send />}
                      {testing[i] ? "Sending…" : "Send test"}
                    </Button>
                  </div>

                  {results[i] && <ResponsePreview result={results[i]} />}
                </div>
              ))
            )}

            <Button variant="outline" size="sm" onClick={() => setRows((prev) => [...prev, emptyRow()])}>
              <Plus /> Add endpoint
            </Button>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="gap-3">
            <Button onClick={save} disabled={saving || loading}>
              {saving ? "Saving…" : "Save endpoints"}
            </Button>
            {savedAt && <span className="text-sm text-muted-foreground">Saved.</span>}
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payload preview</CardTitle>
            <CardDescription>
              Exactly what we POST for each event. Verify the signature by computing
              <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-xs">
                HMAC-SHA256(`${"{timestamp}"}.${"{raw body}"}`, secret)
              </code>
              and comparing it to the <code className="font-mono text-xs">X-Magic-Signature</code>{" "}
              header.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              value={previewEvent}
              onValueChange={(value) => setPreviewEvent(value as WebhookEventId)}
            >
              <TabsList className="flex-wrap">
                {WEBHOOK_EVENTS.map((event) => (
                  <TabsTrigger key={event.id} value={event.id} className="font-mono text-xs">
                    {event.id}
                  </TabsTrigger>
                ))}
              </TabsList>
              {WEBHOOK_EVENTS.map((event) => (
                <TabsContent key={event.id} value={event.id} className="space-y-3 pt-3">
                  <p className="text-sm text-muted-foreground">{event.description}</p>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Headers</p>
                    <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">
                      {Object.entries(sampleHeaders(event.id))
                        .map(([key, value]) => `${key}: ${value}`)
                        .join("\n")}
                    </pre>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Body</p>
                    <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">
                      {JSON.stringify(buildSamplePayload(event.id, sampleCompany), null, 2)}
                    </pre>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ResponsePreview({ result }: { result: TestResult }) {
  const headerEntries = Object.entries(result.responseHeaders);
  return (
    <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={result.ok ? "default" : "destructive"}>
          {result.status ? `${result.status} ${result.statusText ?? ""}`.trim() : "No response"}
        </Badge>
        <span className="text-xs text-muted-foreground">{result.durationMs} ms</span>
        {result.error && <span className="text-xs text-destructive">{result.error}</span>}
      </div>

      {headerEntries.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Response headers</p>
          <pre className="max-h-40 overflow-auto rounded-md bg-background p-2 font-mono text-xs">
            {headerEntries.map(([key, value]) => `${key}: ${value}`).join("\n")}
          </pre>
        </div>
      )}

      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Response body</p>
        <pre className="max-h-60 overflow-auto rounded-md bg-background p-2 font-mono text-xs">
          {result.responseBody?.trim() ? result.responseBody : "(empty)"}
        </pre>
      </div>
    </div>
  );
}
