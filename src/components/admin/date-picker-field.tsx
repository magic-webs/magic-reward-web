"use client";

import { useState } from "react";
import { format, isValid, parse } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const ISO = "yyyy-MM-dd";

// Callers keep working in plain yyyy-MM-dd strings — the same values the
// old <input type="date"> produced — so filtering and URL state are
// unaffected by the switch to a calendar popover.
function fromIso(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = parse(value, ISO, new Date());
  return isValid(parsed) ? parsed : undefined;
}

export function DatePickerField({
  id,
  value,
  onChange,
  min,
  max,
  placeholder = "Any date",
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  // Both bounds are ISO strings too, so a "from" field can cap itself at
  // whatever "to" currently holds.
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = fromIso(value);
  const minDate = fromIso(min ?? "");
  const maxDate = fromIso(max ?? "");

  const disabled = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            variant="outline"
            className={cn(
              "w-44 justify-start font-normal",
              !selected && "text-muted-foreground",
              className,
            )}
          >
            <CalendarIcon className="size-4 text-muted-foreground" />
            {selected ? format(selected, "d MMM yyyy") : placeholder}
          </Button>
        }
      />
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          disabled={disabled.length > 0 ? disabled : undefined}
          autoFocus
          onSelect={(date) => {
            onChange(date ? format(date, ISO) : "");
            setOpen(false);
          }}
        />
        {value && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              <X className="size-3.5" /> Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
