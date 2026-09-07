"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Edit2, Play, Pause, AlertCircle, Gamepad2, Calendar, ExternalLink } from "lucide-react";
import { SiteHeader } from "@/components/admin/site-header";
import { useCompany, useCompanyCrumbs } from "../company-context";
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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
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

type OfferRow = {
  id: string;
  title: string;
  type: string;
  event?: string;
  isActive: boolean;
  createdAt: number;
};

export default function OffersListPage() {
  const { company } = useCompany();
  const crumbs = useCompanyCrumbs("Offers");

  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog State
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("wheel");
  const [newEvent, setNewEvent] = useState("none");
  const [creating, setCreating] = useState(false);

  async function fetchOffers() {
    try {
      const res = await fetch(`/api/admin/companies/${company.id}/offers`);
      if (!res.ok) throw new Error("Failed to load offers");
      const data = await res.json();
      setOffers(data.offers || []);
    } catch (err) {
      setError("Failed to load offers. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOffers();
  }, [company.id]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/companies/${company.id}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          type: newType,
          event: newEvent,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create offer");
      }
      setNewTitle("");
      setShowCreate(false);
      await fetchOffers();
    } catch (err: any) {
      setError(err.message || "Failed to create offer");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(offerId: string) {
    if (!confirm("Are you sure you want to delete this offer? All configuration, prizes, and spins will be lost.")) {
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/admin/offers/${offerId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete offer");
      setOffers((prev) => prev.filter((o) => o.id !== offerId));
    } catch {
      setError("Failed to delete offer.");
    }
  }

  async function toggleActive(offer: OfferRow) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/offers/${offer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !offer.isActive }),
      });
      if (!res.ok) throw new Error("Failed to toggle state");
      setOffers((prev) =>
        prev.map((o) => (o.id === offer.id ? { ...o, isActive: !o.isActive } : o))
      );
    } catch {
      setError("Failed to update status.");
    }
  }

  return (
    <>
      <SiteHeader crumbs={crumbs} />

      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Offers</h2>
            <p className="text-muted-foreground">
              Create and manage customer engagement offers, sweepstakes, and seasonal campaigns.
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Offer
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Spinner className="h-6 w-6 text-muted-foreground" />
          </div>
        ) : offers.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center">
            <Gamepad2 className="h-12 w-12 text-muted-foreground/60 mb-4" />
            <CardTitle className="mb-2">No offers created yet</CardTitle>
            <CardDescription className="mb-4">
              Get started by creating your first interactive offer or event-themed landing page.
            </CardDescription>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create Offer
            </Button>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {offers.map((offer) => {
              const gameType = findGameType(offer.type);
              const eventTheme = findEventTheme(offer.event);
              const GameIcon = gameType?.icon ?? Gamepad2;
              const EventIcon = eventTheme?.icon ?? Calendar;

              return (
                <Card key={offer.id} className="relative flex flex-col justify-between overflow-hidden">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Badge variant={offer.isActive ? "default" : "secondary"}>
                        {offer.isActive ? "Active" : "Draft"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(offer.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <CardTitle className="line-clamp-2">{offer.title}</CardTitle>
                    <CardDescription className="space-y-1">
                      <span className="flex items-center gap-1.5">
                        <GameIcon className="size-3.5 shrink-0" />
                        <span className="truncate">{gameType?.label ?? offer.type}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <EventIcon className="size-3.5 shrink-0" />
                        <span className="truncate">
                          Theme: {eventTheme?.label ?? offer.event ?? "Default"}
                        </span>
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="flex-col items-stretch gap-2 border-t bg-muted/30 pt-4">
                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href={`/admin/${company.slug}/offers/${offer.id}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        <Edit2 className="size-3.5" /> Manage
                      </Link>
                      <a
                        href={`/w/${company.slug}?o=${offer.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        <ExternalLink className="size-3.5" /> Launch
                      </a>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={offer.isActive ? "outline" : "default"}
                        size="sm"
                        onClick={() => toggleActive(offer)}
                        className="flex-1"
                      >
                        {offer.isActive ? (
                          <>
                            <Pause className="size-3.5" /> Pause
                          </>
                        ) : (
                          <>
                            <Play className="size-3.5" /> Activate
                          </>
                        )}
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        onClick={() => handleDelete(offer.id)}
                        aria-label={`Delete ${offer.title}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create Offer Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg animate-in fade-in zoom-in-95 duration-150">
              <h3 className="text-lg font-bold mb-4">Create New Offer</h3>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="offer-title">Offer Title</Label>
                  <Input
                    id="offer-title"
                    placeholder="e.g. Summer Scratch Card, Halloween Wheel"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="offer-type">Offer Type</Label>
                  <Select
                    value={newType}
                    onValueChange={(value) => setNewType(value ?? "wheel")}
                  >
                    <SelectTrigger id="offer-type" className="w-full">
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="offer-event">Event Style / Theme</Label>
                  <Select
                    value={newEvent}
                    onValueChange={(value) => setNewEvent(value ?? "none")}
                  >
                    <SelectTrigger id="offer-event" className="w-full">
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

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating || !newTitle.trim()}>
                    {creating ? "Creating..." : "Create Offer"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
