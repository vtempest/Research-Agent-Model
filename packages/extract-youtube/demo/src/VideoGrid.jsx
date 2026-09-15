/**
 * The picker: a grid of the saved library. Clicking a card starts it in the
 * floating player; the star toggles a favorite; the other two actions queue
 * the video up next or open its transcript in the popout modal.
 */

import { ListPlus, Play, Star, Trash2 } from "lucide-react";
import { YouTubeTranscriptModal, thumbnailUrl, usePlayerState, youtubePlayer } from "extract-youtube/react";

export function VideoGrid({ videos, onToggleFavorite, onRemove }) {
  const { activeVideo, queue } = usePlayerState();

  if (videos.length === 0) {
    return <p className="empty">Nothing here yet — add a YouTube URL above, or star a video to favorite it.</p>;
  }

  return (
    <div className="grid">
      {videos.map((video) => {
        const isPlaying = activeVideo?.videoId === video.videoId;
        const isQueued = queue.some((item) => item.videoId === video.videoId);

        return (
          <div key={video.videoId} className={`card${isPlaying ? " card-playing" : ""}`}>
            <button
              type="button"
              className="card-thumb"
              onClick={() => youtubePlayer.play(video)}
              aria-label={`Play ${video.title}`}
            >
              <img src={thumbnailUrl(video.videoId)} alt="" loading="lazy" />
              <span className="card-play">
                <Play size={20} fill="currentColor" />
              </span>
              {isPlaying && <span className="card-badge">Playing</span>}
              {!isPlaying && isQueued && <span className="card-badge card-badge-queued">Queued</span>}
            </button>

            <div className="card-body">
              <p className="card-title" title={video.title}>
                {video.title}
              </p>
              <p className="card-channel">{video.channel ?? video.videoId}</p>
            </div>

            <div className="card-actions">
              <button
                type="button"
                className={`icon-btn${video.favorite ? " icon-btn-on" : ""}`}
                onClick={() => onToggleFavorite(video.videoId)}
                aria-label={video.favorite ? "Remove from favorites" : "Add to favorites"}
                title={video.favorite ? "Remove from favorites" : "Add to favorites"}
              >
                <Star size={14} fill={video.favorite ? "currentColor" : "none"} />
              </button>

              <button
                type="button"
                className="icon-btn"
                onClick={() => youtubePlayer.addToQueue(video)}
                aria-label="Add to queue"
                title="Add to queue"
                disabled={isQueued || isPlaying}
              >
                <ListPlus size={14} />
              </button>

              {/* The package's other React component — same transcript source
                  as the floating player's subtitles panel. */}
              <YouTubeTranscriptModal
                videoId={video.videoId}
                title={video.title}
                transcriptUrl="/api/transcript"
              />

              <button
                type="button"
                className="icon-btn"
                onClick={() => onRemove(video.videoId)}
                aria-label="Remove from library"
                title="Remove from library"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
