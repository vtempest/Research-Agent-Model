# extract-youtube demo

A standalone app that puts both of `extract-youtube/react`'s components
together end to end:

- **A saved video library** — a grid of favorite videos, ready to pick from.
  Click any card and it starts in the floating player; star to favorite,
  queue up what plays next, add your own by URL. The library is kept in
  `localStorage`, so it's still there next time.
- **`<FloatingYouTubePlayer />`** — mounted once, at the root of the app.
  Drag it anywhere, resize it from the edges, minimize it to its title bar
  (playback carries on), pop it out into an always-on-top window, or turn on
  captions for a synced, clickable transcript. Reload the page and it comes
  back still playing the same video, at the same spot.
- **`<YouTubeTranscriptModal />`** — the captions button on each card, opening
  the video next to its full transcript.

Full setup docs live in the parent package's
[README → "React components"](../README.md#react-components-floating-player--transcript-modal).

## Run it

```bash
# from packages/extract-youtube:
npm run build   # builds dist/ (this demo depends on it via file:..)
npm run demo    # installs this folder's deps and starts server + client

# or, from this folder directly:
npm install
npm run dev     # starts both the Express API (:8787) and Vite (:5173)
```

Open http://localhost:5173.

## What's here

- `server.js` — Express endpoint (`GET /api/transcript?videoId=...`) that
  wraps `YouTubeTranscriptApi` from the parent package. Plain Node/Express
  so it's easy to adapt into a real backend — a Next.js route handler, a
  Cloudflare Worker, a Lambda — see the parent README for those.
- `src/library.js` — the starter playlist and the `localStorage` favorites
  library. In a real app this is whatever you already have: a database
  table, an API, a starred-items list. The package never stores your videos.
- `src/VideoGrid.jsx` — the picker. Calls `youtubePlayer.play(video)` and
  `youtubePlayer.addToQueue(video)`; reads `usePlayerState()` to show which
  card is playing or queued.
- `src/SpeedButton.jsx` — **a custom control supplied by the app, not the
  package.** It arrives through `<FloatingYouTubePlayer extraControls={...} />`
  and drives `player.setPlaybackRate()`. This is the seam for app-specific
  chrome: debate-ai.com, where this player was ported from, plugs its own
  "slow the debate spread down" button in exactly here, with its own label
  and rate. The package itself stays generic.
- `src/App.jsx` — the page: toolbar, grid, and the one mounted player.
- `vite.config.js` — proxies `/api` to the Express server in dev, and dedupes
  React (the package is linked in with `file:..`, so it ships its own copy).
