"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Code2,
  Copy,
  ExternalLink,
  Globe,
  MonitorSmartphone,
  MousePointerClick,
  Plus,
  Trash2,
  X,
} from "lucide-react";
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
import {
  EMBED_FREQUENCIES,
  buildPlatformSnippets,
  type EmbedConfig,
  type EmbedFrequency,
  type LauncherPosition,
} from "@/lib/embed";

const PLATFORMS = [
  { key: "html", label: "HTML" },
  { key: "shopify", label: "Shopify" },
  { key: "wordpress", label: "WordPress" },
  { key: "gtm", label: "Tag Manager" },
  { key: "react", label: "Next.js" },
] as const;

type PlatformKey = (typeof PLATFORMS)[number]["key"];

const LAUNCHER_CORNERS: { value: LauncherPosition; label: string }[] = [
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-left", label: "Bottom left" },
];

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          /* clipboard blocked — the snippet is selectable in the box below */
        }
      }}
    >
      {copied ? (
        <>
          <Check className="mr-1.5 h-3.5 w-3.5" /> Copied
        </>
      ) : (
        <>
          <Copy className="mr-1.5 h-3.5 w-3.5" /> {label}
        </>
      )}
    </Button>
  );
}

function ToggleRow({
  title,
  hint,
  checked,
  onCheckedChange,
  children,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border p-4 ${checked ? "bg-muted/20" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Label className="text-sm font-semibold">{title}</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
      {checked && children && <div className="mt-3 border-t pt-3">{children}</div>}
    </div>
  );
}

function NumberRow({
  title,
  hint,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  title: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className={`rounded-xl border p-4 ${value > 0 ? "bg-muted/20" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <Label className="text-sm font-semibold">{title}</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Input
            type="number"
            min={min}
            max={max}
            value={value}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (Number.isFinite(next)) onChange(Math.max(min, Math.min(max, next)));
            }}
            className="h-9 w-20"
          />
          <span className="text-xs text-muted-foreground">{suffix}</span>
        </div>
      </div>
    </div>
  );
}

export default function EmbedTab({
  value,
  onChange,
  onSave,
  saving,
  siteUrl,
  companySlug,
  offerId,
  offerTitle,
  offerIsActive,
}: {
  value: EmbedConfig;
  onChange: (next: EmbedConfig) => void;
  onSave: () => void;
  saving: boolean;
  siteUrl: string;
  companySlug: string;
  offerId: string;
  offerTitle: string;
  offerIsActive: boolean;
}) {
  const [platform, setPlatform] = useState<PlatformKey>("html");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [newDomain, setNewDomain] = useState("");

  function patch(partial: Partial<EmbedConfig>) {
    onChange({ ...value, ...partial });
  }

  function patchTriggers(partial: Partial<EmbedConfig["triggers"]>) {
    onChange({ ...value, triggers: { ...value.triggers, ...partial } });
  }

  const snippets = useMemo(
    () => buildPlatformSnippets(siteUrl, companySlug, offerId),
    [siteUrl, companySlug, offerId],
  );

  const testPageUrl = `${siteUrl}/embed-preview?slug=${encodeURIComponent(
    companySlug,
  )}&o=${encodeURIComponent(offerId)}`;

  const t = value.triggers;
  const activeTriggers = [
    t.exitIntent && "Exit intent",
    t.mobileScrollUp && "Mobile scroll-up",
    t.mobileBackButton && "Back button",
    t.inactivitySeconds > 0 && `Idle ${t.inactivitySeconds}s`,
    t.timeOnPageSeconds > 0 && `After ${t.timeOnPageSeconds}s`,
    t.scrollPercent > 0 && `Scroll ${t.scrollPercent}%`,
    t.clickSelector && "Click selector",
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      {/* Master switch */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-4 w-4" /> Website Embed &amp; Exit Intent
              </CardTitle>
              <CardDescription>
                Drop one script tag on your own site and this offer opens in a popup when a visitor
                is about to leave.
              </CardDescription>
            </div>
            <Switch checked={value.enabled} onCheckedChange={(enabled) => patch({ enabled })} />
          </div>
        </CardHeader>
        {!value.enabled && (
          <CardContent>
            <p className="rounded-lg border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
              The embed is off. The snippet below will load but stay silent until you turn this on
              and save.
            </p>
          </CardContent>
        )}
        {value.enabled && !offerIsActive && (
          <CardContent>
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
              This offer is still a draft. Activate it in General Settings, or the popup will have
              nothing to show visitors.
            </p>
          </CardContent>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Triggers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MousePointerClick className="h-4 w-4" /> Triggers
            </CardTitle>
            <CardDescription>
              What makes the popup appear. Any trigger that fires first wins; the rest stand down.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ToggleRow
              title="Exit intent (desktop)"
              hint="Fires when the pointer leaves the page through the top edge — heading for the tab bar, the back button or the close button."
              checked={t.exitIntent}
              onCheckedChange={(exitIntent) => patchTriggers({ exitIntent })}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Trigger zone height
                  </Label>
                  <p className="text-[11px] text-muted-foreground/80">
                    How close to the top the pointer has to get. Larger fires more eagerly.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={200}
                    value={t.exitSensitivity}
                    onChange={(e) =>
                      patchTriggers({ exitSensitivity: Number(e.target.value) || 0 })
                    }
                    className="h-9 w-20"
                  />
                  <span className="text-xs text-muted-foreground">px</span>
                </div>
              </div>
            </ToggleRow>

            <ToggleRow
              title="Fast scroll up (mobile)"
              hint="Phones have no pointer to lose, so a decisive upward flick near the top of the page stands in for exit intent."
              checked={t.mobileScrollUp}
              onCheckedChange={(mobileScrollUp) => patchTriggers({ mobileScrollUp })}
            />

            <ToggleRow
              title="Back button (mobile)"
              hint="Catches the back gesture and shows the offer instead of leaving. Effective, but some visitors find it pushy."
              checked={t.mobileBackButton}
              onCheckedChange={(mobileBackButton) => patchTriggers({ mobileBackButton })}
            />

            <NumberRow
              title="After inactivity"
              hint="Visitor stops moving, typing and scrolling for this long. 0 turns it off."
              value={t.inactivitySeconds}
              min={0}
              max={3600}
              suffix="sec"
              onChange={(inactivitySeconds) => patchTriggers({ inactivitySeconds })}
            />

            <NumberRow
              title="After time on page"
              hint="A plain timer from page load. 0 turns it off."
              value={t.timeOnPageSeconds}
              min={0}
              max={3600}
              suffix="sec"
              onChange={(timeOnPageSeconds) => patchTriggers({ timeOnPageSeconds })}
            />

            <NumberRow
              title="At scroll depth"
              hint="Visitor reaches this far down the page. 0 turns it off."
              value={t.scrollPercent}
              min={0}
              max={100}
              suffix="%"
              onChange={(scrollPercent) => patchTriggers({ scrollPercent })}
            />

            <div className="rounded-xl border p-4">
              <Label className="text-sm font-semibold">On click of an element</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                A CSS selector on your site. Anything matching it opens the offer instead of its
                normal action.
              </p>
              <Input
                value={t.clickSelector}
                placeholder=".win-a-prize, #offer-link"
                onChange={(e) => patchTriggers({ clickSelector: e.target.value })}
                className="mt-3 h-9 font-mono text-xs"
              />
            </div>
          </CardContent>
        </Card>

        {/* Behaviour + appearance */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>How often it shows</CardTitle>
              <CardDescription>
                Frequency capping is stored in the visitor&apos;s own browser.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {EMBED_FREQUENCIES.map((f) => (
                  <label
                    key={f.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      value.frequency === f.value ? "border-primary bg-muted/30" : "hover:bg-muted/20"
                    }`}
                  >
                    <input
                      type="radio"
                      name="embed-frequency"
                      className="mt-1"
                      checked={value.frequency === f.value}
                      onChange={() => patch({ frequency: f.value as EmbedFrequency })}
                    />
                    <div>
                      <span className="text-sm font-medium">{f.label}</span>
                      <p className="text-[11px] text-muted-foreground">{f.hint}</p>
                    </div>
                  </label>
                ))}
              </div>

              <NumberRow
                title="Grace period after load"
                hint="No trigger may fire before this. Stops the popup firing at a pointer already resting near the top of the window."
                value={value.armAfterSeconds}
                min={0}
                max={600}
                suffix="sec"
                onChange={(armAfterSeconds) => patch({ armAfterSeconds })}
              />

              <div className="flex items-center justify-between gap-3 rounded-xl border p-4">
                <div>
                  <Label className="text-sm font-semibold">Show FOMO on your site too</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Runs the notifications from the FOMO tab on your own pages, not just the offer
                    page.
                  </p>
                </div>
                <Switch checked={value.showFomo} onCheckedChange={(showFomo) => patch({ showFomo })} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Popup appearance</CardTitle>
              <CardDescription>Size and styling of the modal on your site.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Width</Label>
                  <Input
                    type="number"
                    min={280}
                    max={1200}
                    value={value.modal.width}
                    onChange={(e) =>
                      patch({ modal: { ...value.modal, width: Number(e.target.value) || 460 } })
                    }
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Height</Label>
                  <Input
                    type="number"
                    min={320}
                    max={1200}
                    value={value.modal.height}
                    onChange={(e) =>
                      patch({ modal: { ...value.modal, height: Number(e.target.value) || 640 } })
                    }
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Corner radius ({value.modal.radius}px)
                  </Label>
                  <input
                    type="range"
                    min={0}
                    max={48}
                    value={value.modal.radius}
                    onChange={(e) =>
                      patch({ modal: { ...value.modal, radius: Number(e.target.value) } })
                    }
                    className="w-full accent-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Backdrop dimming ({value.modal.overlayOpacity}%)
                  </Label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={value.modal.overlayOpacity}
                    onChange={(e) =>
                      patch({ modal: { ...value.modal, overlayOpacity: Number(e.target.value) } })
                    }
                    className="w-full accent-primary"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
                <Label className="text-sm">Close when the backdrop is clicked</Label>
                <Switch
                  checked={value.modal.closeOnOverlayClick}
                  onCheckedChange={(closeOnOverlayClick) =>
                    patch({ modal: { ...value.modal, closeOnOverlayClick } })
                  }
                />
              </div>

              <div className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Label className="text-sm font-semibold">Floating launcher button</Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      An always-visible button so visitors can open the offer themselves.
                    </p>
                  </div>
                  <Switch
                    checked={value.launcher.enabled}
                    onCheckedChange={(enabled) =>
                      patch({ launcher: { ...value.launcher, enabled } })
                    }
                  />
                </div>
                {value.launcher.enabled && (
                  <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-medium text-muted-foreground">Label</Label>
                      <Input
                        value={value.launcher.text}
                        maxLength={60}
                        onChange={(e) =>
                          patch({ launcher: { ...value.launcher, text: e.target.value } })
                        }
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Colour</Label>
                      <Input
                        type="color"
                        value={value.launcher.color}
                        onChange={(e) =>
                          patch({ launcher: { ...value.launcher, color: e.target.value } })
                        }
                        className="h-9 p-1"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-3">
                      <Label className="text-xs font-medium text-muted-foreground">Corner</Label>
                      <Select
                        value={value.launcher.position}
                        onValueChange={(next) =>
                          patch({
                            launcher: {
                              ...value.launcher,
                              position: (next ?? value.launcher.position) as LauncherPosition,
                            },
                          })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(v: string) =>
                              LAUNCHER_CORNERS.find((c) => c.value === v)?.label ?? v
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {LAUNCHER_CORNERS.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Allowed domains</CardTitle>
              <CardDescription>
                Leave empty to allow any site. Add domains to stop the snippet working if it is
                copied elsewhere.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {value.allowedDomains.map((domain) => (
                <div key={domain} className="flex items-center gap-2">
                  <code className="flex-1 rounded-md border bg-muted/40 px-3 py-1.5 text-xs">
                    {domain}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:bg-red-500/10 hover:text-red-600"
                    onClick={() =>
                      patch({ allowedDomains: value.allowedDomains.filter((d) => d !== domain) })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Input
                  value={newDomain}
                  placeholder="example.com"
                  onChange={(e) => setNewDomain(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const clean = newDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
                      if (clean && !value.allowedDomains.includes(clean)) {
                        patch({ allowedDomains: [...value.allowedDomains, clean] });
                      }
                      setNewDomain("");
                    }
                  }}
                  className="h-9"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const clean = newDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
                    if (clean && !value.allowedDomains.includes(clean)) {
                      patch({ allowedDomains: [...value.allowedDomains, clean] });
                    }
                    setNewDomain("");
                  }}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Add
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Subdomains of a listed domain are allowed automatically.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Installation snippet */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Code2 className="h-4 w-4" /> Installation
              </CardTitle>
              <CardDescription>
                Paste this once, just before the closing <code>&lt;/body&gt;</code> tag of your
                site. It loads asynchronously and blocks nothing.
              </CardDescription>
            </div>
            <CopyButton text={snippets[platform]} label="Copy snippet" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPlatform(p.key)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  platform === p.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <pre className="overflow-x-auto rounded-xl border bg-neutral-950 p-4 text-xs leading-relaxed text-neutral-100">
            <code>{snippets[platform]}</code>
          </pre>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border bg-muted/20 p-4">
              <h4 className="text-sm font-semibold">Control it from your own code</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                The loader exposes a small API on <code>window</code> once it is ready.
              </p>
              <pre className="mt-3 overflow-x-auto rounded-lg border bg-neutral-950 p-3 text-[11px] leading-relaxed text-neutral-100">
                <code>{`// Open the offer from your own button
MagicOffer.open();

// Close it
MagicOffer.close();

// Clear frequency capping while testing
MagicOffer.reset();

// React to what the visitor does
window.addEventListener("magicoffer:open", (e) =>
  console.log("opened by", e.detail.source)
);
window.addEventListener("magicoffer:registered", () =>
  console.log("visitor entered the offer")
);`}</code>
              </pre>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <h4 className="text-sm font-semibold">What the snippet does</h4>
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                <li>
                  Fetches this offer&apos;s settings from{" "}
                  <code className="text-[11px]">/api/w/{companySlug}/embed-config</code>.
                </li>
                <li>Arms only the triggers you switched on above.</li>
                <li>
                  Renders the popup in a shadow root, so your site&apos;s CSS and the popup&apos;s
                  cannot collide.
                </li>
                <li>Remembers who has seen it, per your frequency setting.</li>
                <li>Stays silent entirely if the embed or the offer is switched off.</li>
              </ul>
              {activeTriggers.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
                  {activeTriggers.map((label) => (
                    <Badge key={label} variant="secondary" className="text-[10px]">
                      {label}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t bg-muted/20 pt-4">
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save embed settings"}
          </Button>
        </CardFooter>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MonitorSmartphone className="h-4 w-4" /> Preview
              </CardTitle>
              <CardDescription>
                A mock storefront showing what the popup looks like on a real page.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPreviewOpen((v) => !v)}>
                {previewOpen ? "Hide popup" : "Simulate exit intent"}
              </Button>
              <a
                href={testPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open live test page
              </a>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Mock browser chrome */}
          <div className="overflow-hidden rounded-xl border shadow-sm">
            <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <div className="ml-2 flex-1 truncate rounded bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
                https://your-website.com
              </div>
            </div>

            <div className="relative h-[520px] overflow-hidden bg-white dark:bg-neutral-950">
              {/* Fake storefront behind the popup */}
              <div className="p-8">
                <div className="mb-8 flex items-center justify-between">
                  <div className="h-6 w-28 rounded bg-foreground/15" />
                  <div className="flex gap-3">
                    <div className="h-3 w-14 rounded bg-foreground/10" />
                    <div className="h-3 w-14 rounded bg-foreground/10" />
                    <div className="h-3 w-14 rounded bg-foreground/10" />
                  </div>
                </div>
                <div className="h-4 w-2/3 rounded bg-foreground/15" />
                <div className="mt-2.5 h-3 w-1/2 rounded bg-foreground/10" />
                <div className="mt-6 grid grid-cols-3 gap-4">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-28 rounded-lg bg-foreground/10" />
                      <div className="h-2.5 w-3/4 rounded bg-foreground/10" />
                      <div className="h-2.5 w-1/2 rounded bg-foreground/10" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Launcher preview */}
              {value.launcher.enabled && !previewOpen && (
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  style={{ background: value.launcher.color }}
                  className={`absolute bottom-5 rounded-full px-5 py-3 text-sm font-bold text-white shadow-lg ${
                    value.launcher.position === "bottom-left" ? "left-5" : "right-5"
                  }`}
                >
                  {value.launcher.text}
                </button>
              )}

              {/* The popup itself */}
              {previewOpen && (
                <div
                  className="absolute inset-0 flex items-center justify-center p-4"
                  style={{ background: `rgba(6, 8, 12, ${value.modal.overlayOpacity / 100})` }}
                  onClick={() => value.modal.closeOnOverlayClick && setPreviewOpen(false)}
                >
                  <div
                    className="relative w-full overflow-hidden bg-neutral-950 shadow-2xl"
                    style={{
                      maxWidth: `${value.modal.width}px`,
                      height: `${Math.min(value.modal.height, 460)}px`,
                      borderRadius: `${value.modal.radius}px`,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewOpen(false)}
                      aria-label="Close preview"
                      className="absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition-colors hover:bg-black/75"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <iframe
                      title={`${offerTitle} preview`}
                      src={`/w/${companySlug}?o=${offerId}&embed=1`}
                      className="h-full w-full border-0"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            The inline preview shows layout only. Use{" "}
            <span className="font-medium text-foreground">Open live test page</span> to try the real
            triggers — move your mouse up out of the window to fire exit intent, and reload to test
            your frequency setting.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
