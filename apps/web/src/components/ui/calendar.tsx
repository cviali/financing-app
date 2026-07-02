"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type DayButtonProps } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col gap-4",
        month: "flex flex-col gap-4",
        month_caption: "flex justify-center items-center h-8 relative",
        caption_label: "text-sm font-medium",
        nav: "flex items-center justify-between absolute inset-x-0 top-0 h-8",
        button_previous: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "absolute left-0",
        ),
        button_next: cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "absolute right-0"),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-muted-foreground w-8 text-[0.8rem] font-normal",
        week: "flex w-full mt-1",
        day: "size-8 p-0 text-center text-sm",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...chevronProps }) =>
          orientation === "left" ? (
            <ChevronLeft className="size-4" {...chevronProps} />
          ) : (
            <ChevronRight className="size-4" {...chevronProps} />
          ),
        DayButton: ({ day, modifiers, className, ...buttonProps }: DayButtonProps) => (
          <Button
            variant="ghost"
            className={cn(
              "size-8 p-0 font-normal aria-selected:opacity-100",
              modifiers.selected &&
                "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
              modifiers.today && !modifiers.selected && "bg-muted text-foreground",
              className,
            )}
            {...buttonProps}
          />
        ),
      }}
      {...props}
    />
  );
}

export { Calendar };
