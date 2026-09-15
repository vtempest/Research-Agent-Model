/**
 * The demo's starting playlist, plus the "saved favorites" library that sits
 * on top of it.
 *
 * The library is just a list of `{ videoId, title, channel }` in localStorage —
 * whatever your app already has (a database, an API, a starred-items table)
 * plays the same role in a real integration. `extract-youtube/react` never
 * stores your videos; it only ever plays the one you hand it.
 */

const STORAGE_KEY = "extract-youtube-demo-library";

/** Ships with the demo so the grid isn't empty on first run. */
export const STARTER_PLAYLIST = [
  { videoId: "jNQXAC9IVRw", title: "Me at the zoo", channel: "jawed", favorite: true },
  { videoId: "aircAruvnKk", title: "But what is a neural network?", channel: "3Blue1Brown", favorite: true },
  { videoId: "UF8uR6Z6KLc", title: "Steve Jobs' 2005 Stanford Commencement Address", channel: "Stanford" },
  { videoId: "Ks-_Mh1QhMc", title: "Your body language may shape who you are", channel: "TED", favorite: true },
  { videoId: "rfscVS0vtbw", title: "Learn Python — Full Course for Beginners", channel: "freeCodeCamp.org" },
  { videoId: "M7lc1UVf-VE", title: "Embedded Web Player Customization", channel: "YouTube Developers" },
  { videoId: "dQw4w9WgXcQ", title: "Never Gonna Give You Up", channel: "Rick Astley" },
  { videoId: "fJ9rUzIMcZQ", title: "Bohemian Rhapsody", channel: "Queen" },
  { videoId: "9bZkp7q19f0", title: "Gangnam Style", channel: "PSY" },
  { videoId: "kJQP7kiw5Fk", title: "Despacito", channel: "Luis Fonsi" },
];

/** Read the saved library, falling back to the starter playlist on first run. */
export function loadLibrary() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return STARTER_PLAYLIST;
    const saved = JSON.parse(raw);
    return Array.isArray(saved) && saved.length > 0 ? saved : STARTER_PLAYLIST;
  } catch {
    return STARTER_PLAYLIST;
  }
}

export function saveLibrary(videos) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
  } catch {
    // ignore quota / private-mode errors — the demo still works in-memory
  }
}

/**
 * A browser-safe stand-in for the package's own `extractVideoId`, which lives
 * in the main (Node-oriented) entry point alongside the transcript fetcher —
 * importing it here would pull that into the client bundle.
 */
export function parseVideoId(input) {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.slice(1).split("/")[0] || null;
    }
    const v = url.searchParams.get("v");
    if (v) return v;
    const match = url.pathname.match(/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
