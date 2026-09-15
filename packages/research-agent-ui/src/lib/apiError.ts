/**
 * @fileoverview Reads a human-readable message out of a qwksearch-api-client
 * error.
 *
 * The generated client resolves to `{ data, error, request, response }`. On a
 * non-2xx it puts the *parsed response body* in `error` — the handler's JSON
 * when one was returned, the raw text otherwise (a Worker error page, a
 * gateway timeout, an HTML 502 from in front of the app). It never copies the
 * HTTP status onto `error`, so `error.status` is always `undefined` and the
 * status has to be read from `response.status` instead.
 *
 * Reading `.message` straight off that body is what produced the
 * "Failed to fetch chats: undefined" toast: a platform 500 answers with text,
 * not with this app's `{ message }` shape.
 */

/** Longest error text worth putting in a toast; the rest is noise. */
const MAX_MESSAGE_LENGTH = 200;

/** Body keys the handlers in this repo use to carry an error string. */
const MESSAGE_KEYS = ["message", "error", "detail"] as const;

function truncate(text: string): string {
    return text.length > MAX_MESSAGE_LENGTH
        ? `${text.slice(0, MAX_MESSAGE_LENGTH - 1).trimEnd()}…`
        : text;
}

/**
 * Best-effort description of a failed API call, for logs and toasts.
 *
 * Falls back to the HTTP status so the caller never renders the literal
 * "undefined" — an unparseable body still tells the user *something* went
 * wrong and tells us which status it was.
 *
 * @param error `error` from a generated-client result — a parsed JSON body, a
 *   raw string, or undefined.
 * @param status `response.status` from that same result, when the request
 *   reached the server at all.
 */
export function apiErrorMessage(error: unknown, status?: number): string {
    const fallback = status ? `HTTP ${status}` : "Unknown error";

    if (typeof error === "string") {
        const text = error.trim();
        // An HTML error page is a wall of markup, never a message worth showing.
        if (!text || text.startsWith("<")) return fallback;
        return truncate(text);
    }

    if (error && typeof error === "object") {
        const body = error as Record<string, unknown>;
        for (const key of MESSAGE_KEYS) {
            const value = body[key];
            if (typeof value === "string" && value.trim()) {
                return truncate(value.trim());
            }
        }
    }

    return fallback;
}
