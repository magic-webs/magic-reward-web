"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, ArrowUp, ArrowDown, Plus, Trash2, Save, ImagePlus, 
  ExternalLink, Eye, Gamepad2, Calendar, Lock, Globe, FileText, Sparkles,
  AlertCircle, Settings, BellRing, Trophy, X
} from "lucide-react";
import { SiteHeader } from "@/components/admin/site-header";
import { useCompany, useCompanyCrumbs } from "../../company-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EVENT_THEMES,
  GAME_TYPES,
  findEventTheme,
  findGameType,
} from "@/lib/gameTypes";
import {
  DEFAULT_FIELD_TYPE,
  FIELD_TYPES,
  MAX_FIELD_OPTIONS,
  fieldTypeMeta,
  type FormFieldType,
} from "@/lib/formFields";
import FomoTab from "@/components/admin/FomoTab";
import EmbedTab from "@/components/admin/EmbedTab";
import { DEFAULT_FOMO_CONFIG, type FomoConfig } from "@/lib/fomo";
import { DEFAULT_EMBED_CONFIG, type EmbedConfig } from "@/lib/embed";

type PrizeRow = {
  id?: string;
  label: string;
  weight: number;
  isWin: boolean;
  color?: string | null;
  iconUrl?: string | null;
  pendingIconFile?: File;
  pendingIconPreview?: string;
};

type FieldRow = {
  id?: string;
  key?: string;
  label: string;
  required: boolean;
  type: FormFieldType;
  // Only meaningful for the choice types — kept around when the admin
  // switches type and back, so a mis-click doesn't lose the list.
  options: string[];
};

type OfferDetail = {
  id: string;
  title: string;
  type: string;
  event: string;
  isActive: boolean;
  askName: boolean;
  askPhone: boolean;
  wheelImageUrl: string | null;
  bgImageUrl: string | null;
  pinImageUrl: string | null;
  prizes: PrizeRow[];
  fields: FieldRow[];
  fomoConfig: FomoConfig;
  embedConfig: EmbedConfig;
};

type TabId = "setup" | "prizes" | "form" | "fomo" | "embed" | "general";

const TABS: { id: TabId; label: string; icon: typeof Gamepad2 }[] = [
  { id: "setup", label: "Offer Setup", icon: Gamepad2 },
  { id: "prizes", label: "Prizes", icon: Trophy },
  { id: "form", label: "Form Fields", icon: FileText },
  { id: "fomo", label: "FOMO", icon: BellRing },
  { id: "embed", label: "Embed & Exit Intent", icon: Globe },
  { id: "general", label: "General Settings", icon: Settings },
];

