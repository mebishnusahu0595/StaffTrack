import { format, formatDistanceToNowStrict, isToday, parseISO } from "date-fns";

export function formatDate(value?: string | Date | null, pattern = "dd MMM yyyy") {
  if (!value) {
    return "—";
  }

  const date = typeof value === "string" ? parseISO(value) : value;
  return format(date, pattern);
}

export function formatDateTime(value?: string | Date | null, pattern = "dd MMM yyyy, hh:mm a") {
  if (!value) {
    return "—";
  }

  const date = typeof value === "string" ? parseISO(value) : value;
  return format(date, pattern);
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

export function formatRelativeTime(value?: string | null) {
  if (!value) {
    return "No recent signal";
  }

  return formatDistanceToNowStrict(parseISO(value), { addSuffix: true });
}

export function isDateToday(value?: string | null) {
  return value ? isToday(parseISO(value)) : false;
}

export function toDateInputValue(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function formatTime(value?: string | Date | null, pattern = "hh:mm a") {
  if (!value) {
    return "—";
  }

  const date = typeof value === "string" ? parseISO(value) : value;
  return format(date, pattern);
}
