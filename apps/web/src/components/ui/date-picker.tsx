"use client";

import * as React from "react";
import { format, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DatePickerProps {
  /** Date value as "yyyy-MM-dd", or undefined/empty for no selection. */
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  // parse (not `new Date(value)`) so a bare "yyyy-MM-dd" is read as local
  // time, not UTC midnight — the latter can roll back a day near midnight.
  const selected = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn("justify-start font-normal", className)}
          />
        }
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {selected ? (
          format(selected, "dd MMMM yyyy")
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          {...(selected ? { defaultMonth: selected } : {})}
          onSelect={(date) => {
            if (date) onChange(format(date, "yyyy-MM-dd"));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
