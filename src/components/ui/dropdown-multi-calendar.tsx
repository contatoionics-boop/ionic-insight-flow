"use client";

import * as React from "react";
import { format, setMonth, setYear } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface DropdownMultiCalendarProps {
  value?: Date[];
  onChange?: (dates: Date[]) => void;
  onConfirm?: (dates: Date[]) => void;
  title?: string;
  confirmLabel?: string;
  emptyLabel?: string;
}

function DropdownMultiCalendar({
  value,
  onChange,
  onConfirm,
  title = "Selecionar datas",
  confirmLabel = "Confirmar",
  emptyLabel = "Nenhuma data selecionada",
}: DropdownMultiCalendarProps) {
  const today = new Date();
  const [month, setMonthState] = React.useState(today.getMonth());
  const [year, setYearState] = React.useState(today.getFullYear());
  const [internal, setInternal] = React.useState<Date[]>(value ?? []);

  const selectedDates = value ?? internal;

  const update = (dates: Date[]) => {
    if (!value) setInternal(dates);
    onChange?.(dates);
  };

  const handleRemove = (date: Date) => {
    update(
      selectedDates.filter(
        (d) => format(d, "yyyy-MM-dd") !== format(date, "yyyy-MM-dd"),
      ),
    );
  };

  const displayMonth = setMonth(setYear(today, year), month);

  return (
    <Card className="w-full max-w-md border-border bg-card text-card-foreground">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Select value={String(year)} onValueChange={(val) => setYearState(Number(val))}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 50 }, (_, i) => year - 25 + i).map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(month)} onValueChange={(val) => setMonthState(Number(val))}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i} value={String(i)}>
                  {format(new Date(2000, i, 1), "MMMM")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Calendar
          mode="multiple"
          selected={selectedDates}
          onSelect={(dates) => update(dates ?? [])}
          month={displayMonth}
          onMonthChange={(date) => {
            setMonthState(date.getMonth());
            setYearState(date.getFullYear());
          }}
          className="rounded-md border border-border bg-background"
        />

        <div className="flex flex-wrap gap-2">
          {selectedDates.length === 0 && (
            <p className="text-sm text-muted-foreground">{emptyLabel}</p>
          )}
          {selectedDates
            .slice()
            .sort((a, b) => a.getTime() - b.getTime())
            .map((d) => (
              <Badge
                key={d.toISOString()}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {format(d, "PPP")}
                <button
                  type="button"
                  onClick={() => handleRemove(d)}
                  className="ml-1 text-muted-foreground hover:text-foreground"
                  aria-label="Remover"
                >
                  ✕
                </button>
              </Badge>
            ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          onClick={() => onConfirm?.(selectedDates)}
          disabled={selectedDates.length === 0}
        >
          {confirmLabel}
        </Button>
      </CardFooter>
    </Card>
  );
}

export { DropdownMultiCalendar };
