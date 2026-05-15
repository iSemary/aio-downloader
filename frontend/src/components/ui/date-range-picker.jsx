"use client"

import { format } from "date-fns"
import { CalendarIcon, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export function DateRangePicker({
  dateField,
  onDateFieldChange,
  dateFields = [],
  dateRange,
  onDateRangeChange,
}) {
  const hasRange = dateRange?.from || dateRange?.to
  const label = hasRange
    ? [
        dateRange.from ? format(dateRange.from, "MMM d, yyyy") : "...",
        dateRange.to ? format(dateRange.to, "MMM d, yyyy") : "...",
      ].join(" – ")
    : "Pick date range"

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 gap-1.5 text-sm font-normal",
            !hasRange && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="size-4 shrink-0" />
          <span className="hidden sm:inline truncate max-w-40">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="end">
        <div className="flex flex-col gap-3">
          <Select value={dateField} onValueChange={onDateFieldChange}>
            <SelectTrigger className="w-full h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dateFields.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={onDateRangeChange}
            numberOfMonths={2}
          />

          {hasRange && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={() => onDateRangeChange({ from: undefined, to: undefined })}
            >
              <X className="size-3.5" />
              Clear
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
