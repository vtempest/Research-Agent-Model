/**
 * @fileoverview The floating player's control strip.
 *
 * Only controls that mean the same thing for *any* YouTube video live here:
 * play/pause, skip, captions, picture-in-picture, minimise, close. Anything
 * app-specific — a "slow this down for note-taking" speed button, a bookmark,
 * a share — is the host app's to render, and arrives through `extraControls`
 * (see `FloatingYouTubePlayerProps`).
 */

'use client';

import { Captions, Maximize2, Minus, Pause, PictureInPicture2, Play, SkipForward, X } from 'lucide-react';
import type { ReactNode } from 'react';

export interface PlayerControlsProps {
  isPlaying: boolean;
  isMinimized: boolean;
  queueLength: number;
  isPipSupported: boolean;
  isPipActive: boolean;
  isSubtitlesOpen: boolean;
  showSubtitles: boolean;
  showPip: boolean;
  /** Host-supplied buttons, rendered ahead of the built-in ones. */
  extraControls?: ReactNode;
  onPlayPause: () => void;
  onPlayNext: () => void;
  onToggleMinimize: () => void;
  onTogglePip: () => void;
  onToggleSubtitles: () => void;
  onClose: () => void;
}

const ICON_SIZE = 13;

export function PlayerControls({
  isPlaying,
  isMinimized,
  queueLength,
  isPipSupported,
  isPipActive,
  isSubtitlesOpen,
  showSubtitles,
  showPip,
  extraControls,
  onPlayPause,
  onPlayNext,
  onToggleMinimize,
  onTogglePip,
  onToggleSubtitles,
  onClose,
}: PlayerControlsProps) {
  return (
    <div className="eytp-controls">
      <button
        type="button"
        onClick={onPlayPause}
        className="eytp-btn"
        aria-label={isPlaying ? 'Pause video' : 'Play video'}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause size={ICON_SIZE} /> : <Play size={ICON_SIZE} />}
      </button>

      {extraControls}

      {queueLength > 0 && (
        <button
          type="button"
          onClick={onPlayNext}
          className="eytp-btn"
          aria-label="Play next in queue"
          title={`Skip to next (${queueLength} in queue)`}
        >
          <SkipForward size={ICON_SIZE} />
          <span className="eytp-btn-count">{queueLength}</span>
        </button>
      )}

      {showSubtitles && (
        <button
          type="button"
          onClick={onToggleSubtitles}
          className={`eytp-btn${isSubtitlesOpen ? ' eytp-btn-active' : ''}`}
          aria-label={isSubtitlesOpen ? 'Hide subtitles' : 'Show subtitles'}
          title={isSubtitlesOpen ? 'Hide subtitles' : 'Show subtitles'}
        >
          <Captions size={ICON_SIZE} />
        </button>
      )}

      {showPip && isPipSupported && (
        <button
          type="button"
          onClick={onTogglePip}
          className={`eytp-btn${isPipActive ? ' eytp-btn-active' : ''}`}
          aria-label={isPipActive ? 'Exit picture-in-picture' : 'Pop out picture-in-picture'}
          title={isPipActive ? 'Exit picture-in-picture' : 'Pop out picture-in-picture'}
        >
          <PictureInPicture2 size={ICON_SIZE} />
        </button>
      )}

      <button
        type="button"
        onClick={onToggleMinimize}
        className="eytp-btn"
        aria-label={isMinimized ? 'Expand player' : 'Minimize player'}
        title={isMinimized ? 'Expand player' : 'Minimize player — drag to move, resize from the edges'}
      >
        {isMinimized ? <Maximize2 size={ICON_SIZE} /> : <Minus size={ICON_SIZE} />}
      </button>

      <button type="button" onClick={onClose} className="eytp-btn" aria-label="Close video" title="Close player">
        <X size={ICON_SIZE} />
      </button>
    </div>
  );
}
