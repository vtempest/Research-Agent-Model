/**
 * Open-Meteo (with `timezone=auto`) reports naive local timestamps such as
 * `2024-01-01T13:00`, and the widget renders them with plain `new Date(...)`.
 * The fallback providers report instants in UTC instead, so their timestamps
 * are rewritten into the same naive local shape before they reach the widget
 * -- otherwise a failover would silently shift every hour label.
 */

type Parts = Record<string, string>;

function zonedParts(instant: Date, timeZone: string | undefined): Parts | null {
  try {
    const format = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || undefined,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts: Parts = {};
    for (const part of format.formatToParts(instant)) parts[part.type] = part.value;
    return parts;
  } catch {
    return null;
  }
}

/** `2024-01-01T13:00` for the given instant, as read in `timeZone`. */
export function toZonedIsoMinutes(instant: Date, timeZone?: string): string {
  const parts = zonedParts(instant, timeZone);
  if (!parts) return instant.toISOString().slice(0, 16);
  // Intl renders midnight as hour 24 in some engines; normalize it back to 00.
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

/** `2024-01-01` for the given instant, as read in `timeZone`. */
export function toZonedDate(instant: Date, timeZone?: string): string {
  return toZonedIsoMinutes(instant, timeZone).slice(0, 10);
}
