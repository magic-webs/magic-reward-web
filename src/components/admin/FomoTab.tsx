"use client";

import { useMemo, useState } from "react";
import { BellRing, Database, Plus, RotateCcw, Sparkles, Trash2, Wand2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FomoNotifications from "@/components/FomoNotifications";
import {
  DEFAULT_FOMO_CONFIG,
  FOMO_TYPES,
  buildPreviewFomoFeed,
  type FomoConfig,
  type FomoPosition,
  type FomoTheme,
  type FomoTypeId,
} from "@/lib/fomo";

const POSITIONS: { value: FomoPosition; label: string }[] = [
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
];

const THEMES: { value: FomoTheme; label: string }[] = [
  { value: "auto", label: "Match visitor's device" },
  { value: "light", label: "Always light" },
  { value: "dark", label: "Always dark" },
];

function NumberField({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (Number.isFinite(next)) onChange(next);
          }}
          className="h-9"
        />
        {suffix && <span className="text-xs text-muted-foreground whitespace-nowrap">{suffix}</span>}
      </div>
      {hint && <p className="text-[11px] leading-snug text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

function TemplateField({
  value,
  tokens,
  onChange,
}: {
  value: string;
  tokens: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">Message template</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-9" />
      {tokens.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground/80">Placeholders:</span>
          {tokens.map((token) => (
            <button
              key={token}
              type="button"
              onClick={() => onChange(`${value}${value.endsWith(" ") ? "" : " "}${token}`)}
              className="rounded border bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] transition-colors hover:bg-muted"
            >
              {token}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FomoTab({
  value,
  onChange,
  onSave,
  saving,
}: {
  value: FomoConfig;
  onChange: (next: FomoConfig) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const [previewKey, setPreviewKey] = useState(0);

  function patch(partial: Partial<FomoConfig>) {
    onChange({ ...value, ...partial });
  }

  function patchType<K extends FomoTypeId>(id: K, partial: Partial<FomoConfig["types"][K]>) {
    onChange({
      ...value,
      types: { ...value.types, [id]: { ...value.types[id], ...partial } },
    });
  }

  // Rebuilt on every edit so the preview panel reflects unsaved changes.
  const previewFeed = useMemo(
    () => ({ ...buildPreviewFomoFeed(value), enabled: true }),
    [value],
  );

  const liveTypes = FOMO_TYPES.filter((t) => t.source === "live");
  const simulatedTypes = FOMO_TYPES.filter((t) => t.source === "simulated");
  const activeCount = FOMO_TYPES.filter((t) => value.types[t.id].enabled).length;

  function renderTypeCard(id: FomoTypeId) {
    const meta = FOMO_TYPES.find((t) => t.id === id)!;
    const type = value.types[id];

    return (
      <div
        key={id}
        className={`rounded-xl border p-4 transition-colors ${
          type.enabled ? "bg-muted/20" : "bg-transparent opacity-70"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none">{meta.icon}</span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{meta.label}</span>
                <Badge
                  variant={meta.source === "live" ? "default" : "outline"}
                  className="text-[10px]"
                >
                  {meta.source === "live" ? "Real data" : "Simulated"}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{meta.description}</p>
            </div>
          </div>
          <Switch
            checked={type.enabled}
            onCheckedChange={(checked) => patchType(id, { enabled: checked } as never)}
          />
        </div>

        {type.enabled && (
          <div className="mt-4 space-y-4 border-t pt-4">
            {id === "recent_winner" && (
              <>
                <TemplateField
                  value={value.types.recent_winner.template}
                  tokens={meta.tokens}
                  onChange={(template) => patchType("recent_winner", { template })}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberField
                    label="Only show wins from the last"
                    value={value.types.recent_winner.maxAgeHours}
                    min={1}
                    max={8760}
                    suffix="hours"
                    onChange={(maxAgeHours) => patchType("recent_winner", { maxAgeHours })}
                  />
                  <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                    <div>
                      <Label className="text-xs font-medium">Shorten names</Label>
                      <p className="text-[11px] text-muted-foreground">Priya Sharma → Priya S.</p>
                    </div>
                    <Switch
                      checked={value.types.recent_winner.anonymize}
                      onCheckedChange={(anonymize) => patchType("recent_winner", { anonymize })}
                    />
                  </div>
                </div>
              </>
            )}

            {id === "recent_signup" && (
              <>
                <TemplateField
                  value={value.types.recent_signup.template}
                  tokens={meta.tokens}
                  onChange={(template) => patchType("recent_signup", { template })}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberField
                    label="Only show entries from the last"
                    value={value.types.recent_signup.maxAgeHours}
                    min={1}
                    max={8760}
                    suffix="hours"
                    onChange={(maxAgeHours) => patchType("recent_signup", { maxAgeHours })}
                  />
                  <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                    <div>
                      <Label className="text-xs font-medium">Shorten names</Label>
                      <p className="text-[11px] text-muted-foreground">Rahul Mehta → Rahul M.</p>
                    </div>
                    <Switch
                      checked={value.types.recent_signup.anonymize}
                      onCheckedChange={(anonymize) => patchType("recent_signup", { anonymize })}
                    />
                  </div>
                </div>
              </>
            )}

            {id === "signup_count" && (
              <>
                <TemplateField
                  value={value.types.signup_count.template}
                  tokens={meta.tokens}
                  onChange={(template) => patchType("signup_count", { template })}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberField
                    label="Counting window"
                    value={value.types.signup_count.windowHours}
                    min={1}
                    max={8760}
                    suffix="hours"
                    onChange={(windowHours) => patchType("signup_count", { windowHours })}
                  />
                  <NumberField
                    label="Hide below"
                    hint="A low number is weak proof — below this the notification is skipped entirely."
                    value={value.types.signup_count.minimum}
                    min={0}
                    max={100000}
                    suffix="entries"
                    onChange={(minimum) => patchType("signup_count", { minimum })}
                  />
                </div>
              </>
            )}

            {id === "low_stock" && (
              <>
                <TemplateField
                  value={value.types.low_stock.template}
                  tokens={meta.tokens}
                  onChange={(template) => patchType("low_stock", { template })}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberField
                    label="Prizes available per day"
                    hint="Real entries in the last 24h are subtracted from this."
                    value={value.types.low_stock.dailyTotal}
                    min={1}
                    max={1000000}
                    onChange={(dailyTotal) => patchType("low_stock", { dailyTotal })}
                  />
                  <NumberField
                    label="Never count below"
                    value={value.types.low_stock.floor}
                    min={0}
                    max={100000}
                    onChange={(floor) => patchType("low_stock", { floor })}
                  />
                </div>
              </>
            )}

            {id === "countdown" && (
              <>
                <TemplateField
                  value={value.types.countdown.template}
                  tokens={meta.tokens}
                  onChange={(template) => patchType("countdown", { template })}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Fixed end date &amp; time
                    </Label>
                    <Input
                      type="datetime-local"
                      className="h-9"
                      value={
                        value.types.countdown.endsAt
                          ? new Date(
                              value.types.countdown.endsAt -
                                new Date().getTimezoneOffset() * 60000,
                            )
                              .toISOString()
                              .slice(0, 16)
                          : ""
                      }
                      onChange={(e) =>
                        patchType("countdown", {
                          endsAt: e.target.value ? new Date(e.target.value).getTime() : null,
                        })
                      }
                    />
                    <p className="text-[11px] leading-snug text-muted-foreground/80">
                      Leave empty to use a rolling timer instead. Once a fixed date passes, the
                      notification stops showing.
                    </p>
                  </div>
                  <NumberField
                    label="Rolling timer length"
                    hint="Used only when no fixed end date is set. Restarts for every visitor."
                    value={value.types.countdown.rollingHours}
                    min={1}
                    max={8760}
                    suffix="hours"
                    onChange={(rollingHours) => patchType("countdown", { rollingHours })}
                  />
                </div>
              </>
            )}

            {id === "live_visitors" && (
              <>
                <TemplateField
                  value={value.types.live_visitors.template}
                  tokens={meta.tokens}
                  onChange={(template) => patchType("live_visitors", { template })}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberField
                    label="Minimum"
                    value={value.types.live_visitors.min}
                    min={1}
                    max={9999}
                    onChange={(min) => patchType("live_visitors", { min })}
                  />
                  <NumberField
                    label="Maximum"
                    value={value.types.live_visitors.max}
                    min={1}
                    max={9999}
                    onChange={(max) => patchType("live_visitors", { max })}
                  />
                </div>
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-snug text-amber-700 dark:text-amber-400">
                  This number is generated inside the range you set — it is not measured traffic.
                  It drifts once a minute so every visitor sees the same value at the same moment.
                </p>
              </>
            )}

            {id === "custom" && (
              <div className="space-y-3">
                {value.types.custom.messages.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No custom messages yet — add one below.
                  </p>
                )}
                {value.types.custom.messages.map((message, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={message}
                      maxLength={200}
                      placeholder="e.g. Free delivery on every prize this week"
                      onChange={(e) => {
                        const messages = value.types.custom.messages.slice();
                        messages[i] = e.target.value;
                        patchType("custom", { messages });
                      }}
                      className="h-9"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        patchType("custom", {
                          messages: value.types.custom.messages.filter((_, idx) => idx !== i),
                        })
                      }
                      className="text-red-500 hover:bg-red-500/10 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={value.types.custom.messages.length >= 20}
                  onClick={() =>
                    patchType("custom", { messages: [...value.types.custom.messages, ""] })
                  }
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Add message
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* Master switch + display settings */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BellRing className="h-4 w-4" /> FOMO Notifications
                </CardTitle>
                <CardDescription>
                  Rotating social-proof toasts shown on the offer page and, when the embed is on,
                  on your own website too.
                </CardDescription>
              </div>
              <Switch
                checked={value.enabled}
                onCheckedChange={(enabled) => patch({ enabled })}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Screen position</Label>
                <Select
                  value={value.position}
                  onValueChange={(next) =>
                    patch({ position: (next ?? value.position) as FomoPosition })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(v: string) => POSITIONS.find((p) => p.value === v)?.label ?? v}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Colour theme</Label>
                <Select
                  value={value.theme}
                  onValueChange={(next) => patch({ theme: (next ?? value.theme) as FomoTheme })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(v: string) => THEMES.find((t) => t.value === v)?.label ?? v}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {THEMES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField
                label="First notification after"
                value={Math.round(value.initialDelayMs / 1000)}
                min={0}
                max={300}
                suffix="sec"
                onChange={(s) => patch({ initialDelayMs: s * 1000 })}
              />
              <NumberField
                label="Each stays for"
                value={Math.round(value.displayMs / 1000)}
                min={2}
                max={60}
                suffix="sec"
                onChange={(s) => patch({ displayMs: s * 1000 })}
              />
              <NumberField
                label="Gap between"
                value={Math.round(value.gapMs / 1000)}
                min={1}
                max={300}
                suffix="sec"
                onChange={(s) => patch({ gapMs: s * 1000 })}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
                <div>
                  <Label className="text-sm font-medium">Loop forever</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Restart from the top after the last one.
                  </p>
                </div>
                <Switch checked={value.loop} onCheckedChange={(loop) => patch({ loop })} />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
                <div>
                  <Label className="text-sm font-medium">Show on mobile</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Toasts take up more of a small screen.
                  </p>
                </div>
                <Switch
                  checked={value.showOnMobile}
                  onCheckedChange={(showOnMobile) => patch({ showOnMobile })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Types built from real data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-4 w-4" /> Built from your real data
            </CardTitle>
            <CardDescription>
              These read actual registrations and wins for this offer. If there is no data yet,
              they simply do not show.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">{liveTypes.map((t) => renderTypeCard(t.id))}</CardContent>
        </Card>

        {/* Generated types */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" /> Generated
            </CardTitle>
            <CardDescription>
              Content you write or a number we generate in a range you choose. Nothing here is
              measured from real traffic.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {simulatedTypes.map((t) => renderTypeCard(t.id))}
          </CardContent>
          <CardFooter className="justify-between gap-3 border-t bg-muted/20 pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange({ ...DEFAULT_FOMO_CONFIG, enabled: value.enabled })}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset to defaults
            </Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? "Saving..." : "Save FOMO settings"}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Live preview */}
      <div className="lg:col-span-1">
        <Card className="lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Live preview
            </CardTitle>
            <CardDescription>
              {activeCount === 0
                ? "Turn on at least one type to see it here."
                : `${activeCount} type${activeCount === 1 ? "" : "s"} on, ${previewFeed.items.length} notification${previewFeed.items.length === 1 ? "" : "s"} in rotation.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative h-80 overflow-hidden rounded-xl border bg-gradient-to-b from-neutral-100 to-neutral-200 dark:from-neutral-900 dark:to-neutral-950">
              {/* Fake page furniture so toast placement reads correctly */}
              <div className="space-y-2 p-4 opacity-40">
                <div className="h-3 w-1/2 rounded bg-foreground/20" />
                <div className="h-2 w-3/4 rounded bg-foreground/15" />
                <div className="h-2 w-2/3 rounded bg-foreground/15" />
                <div className="mt-4 h-20 rounded-lg bg-foreground/10" />
                <div className="h-2 w-1/2 rounded bg-foreground/15" />
              </div>
              {previewFeed.items.length > 0 && (
                <FomoNotifications key={previewKey} feed={previewFeed} contained />
              )}
            </div>
            <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
              Preview uses sample names and prizes. Visitors see your real registrations.
            </p>
          </CardContent>
          <CardFooter className="border-t bg-muted/20 pt-4">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setPreviewKey((k) => k + 1)}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Replay preview
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
