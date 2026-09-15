/**
 * extract-youtube demo: a saved video library you pick from, and a floating
 * player that keeps playing while you browse.
 *
 * The two pieces of `extract-youtube/react` on show:
 *   - `<FloatingYouTubePlayer />` — mounted once, here. Drag it, resize it,
 *     minimize it, pop it out; it survives a page reload still playing.
 *   - `<YouTubeTranscriptModal />` — one per card, in `VideoGrid.jsx`.
 * Both read captions from the same `/api/transcript` endpoint (`server.js`).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { FloatingYouTubePlayer, youtubePlayer } from "extract-youtube/react";

import { SpeedButton } from "./SpeedButton.jsx";
import { VideoGrid } from "./VideoGrid.jsx";
import { loadLibrary, parseVideoId, saveLibrary } from "./library.js";

export default function App() {
  const [videos, setVideos] = useState(loadLibrary);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [input, setInput] = useState("");
  const [addError, setAddError] = useState(null);

  useEffect(() => saveLibrary(videos), [videos]);

  const visible = useMemo(
    () => (showFavoritesOnly ? videos.filter((video) => video.favorite) : videos),
    [videos, showFavoritesOnly],
  );

  const favoriteCount = videos.filter((video) => video.favorite).length;

  const toggleFavorite = useCallback((videoId) => {
    setVideos((current) =>
      current.map((video) => (video.videoId === videoId ? { ...video, favorite: !video.favorite } : video)),
    );
  }, []);

  const remove = useCallback((videoId) => {
    setVideos((current) => current.filter((video) => video.videoId !== videoId));
    youtubePlayer.removeFromQueue(videoId);
  }, []);

  const addVideo = useCallback(() => {
    const videoId = parseVideoId(input);
    if (!videoId) {
      setAddError("Paste a YouTube URL or an 11-character video ID.");
      return;
    }
    setAddError(null);
    setInput("");
    setVideos((current) =>
      current.some((video) => video.videoId === videoId)
        ? current
        : [{ videoId, title: `Video ${videoId}`, channel: "Added by you", favorite: true }, ...current],
    );
  }, [input]);

  /** Start the first video and line the rest of the visible grid up behind it. */
  const playAll = useCallback(() => {
    const [first, ...rest] = visible;
    if (!first) return;
    youtubePlayer.play(first);
    youtubePlayer.setQueue(rest);
  }, [visible]);

  return (
    <main className="page">
      <header className="header">
        <h1>extract-youtube — floating player demo</h1>
        <p>
          Pick anything from the grid and it starts playing in a floating window you can drag, resize,
          minimize or pop out — and it keeps playing while you browse the rest of the library. Toggle
          the captions button on the player to follow along with a synced, clickable transcript.
        </p>
      </header>

      <div className="toolbar">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addVideo()}
          placeholder="Add a YouTube URL or video ID…"
          aria-label="Add a YouTube URL or video ID"
        />
        <button type="button" onClick={addVideo}>
          Add
        </button>
        <button
          type="button"
          className={showFavoritesOnly ? "on" : undefined}
          onClick={() => setShowFavoritesOnly((only) => !only)}
        >
          {showFavoritesOnly ? `Favorites (${favoriteCount})` : `All (${videos.length})`}
        </button>
        <button type="button" onClick={playAll} disabled={visible.length === 0}>
          Play all
        </button>
      </div>

      {addError && <p className="error">{addError}</p>}

      <VideoGrid videos={visible} onToggleFavorite={toggleFavorite} onRemove={remove} />

      {/*
        Mounted once for the whole app. It renders nothing until something calls
        `youtubePlayer.play(...)`, so it is safe to leave at the root of a layout.
        `extraControls` is the seam for app-specific chrome — see SpeedButton.jsx.
      */}
      <FloatingYouTubePlayer
        transcriptUrl="/api/transcript"
        extraControls={({ playbackRate, player }) => <SpeedButton playbackRate={playbackRate} player={player} />}
      />
    </main>
  );
}
