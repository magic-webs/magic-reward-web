"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Users, X } from "lucide-react";
import { SiteHeader } from "@/components/admin/site-header";
import { DatePickerField } from "@/components/admin/date-picker-field";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCompany, useCompanyCrumbs } from "../company-context";

type SpinRow = {
  id: string;
  name: string;
  phone: string;
  prizeLabel: string | null;
  extraFields: Record<string, string>;
  createdAt: number;
};

const ALL_PRIZES = "__all__";
const NOT_SPUN = "__not_spun__";

export default function RegistrationsPage() {
  const { company } = useCompany();
  const crumbs = useCompanyCrumbs("Registrations");
  const [spins, setSpins] = useState<SpinRow[] | null>(null);

  const [search, setSearch] = useState("");
  const [prizeFilter, setPrizeFilter] = useState(ALL_PRIZES);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    fetch(`/api/admin/companies/${company.id}/spins`)
      .then((res) => res.json())
      .then((data) => setSpins(data.spins ?? []));
  }, [company.id]);

  const spunCount = spins?.filter((s) => s.prizeLabel).length ?? 0;

  const prizeOptions = useMemo(() => {
    const labels = new Set<string>();
    for (const s of spins ?? []) {
      if (s.prizeLabel) labels.add(s.prizeLabel);
    }
    return Array.from(labels).sort();
  }, [spins]);

  const hasActiveFilters = Boolean(search.trim() || prizeFilter !== ALL_PRIZES || dateFrom || dateTo);

  function clearFilters() {
    setSearch("");
    setPrizeFilter(ALL_PRIZES);
    setDateFrom("");
    setDateTo("");
  }

  const filteredSpins = useMemo(() => {
    if (!spins) return [];
    const query = search.trim().toLowerCase();
    const fromMs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toMs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

    return spins.filter((s) => {
      if (query) {
        const haystack = [s.name, s.phone, ...Object.values(s.extraFields ?? {})]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (prizeFilter === NOT_SPUN && s.prizeLabel) return false;
      if (prizeFilter !== ALL_PRIZES && prizeFilter !== NOT_SPUN && s.prizeLabel !== prizeFilter) {
        return false;
      }
      if (fromMs !== null && s.createdAt < fromMs) return false;
      if (toMs !== null && s.createdAt > toMs) return false;
      return true;
    });
  }, [spins, search, prizeFilter, dateFrom, dateTo]);

  return (
    <>
      <SiteHeader crumbs={crumbs} />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Registrations</CardTitle>
            <CardDescription>
              {spins
                ? hasActiveFilters
                  ? `Showing ${filteredSpins.length} of ${spins.length} registered (${spunCount} spun)`
                  : `${spunCount} spun / ${spins.length} registered`
                : "Loading…"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {spins === null ? (
              <div className="flex items-center justify-center py-10">
                <Spinner className="size-6 text-muted-foreground" />
              </div>
            ) : spins.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Users />
                  </EmptyMedia>
                  <EmptyTitle>No registrations yet</EmptyTitle>
                  <EmptyDescription>
                    Registrations will show up here once customers start spinning.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-48 flex-1 space-y-2">
                    <Label htmlFor="registrations-search">Search</Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="registrations-search"
                        placeholder="Name, phone, or field value"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Prize</Label>
                    <Select value={prizeFilter} onValueChange={(value) => setPrizeFilter(value ?? ALL_PRIZES)}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="All prizes">
                          {(value: string) =>
                            value === NOT_SPUN ? "Not spun yet" : value === ALL_PRIZES || !value ? "All prizes" : value
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_PRIZES}>All prizes</SelectItem>
                        <SelectItem value={NOT_SPUN}>Not spun yet</SelectItem>
                        {prizeOptions.map((label) => (
                          <SelectItem key={label} value={label}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="registrations-from">From</Label>
                    <DatePickerField
                      id="registrations-from"
                      value={dateFrom}
                      max={dateTo}
                      onChange={setDateFrom}
                      placeholder="Earliest"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="registrations-to">To</Label>
                    <DatePickerField
                      id="registrations-to"
                      value={dateTo}
                      min={dateFrom}
                      onChange={setDateTo}
                      placeholder="Latest"
                    />
                  </div>

                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X /> Clear filters
                    </Button>
                  )}
                </div>

                {filteredSpins.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Search />
                      </EmptyMedia>
                      <EmptyTitle>No matches</EmptyTitle>
                      <EmptyDescription>
                        No registrations match these filters. Try adjusting or clearing them.
                      </EmptyDescription>
                    </EmptyHeader>
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  </Empty>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Phone</TableHead>
                        {company.fields.map((f) => (
                          <TableHead key={f.key}>{f.label}</TableHead>
                        ))}
                        <TableHead>Prize</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSpins.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {s.phone.startsWith("anon-") ? "—" : s.phone}
                          </TableCell>
                          {company.fields.map((f) => (
                            <TableCell key={f.key} className="text-muted-foreground">
                              {s.extraFields?.[f.key] || "—"}
                            </TableCell>
                          ))}
                          <TableCell>
                            {s.prizeLabel ? (
                              <Badge>{s.prizeLabel}</Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">Not spun yet</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(s.createdAt).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