export default function OfferDetailPage() {
  const { company } = useCompany();
  const { offerId } = useParams<{ offerId: string }>();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Offer Configuration State
  const [offer, setOffer] = useState<OfferDetail | null>(null);
  const [prizes, setPrizes] = useState<PrizeRow[]>([]);
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [fomoConfig, setFomoConfig] = useState<FomoConfig>(DEFAULT_FOMO_CONFIG);
  const [embedConfig, setEmbedConfig] = useState<EmbedConfig>(DEFAULT_EMBED_CONFIG);
  const [activeTab, setActiveTab] = useState<TabId>("setup");

  // NEXT_PUBLIC_SITE_URL is what production serves the snippet from; the
  // origin fallback keeps the copy-paste code correct in local dev. Resolved
  // after mount so the server and client render the same first pass.
  const [siteUrl, setSiteUrl] = useState(process.env.NEXT_PUBLIC_SITE_URL ?? "");
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SITE_URL) setSiteUrl(window.location.origin);
  }, []);

  const crumbs = useCompanyCrumbs("Offers", offer?.title || "Edit Offer");

  async function loadOffer() {
    try {
      const res = await fetch(`/api/admin/offers/${offerId}`);
      if (!res.ok) throw new Error("Failed to fetch offer details");
      const data: OfferDetail = await res.json();
      setOffer(data);
      setPrizes(data.prizes || []);
      setFields(data.fields || []);
      setFomoConfig(data.fomoConfig ?? DEFAULT_FOMO_CONFIG);
      setEmbedConfig(data.embedConfig ?? DEFAULT_EMBED_CONFIG);
    } catch (err: any) {
      setError(err.message || "Failed to load offer settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOffer();
  }, [offerId]);

  // Image Upload helpers
  const [uploadingKind, setUploadingKind] = useState<"wheel" | "bg" | "pin" | null>(null);

  async function handleImageUpload(kind: "wheel" | "bg" | "pin", file: File) {
    setUploadingKind(kind);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/admin/offers/${offerId}/images?kind=${kind}`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to upload image.");
      const data = await res.json();
      
      setOffer((prev) => prev ? {
        ...prev,
        [`${kind}ImageUrl`]: data.url
      } : null);

      setSuccess(`Successfully uploaded ${kind} image!`);
    } catch (err: any) {
      setError(err.message || "Image upload failed.");
    } finally {
      setUploadingKind(null);
    }
  }

  // Prizes logic
  function updatePrize(index: number, patch: Partial<PrizeRow>) {
    setPrizes((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function movePrize(index: number, delta: number) {
    setPrizes((rows) => {
      const target = index + delta;
      if (target < 0 || target >= rows.length) return rows;
      const next = [...rows];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removePrize(index: number) {
    setPrizes((rows) => rows.filter((_, i) => i !== index));
  }

  function addPrize() {
    setPrizes((rows) => [...rows, { label: "", weight: 10, isWin: true }]);
  }

  async function handlePrizeIconUpload(index: number, prizeId: string, file: File) {
    setError(null);
    setSuccess(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/admin/prizes/${prizeId}/icon`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to upload prize icon");
      const data = await res.json();
      updatePrize(index, { iconUrl: data.url });
      setSuccess("Uploaded prize icon.");
    } catch {
      setError("Failed to upload icon.");
    }
  }

  async function savePrizes() {
    setError(null);
    setSuccess(null);
    if (prizes.length === 0 || prizes.some((p) => !p.label.trim())) {
      setError("Every prize needs a label, and at least one prize is required.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/offers/${offerId}/prizes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prizes }),
      });
      if (!res.ok) throw new Error("Failed to save prizes");
      setSuccess("Prizes saved successfully!");
      await loadOffer();
    } catch {
      setError("Couldn't save prizes.");
    } finally {
      setSaving(false);
    }
  }

  // Fields logic
  function updateField(index: number, patch: Partial<FieldRow>) {
    setFields((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function moveField(index: number, delta: number) {
    setFields((rows) => {
      const target = index + delta;
      if (target < 0 || target >= rows.length) return rows;
      const next = [...rows];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeField(index: number) {
    setFields((rows) => rows.filter((_, i) => i !== index));
  }

  function addField() {
    setFields((rows) => [
      ...rows,
      { label: "", required: false, type: DEFAULT_FIELD_TYPE, options: [] },
    ]);
  }

  // Switching to a dropdown/radio/checkbox list gives the admin two empty
  // choices to fill in rather than an editor with nothing in it.
  function changeFieldType(index: number, type: FormFieldType) {
    setFields((rows) =>
      rows.map((r, i) => {
        if (i !== index) return r;
        const needsSeed = fieldTypeMeta(type).hasOptions && r.options.length === 0;
        return { ...r, type, options: needsSeed ? ["", ""] : r.options };
      }),
    );
  }

  function updateOption(fieldIndex: number, optionIndex: number, value: string) {
    setFields((rows) =>
      rows.map((r, i) =>
        i === fieldIndex
          ? { ...r, options: r.options.map((o, j) => (j === optionIndex ? value : o)) }
          : r,
      ),
    );
  }

  function addOption(fieldIndex: number) {
    setFields((rows) =>
      rows.map((r, i) =>
        i === fieldIndex && r.options.length < MAX_FIELD_OPTIONS
          ? { ...r, options: [...r.options, ""] }
          : r,
      ),
    );
  }

  function removeOption(fieldIndex: number, optionIndex: number) {
    setFields((rows) =>
      rows.map((r, i) =>
        i === fieldIndex ? { ...r, options: r.options.filter((_, j) => j !== optionIndex) } : r,
      ),
    );
  }

  async function saveFields() {
    setError(null);
    setSuccess(null);
    if (fields.some((f) => !f.label.trim())) {
      setError("Every field needs a label.");
      return;
    }
    const needsChoices = fields.find(
      (f) => fieldTypeMeta(f.type).hasOptions && f.options.every((o) => !o.trim()),
    );
    if (needsChoices) {
      setError(
        `"${needsChoices.label.trim() || "Untitled question"}" needs at least one choice to pick from.`,
      );
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/offers/${offerId}/fields`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Failed to save signup fields");
      }
      setSuccess("Signup fields saved successfully!");
      await loadOffer();
    } catch (err: any) {
      setError(err.message || "Couldn't save form fields.");
    } finally {
      setSaving(false);
    }
  }

  // Both the FOMO and the Embed tab persist through the same offer PUT —
  // each sends only its own blob so the two tabs can never overwrite one
  // another with a stale copy.
  async function saveConfig(kind: "fomoConfig" | "embedConfig") {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/offers/${offerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [kind]: kind === "fomoConfig" ? fomoConfig : embedConfig,
        }),
      });
      if (!res.ok) throw new Error("Failed to save settings.");
      setSuccess(kind === "fomoConfig" ? "FOMO settings saved!" : "Embed settings saved!");
      await loadOffer();
    } catch (err: any) {
      setError(err.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  // Offer Setup owns type + event; General owns title + isActive.
  async function saveGameSetup(e: FormEvent) {
    e.preventDefault();
    if (!offer) return;
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const res = await fetch(`/api/admin/offers/${offerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: offer.type, event: offer.event }),
      });
      if (!res.ok) throw new Error("Failed to update offer style.");
      setSuccess("Offer style updated!");
      await loadOffer();
    } catch (err: any) {
      setError(err.message || "Failed to save offer style.");
    } finally {
      setSaving(false);
    }
  }

  // General Settings update
  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    if (!offer) return;
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const res = await fetch(`/api/admin/offers/${offerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: offer.title,
          isActive: offer.isActive,
          askName: offer.askName,
          askPhone: offer.askPhone,
        }),
      });
      if (!res.ok) throw new Error("Failed to update offer settings.");
      setSuccess("Offer settings updated!");
      await loadOffer();
    } catch (err: any) {
      setError(err.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Spinner className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="flex h-svh flex-col items-center justify-center p-4">
        <p className="text-muted-foreground">Offer details not found.</p>
        <Link
          href={`/admin/${company.slug}/offers`}
          className={buttonVariants({ className: "mt-4" })}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Offers
        </Link>
      </div>
    );
  }

  const previewUrl = `/w/${company.slug}?o=${offer.id}`;

  return (
    <>
      <SiteHeader crumbs={crumbs} />

      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        {/* Header and Preview Link */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-3xl font-bold tracking-tight">{offer.title}</h2>
              <Badge variant={offer.isActive ? "default" : "outline"}>
                {offer.isActive ? "Active" : "Draft"}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              Configure layout, prizes, events, and customized inputs for this offer.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/${company.slug}/offers`}
              className={buttonVariants({ variant: "outline" })}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> All Offers
            </Link>
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "secondary", className: "bg-emerald-600 hover:bg-emerald-700 text-white" })}
            >
              <Eye className="mr-2 h-4 w-4" /> Live Preview <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-emerald-600 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Sparkles className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Tabs navigation */}
        <div className="flex flex-wrap gap-2 border-b border-muted">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setError(null); setSuccess(null); }}
              className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" /> {tab.label}
            </button>
          ))}
        </div>

        {/* Tab contents */}
        <div className="mt-4 space-y-6">
        
          {/* GAME SETUP TAB */}
          {activeTab === "setup" && (
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Offer style */}
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle>Offer Style</CardTitle>
                    <CardDescription>
                      Which offer visitors play, and how it is dressed up.
                    </CardDescription>
                  </CardHeader>
                  <form onSubmit={saveGameSetup}>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="setup-type">Offer Type</Label>
                        <Select
                          value={offer.type}
                          onValueChange={(value) =>
                            setOffer((prev) => prev ? { ...prev, type: value ?? prev.type } : null)
                          }
                        >
                          <SelectTrigger id="setup-type" className="w-full">
                            <SelectValue>
                              {(value: string) => {
                                const game = findGameType(value);
                                if (!game) return value;
                                const Icon = game.icon;
                                return (
                                  <>
                                    <Icon className="text-muted-foreground" />
                                    {game.label}
                                  </>
                                );
                              }}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {GAME_TYPES.map((g) => (
                              <SelectItem key={g.value} value={g.value}>
                                <g.icon className="text-muted-foreground" />
                                {g.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Changing this swaps the offer visitors see. Prizes carry over.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="setup-event">Event Style / Theme</Label>
                        <Select
                          value={offer.event}
                          onValueChange={(value) =>
                            setOffer((prev) => prev ? { ...prev, event: value ?? prev.event } : null)
                          }
                        >
                          <SelectTrigger id="setup-event" className="w-full">
                            <SelectValue>
                              {(value: string) => {
                                const theme = findEventTheme(value);
                                if (!theme) return value;
                                const Icon = theme.icon;
                                return (
                                  <>
                                    <Icon className="text-muted-foreground" />
                                    {theme.label}
                                  </>
                                );
                              }}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {EVENT_THEMES.map((e) => (
                              <SelectItem key={e.value} value={e.value}>
                                <e.icon className="text-muted-foreground" />
                                {e.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                    <CardFooter className="border-t bg-muted/20 pt-4 justify-end">
                      <Button type="submit" disabled={saving}>
                        {saving ? "Saving..." : "Save Offer Style"}
                      </Button>
                    </CardFooter>
                  </form>
                </Card>
              </div>

              {/* Visual assets panel */}
              <div className="lg:col-span-2 grid gap-6 sm:grid-cols-2">
                {offer.type === "wheel" && (
                  <ImageUploadCard
                    title="Wheel Image"
                    description="Divided into segments matching your prizes."
                    imageUrl={offer.wheelImageUrl}
                    uploading={uploadingKind === "wheel"}
                    onUpload={(file) => handleImageUpload("wheel", file)}
                  />
                )}

                <ImageUploadCard
                  title="Background Image"
                  description="Shown behind the offer card. Optional."
                  imageUrl={offer.bgImageUrl}
                  uploading={uploadingKind === "bg"}
                  onUpload={(file) => handleImageUpload("bg", file)}
                />

                {offer.type === "wheel" && (
                  <ImageUploadCard
                    title="Tip Pointer Image"
                    description="Alternative indicator arrow for the wheel."
                    imageUrl={offer.pinImageUrl}
                    shape="circle"
                    uploading={uploadingKind === "pin"}
                    onUpload={(file) => handleImageUpload("pin", file)}
                  />
                )}
              </div>
            </div>
          )}

          {/* PRIZES TAB */}
          {activeTab === "prizes" && (
            <Card>
              <CardHeader>
                <CardTitle>Offer Prizes</CardTitle>
                <CardDescription>
                  Configure the winning outcomes and weights for this offer. A higher weight means
                  the prize is drawn more often.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {prizes.map((p, i) => (
                  <div
                    key={p.id ?? `new-${i}`}
                    className="flex flex-wrap items-start gap-4 rounded-xl border p-4 bg-muted/20"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file && p.id) handlePrizeIconUpload(i, p.id, file);
                        }}
                        disabled={!p.id}
                        className="hidden"
                        id={`icon-upload-${i}`}
                      />
                      <label
                        htmlFor={`icon-upload-${i}`}
                        className={`flex h-12 w-12 cursor-pointer items-center justify-center rounded-lg border border-dashed transition-all hover:bg-muted ${
                          p.iconUrl ? "" : "bg-neutral-100 dark:bg-neutral-800"
                        }`}
                      >
                        {p.iconUrl ? (
                          <img src={p.iconUrl} alt="icon" className="h-full w-full object-contain rounded-lg" />
                        ) : (
                          <ImagePlus className="h-5 w-5 text-muted-foreground/60" />
                        )}
                      </label>
                    </div>

                    <div className="flex-1 space-y-2 min-w-40">
                      <Input
                        placeholder="Prize Label (e.g. 20% Off)"
                        value={p.label}
                        onChange={(e) => updatePrize(i, { label: e.target.value })}
                      />
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">Win:</span>
                          <Switch
                            checked={p.isWin}
                            onCheckedChange={(checked) => updatePrize(i, { isWin: checked })}
                          />
                        </div>
                        <div className="flex items-center gap-1.5 flex-1">
                          <span className="text-xs text-muted-foreground">Weight:</span>
                          <Input
                            type="number"
                            className="h-8 w-20"
                            value={p.weight}
                            onChange={(e) => updatePrize(i, { weight: Number(e.target.value) || 0 })}
                          />
                        </div>
                        {offer.type === "wheel" && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">Color:</span>
                            <input
                              type="color"
                              value={p.color || "#ffffff"}
                              onChange={(e) => updatePrize(i, { color: e.target.value })}
                              className="h-7 w-7 rounded cursor-pointer border"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => movePrize(i, -1)}
                        disabled={i === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => movePrize(i, 1)}
                        disabled={i === prizes.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removePrize(i)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                <Button onClick={addPrize} variant="outline" className="w-full">
                  <Plus className="mr-2 h-4 w-4" /> Add Prize Option
                </Button>
              </CardContent>
              <CardFooter className="border-t bg-muted/20 pt-4 justify-between">
                <span className="text-xs text-muted-foreground">
                  {!prizes.some((p) => p.id) && "⚠️ Save prizes to enable icon uploads."}
                </span>
                <Button onClick={savePrizes} disabled={saving}>
                  {saving ? "Saving..." : "Save Prizes"}
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* SIGNUP FORM TAB */}
          {activeTab === "form" && (
            <div className="max-w-3xl space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Required Default Inputs</CardTitle>
                  <CardDescription>
                    Toggle the baseline user properties collected from customers before playing.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <Label className="text-base">Collect Full Name</Label>
                      <p className="text-sm text-muted-foreground">Asks the user for their full name.</p>
                    </div>
                    <Switch
                      checked={offer.askName}
                      onCheckedChange={(checked) => setOffer((prev) => prev ? { ...prev, askName: checked } : null)}
                    />
                  </div>
                  <div className="flex items-center justify-between pb-1">
                    <div>
                      <Label className="text-base">Collect Phone Number</Label>
                      <p className="text-sm text-muted-foreground">Requires a valid phone contact validation.</p>
                    </div>
                    <Switch
                      checked={offer.askPhone}
                      onCheckedChange={(checked) => setOffer((prev) => prev ? { ...prev, askPhone: checked } : null)}
                    />
                  </div>
                </CardContent>
                <CardFooter className="border-t bg-muted/20 pt-4 justify-end">
                  <Button onClick={saveSettings} disabled={saving}>
                    {saving ? "Saving..." : "Save Requirements"}
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Custom Signup Questions</CardTitle>
                  <CardDescription>
                    Ask anything you like in the signup popup — short text, email, phone, number, date, paragraph, dropdown, radio buttons or checkboxes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {fields.map((f, i) => {
                    const meta = fieldTypeMeta(f.type);
                    return (
                      <div key={f.id ?? `new-${i}`} className="space-y-3 rounded-xl border p-4 bg-muted/20">
                        <div className="flex flex-wrap items-center gap-3">
                          <Input
                            placeholder="Question Label (e.g. Email Address)"
                            value={f.label}
                            onChange={(e) => updateField(i, { label: e.target.value })}
                            className="min-w-40 flex-1"
                          />
                          <Select
                            value={f.type}
                            onValueChange={(value) =>
                              changeFieldType(i, (value ?? f.type) as FormFieldType)
                            }
                          >
                            <SelectTrigger className="w-52" aria-label="Answer type">
                              <SelectValue>
                                {(value: string) => {
                                  const picked = fieldTypeMeta(value);
                                  const Icon = picked.icon;
                                  return (
                                    <>
                                      <Icon className="text-muted-foreground" />
                                      {picked.label}
                                    </>
                                  );
                                }}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {FIELD_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                  <t.icon className="text-muted-foreground" />
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground">Required:</span>
                              <Switch
                                checked={f.required}
                                onCheckedChange={(checked) => updateField(i, { required: checked })}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => moveField(i, -1)}
                                disabled={i === 0}
                              >
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => moveField(i, 1)}
                                disabled={i === fields.length - 1}
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeField(i)}
                                className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground">{meta.hint}</p>

                        {meta.hasOptions && (
                          <div className="space-y-2 rounded-lg border border-dashed p-3">
                            <p className="text-xs font-medium text-muted-foreground">
                              Choices {meta.multi ? "(visitors can pick several)" : "(visitors pick one)"}
                            </p>
                            {f.options.map((option, j) => (
                              <div key={j} className="flex items-center gap-2">
                                <Input
                                  placeholder={`Choice ${j + 1}`}
                                  value={option}
                                  onChange={(e) => updateOption(i, j, e.target.value)}
                                  className="h-8 flex-1"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-red-600"
                                  onClick={() => removeOption(i, j)}
                                  aria-label={`Remove choice ${j + 1}`}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addOption(i)}
                              disabled={f.options.length >= MAX_FIELD_OPTIONS}
                            >
                              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add choice
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <Button onClick={addField} variant="outline" className="w-full">
                    <Plus className="mr-2 h-4 w-4" /> Add Signup Question
                  </Button>
                </CardContent>
                <CardFooter className="border-t bg-muted/20 pt-4 justify-end">
                  <Button onClick={saveFields} disabled={saving}>
                    {saving ? "Saving..." : "Save Custom Fields"}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}

          {/* FOMO TAB */}
          {activeTab === "fomo" && (
            <FomoTab
              value={fomoConfig}
              onChange={setFomoConfig}
              onSave={() => saveConfig("fomoConfig")}
              saving={saving}
            />
          )}

          {/* EMBED & EXIT INTENT TAB */}
          {activeTab === "embed" && (
            <EmbedTab
              value={embedConfig}
              onChange={setEmbedConfig}
              onSave={() => saveConfig("embedConfig")}
              saving={saving}
              siteUrl={siteUrl}
              companySlug={company.slug}
              offerId={offer.id}
              offerTitle={offer.title}
              offerIsActive={offer.isActive}
            />
          )}

          {/* GENERAL SETTINGS TAB */}
          {activeTab === "general" && (
            <div className="max-w-xl">
              <Card>
                <CardHeader>
                  <CardTitle>Offer Details</CardTitle>
                  <CardDescription>
                    The offer name and whether it is live for customers.
                  </CardDescription>
                </CardHeader>
                <form onSubmit={saveSettings}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-title">Offer Title</Label>
                      <Input
                        id="edit-title"
                        value={offer.title}
                        onChange={(e) => setOffer((prev) => prev ? { ...prev, title: e.target.value } : null)}
                        required
                      />
                    </div>

                    <div className="rounded-lg border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
                      Offer type and event theme moved to the{" "}
                      <button
                        type="button"
                        onClick={() => setActiveTab("setup")}
                        className="font-medium text-foreground underline underline-offset-2"
                      >
                        Offer Setup
                      </button>{" "}
                      tab.
                    </div>

                    <div className="flex items-center justify-between border-t pt-4">
                      <div>
                        <Label className="text-base">Active Status</Label>
                        <p className="text-sm text-muted-foreground">
                          Toggle to publish this offer. Active offers are visible to customers.
                        </p>
                      </div>
                      <Switch
                        checked={offer.isActive}
                        onCheckedChange={(checked) => setOffer((prev) => prev ? { ...prev, isActive: checked } : null)}
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="border-t bg-muted/20 pt-4 justify-end">
                    <Button type="submit" disabled={saving}>
                      {saving ? "Saving..." : "Save Settings"}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </div>
          )}

        </div>
      </div>
    </>
  );
}

// Reusable ImageUploadCard component
function ImageUploadCard({
  title,
  description,
  imageUrl,
  shape = "square",
  uploading,
  onUpload,
}: {
  title: string;
  description: string;
  imageUrl: string | null;
  shape?: "square" | "circle";
  uploading: boolean;
  onUpload: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    e.target.value = "";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <input
          type="file"
          accept="image/*"
          ref={inputRef}
          onChange={handleChange}
          disabled={uploading}
          className="hidden"
        />

        <div className="relative flex h-36 w-36 items-center justify-center border border-dashed rounded-lg bg-muted/20">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              className={`h-full w-full object-contain ${shape === "circle" ? "rounded-full" : "rounded-lg"}`}
            />
          ) : (
            <ImagePlus className="h-8 w-8 text-muted-foreground/40" />
          )}
        </div>

        <Button
          variant="outline"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="w-full"
        >
          {uploading ? "Uploading..." : "Upload Image"}
        </Button>
      </CardContent>
    </Card>
  );
}
